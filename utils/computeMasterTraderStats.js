const { Op } = require("sequelize");
const MasterTraderModel = require("../models/masterTrader.model");
const MasterTraderStatsModel = require("../models/masterTraderStats.model");
const Mt5AccountModel = require("../models/mt5Account.model");
const DealsControllers = require("../mt5Services/deals");
const UserControllers = require("../mt5Services/user");

const safeRequire = (p) => { try { return require(p); } catch { return null; } };
const CopyTradeSubscriptionModel = safeRequire("../models/copyTradeSubscription.model");

const BATCH_SIZE = 1000;

// Fetch ALL deals (trading + balance operations) since Unix epoch
async function fetchAllDeals(login, fromDate, toDate) {
    const totalRes = await DealsControllers.getDealsList(login, fromDate, toDate);
    const totalCount = parseInt(totalRes?.answer?.total ?? 0, 10);
    if (!totalCount) return [];

    let all = [];
    let offset = 0;
    while (offset < totalCount) {
        const pageRes = await DealsControllers.getDealsPage(login, fromDate, toDate, offset, BATCH_SIZE);
        const batch = pageRes?.answer;
        if (!Array.isArray(batch) || batch.length === 0) break;
        all = all.concat(batch);
        offset += batch.length;
    }
    return all;
}

// Resolve the invested capital to use as the ROI denominator.
// Primary: sum of deposit deal amounts (Action=2, Profit > 0).
// Fallback: live MT5 balance minus total trading P&L.
async function resolveInvestedCapital(login, allDeals, totalPnL) {
    // MT5 balance operations: Action=2. Positive Profit = deposit, negative = withdrawal.
    const balanceDeals = allDeals.filter(d => String(d.Action) === '2');
    const deposits     = balanceDeals.filter(d => parseFloat(d.Profit ?? 0) > 0);
    const totalDeposited = deposits.reduce((s, d) => s + parseFloat(d.Profit ?? 0), 0);

    if (totalDeposited > 0) return totalDeposited;

    // Fallback: fetch live balance from MT5
    try {
        const userRes = await UserControllers.getUser(login);
        const liveBalance = parseFloat(userRes?.answer?.Balance ?? 0);
        if (liveBalance > 0) return Math.max(liveBalance - totalPnL, 1);
    } catch (_) {}

    return 1; // last resort — avoids division by zero
}

async function computeStatsForMasterTrader(masterTrader) {
    const login = masterTrader.mt5Account?.Login;
    if (!login) return;

    const nowTs  = Math.floor(Date.now() / 1000);
    const fromTs = 0; // all deals since account inception

    const weekAgoTs  = nowTs - 7  * 86400;
    const monthAgoTs = nowTs - 30 * 86400;

    let allDeals;
    try {
        allDeals = await fetchAllDeals(login, fromTs, nowTs);
    } catch (e) {
        console.error(`[Stats] MT5 fetch failed for login ${login}:`, e.message);
        return;
    }

    // Active copiers from DB
    let activeCopiers = 0;
    if (CopyTradeSubscriptionModel) {
        activeCopiers = await CopyTradeSubscriptionModel.count({
            where: { masterTraderId: masterTrader.id, status: "ACTIVE", isDeleted: false }
        });
    }

    // Only Entry=1 deals carry trade P&L
    const closingDeals = allDeals.filter(d => String(d.Entry) === '1');

    if (closingDeals.length === 0) {
        await upsertTodayStats(masterTrader.id, {
            totalTrades: 0, winningTrades: 0, losingTrades: 0,
            winRate: 0, totalPnL: 0, totalPnLPercentage: 0,
            weeklyPnL: 0, monthlyPnL: 0, maxDrawdownPercent: 0,
            averageWin: 0, averageLoss: 0, profitFactor: 0, activeCopiers,
        });
        return;
    }

    // Sort ascending by time for drawdown walk
    closingDeals.sort((a, b) => parseInt(a.Time ?? 0) - parseInt(b.Time ?? 0));

    // Net P&L per closing deal = Profit + Commission + Storage(swap)
    const netProfits = closingDeals.map(d =>
        parseFloat(d.Profit ?? 0) + parseFloat(d.Commission ?? 0) + parseFloat(d.Storage ?? 0)
    );

    const totalTrades   = closingDeals.length;
    const winningTrades = netProfits.filter(p => p > 0).length;
    const losingTrades  = netProfits.filter(p => p < 0).length;
    const winRate       = (winningTrades / totalTrades) * 100;
    const totalPnL      = netProfits.reduce((s, p) => s + p, 0);

    // ROI — use actual deposited capital as denominator
    const investedCapital  = await resolveInvestedCapital(login, allDeals, totalPnL);
    const totalPnLPercentage = (totalPnL / investedCapital) * 100;

    // Weekly / monthly PnL
    const weeklyPnL = closingDeals.reduce((s, d, i) =>
        parseInt(d.Time ?? 0) >= weekAgoTs  ? s + netProfits[i] : s, 0);
    const monthlyPnL = closingDeals.reduce((s, d, i) =>
        parseInt(d.Time ?? 0) >= monthAgoTs ? s + netProfits[i] : s, 0);

    // Max drawdown: peak-to-trough on cumulative P&L curve
    let runningPnL = 0, peak = 0, maxDrawdown = 0;
    for (const p of netProfits) {
        runningPnL += p;
        if (runningPnL > peak) peak = runningPnL;
        if (peak > 0) {
            const dd = ((peak - runningPnL) / peak) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }
    }

    // Average win / average loss
    const winAmounts  = netProfits.filter(p => p > 0);
    const lossAmounts = netProfits.filter(p => p < 0);
    const averageWin  = winAmounts.length
        ? winAmounts.reduce((s, p) => s + p, 0) / winAmounts.length : 0;
    const averageLoss = lossAmounts.length
        ? Math.abs(lossAmounts.reduce((s, p) => s + p, 0) / lossAmounts.length) : 0;

    // Profit factor = gross profit / |gross loss|
    const grossProfit  = winAmounts.reduce((s, p) => s + p, 0);
    const grossLoss    = Math.abs(lossAmounts.reduce((s, p) => s + p, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss
                       : grossProfit > 0 ? 99.99 : 0;

    await upsertTodayStats(masterTrader.id, {
        totalTrades, winningTrades, losingTrades,
        winRate:            Math.min(100, Math.max(0, winRate)),
        totalPnL,
        totalPnLPercentage,
        weeklyPnL,
        monthlyPnL,
        maxDrawdownPercent: Math.min(100, Math.max(0, maxDrawdown)),
        averageWin,
        averageLoss,
        profitFactor,
        activeCopiers,
    });
}

// One record per (masterTraderId, calendar day) — update if exists, create if not.
async function upsertTodayStats(masterTraderId, values) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const existing = await MasterTraderStatsModel.findOne({
        where: {
            masterTraderId,
            snapshotDate: { [Op.gte]: today, [Op.lt]: tomorrow },
            isDeleted: false,
        }
    });

    if (existing) {
        await existing.update({ ...values, snapshotDate: new Date() });
    } else {
        await MasterTraderStatsModel.create({ masterTraderId, snapshotDate: new Date(), ...values });
    }
}

async function computeAllMasterTraderStats() {
    console.log("[Stats] Starting master trader stats computation...");
    let masterTraders;
    try {
        masterTraders = await MasterTraderModel.findAll({
            where: { isDeleted: false, status: "ACTIVE" },
            include: [{
                model: Mt5AccountModel,
                as: "mt5Account",
                attributes: ["Login", "Balance"]
            }]
        });
    } catch (e) {
        console.error("[Stats] Failed to fetch master traders:", e.message);
        return;
    }

    for (const masterTrader of masterTraders) {
        try {
            await computeStatsForMasterTrader(masterTrader);
            console.log(`[Stats] Computed stats for master trader #${masterTrader.id} (login: ${masterTrader.mt5Account?.Login})`);
        } catch (e) {
            console.error(`[Stats] Error for master trader #${masterTrader.id}:`, e.message);
        }
    }
    console.log(`[Stats] Done. Processed ${masterTraders.length} master trader(s).`);
}

module.exports = { computeAllMasterTraderStats, computeStatsForMasterTrader };
