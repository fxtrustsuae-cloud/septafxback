const { Op } = require("sequelize");
const configuration = require("../../config/config");
const Mt5Model = require("../../models/mt5Account.model");
const UserModel = require("../../models/users.model");
const GroupModel = require("../../models/group.model");
const MetaControllers = require("../../mt5Services/user");
const PositionControllers = require("../../mt5Services/position");
const DealControllers = require("../../mt5Services/deals");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { socketEmitRoom } = require("../../config/socketIO");
const { CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

const POLL_INTERVAL_MS = Number(process.env.RISK_MANAGEMENT_POLL_INTERVAL_MS || 15000);
const CACHE_MAX_AGE_MS = Number(process.env.RISK_MANAGEMENT_CACHE_MAX_AGE_MS || 30000);
const RECENT_WINDOW_SECONDS = Number(process.env.RISK_MANAGEMENT_DEALS_WINDOW_SECONDS || 72 * 60 * 60);
const MAX_RECENT_TRADES = Number(process.env.RISK_MANAGEMENT_MAX_TRADES || 200);
const MAX_ALERTS = Number(process.env.RISK_MANAGEMENT_MAX_ALERTS || 200);
const POSITION_PAGE_SIZE = Number(process.env.RISK_MANAGEMENT_POSITION_PAGE_SIZE || 100);
const POSITION_MAX_PAGES = Number(process.env.RISK_MANAGEMENT_POSITION_MAX_PAGES || 5);
const EXPOSURE_WARNING_THRESHOLD = 40;
const EXPOSURE_HEDGE_THRESHOLD = 50;
const RISK_SCORE_THRESHOLD = 80;
const RISK_MANAGEMENT_DEBUG_LOGS = ["1", "true", "yes", "on"].includes(
  String(process.env.RISK_MANAGEMENT_DEBUG_LOGS || "").trim().toLowerCase()
);

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return value.toISOString();

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  const numericValue = Number(stringValue);
  if (Number.isFinite(numericValue)) {
    const timestamp = numericValue > 1e12 ? numericValue : numericValue * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsedDate = new Date(stringValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function flattenMt5Value(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function extractMt5Rows(result) {
  const answer = result?.answer;

  if (Array.isArray(answer)) return answer;
  if (!answer || typeof answer !== "object") return [];

  const directEntity = firstDefined(
    answer.Login,
    answer.Position,
    answer.PositionID,
    answer.Symbol,
    answer.Deal,
    answer.Order
  );
  if (directEntity !== undefined) return [answer];

  return Object.values(answer).flatMap(flattenMt5Value);
}

function indexBy(rows, keyGetter) {
  return rows.reduce((map, row) => {
    const key = keyGetter(row);
    if (key !== undefined && key !== null && key !== "") {
      map.set(String(key), row);
    }
    return map;
  }, new Map());
}

function toLots(volume) {
  const numericValue = toNumber(volume);
  if (numericValue === 0) return 0;
  return numericValue > 1000
    ? Number((numericValue / 10000).toFixed(2))
    : Number(numericValue.toFixed(2));
}

function actionToType(action) {
  const numericAction = toNullableNumber(action);
  if (numericAction === 0) return "BUY";
  if (numericAction === 1) return "SELL";

  if (typeof action === "string") {
    const normalized = action.trim().toUpperCase();
    if (normalized === "BUY" || normalized === "SELL") return normalized;
  }

  return "UNKNOWN";
}

function normalizeString(value, fallback = "") {
  return value === undefined || value === null ? fallback : String(value);
}

function analyzeTrade(trade) {
  const flags = [];
  let riskScore = 0;

  const openTime = new Date(trade.openTime);
  const closeTime = new Date(trade.closeTime);
  const durationSeconds = Math.max(0, Math.round((closeTime - openTime) / 1000));

  if (durationSeconds < 180) {
    flags.push("SCALPING");
    riskScore += 20;
  }

  if (trade.profit > 50 && durationSeconds < 120) {
    flags.push("TOXIC_PROFIT");
    riskScore += 40;
  }

  if (trade.volume > 5) {
    flags.push("HIGH_VOLUME");
    riskScore += 30;
  }

  return {
    riskScore: Math.min(riskScore, 100),
    flags,
    durationSeconds,
  };
}

function getTradingFlags(account) {
  const rights = toNullableNumber(firstDefined(account?.Rights, account?.rights));
  const statusText = normalizeString(firstDefined(account?.Status, account?.status)).toUpperCase();

  if (rights === null) {
    return {
      isDisabled: statusText.includes("DISABLED") || statusText.includes("ARCHIVE"),
      rights,
      statusText,
    };
  }

  const USER_RIGHT_ENABLED = 1;
  const USER_RIGHT_TRADE_DISABLED = 4;

  const isDisabled = (rights & USER_RIGHT_ENABLED) === 0
    || (rights & USER_RIGHT_TRADE_DISABLED) === USER_RIGHT_TRADE_DISABLED
    || statusText.includes("DISABLED")
    || statusText.includes("ARCHIVE");

  return {
    isDisabled,
    rights,
    statusText,
  };
}

function createEmptySnapshot() {
  return {
    metrics: {
      trackedAccounts: 0,
      liveAccounts: 0,
      openPositions: 0,
      recentTrades: 0,
      highRiskTrades: 0,
      hedgeWarnings: 0,
      totalNetExposure: 0,
      totalFloatingPnL: 0,
    },
    mt5Status: {
      connected: false,
      lastSync: null,
      serverName: configuration.MT5_URL || configuration.SERVER || "MT5",
      mode: "LIVE",
      message: "Awaiting first refresh",
    },
    users: [],
    exposures: [],
    recentTrades: [],
    alerts: [],
    profitRiskReport: [],
    scalpingReport: [],
    lastUpdatedAt: null,
    lastError: null,
  };
}

function createAlertKey(prefix, ...parts) {
  return [prefix, ...parts].filter(Boolean).join(":");
}

function logRiskDebug(message, meta = {}) {
  if (!RISK_MANAGEMENT_DEBUG_LOGS) return;
  adminLogger.info(message, meta);
}

function summarizeMt5Row(row, preferredFields = []) {
  if (!row || typeof row !== "object") return null;

  const keys = Object.keys(row);
  const fields = [...new Set([...preferredFields, ...keys])].slice(0, 12);
  const sample = {};

  for (const field of fields) {
    const value = row[field];
    if (value === undefined) continue;
    if (value && typeof value === "object") continue;
    sample[field] = value;
  }

  return {
    keys: keys.slice(0, 12),
    sample,
  };
}

function summarizeMt5Result(result, preferredFields = []) {
  const answer = result?.answer;
  const rows = extractMt5Rows(result);

  return {
    answerType: Array.isArray(answer) ? "array" : answer === null ? "null" : typeof answer,
    answerKeys: answer && typeof answer === "object" && !Array.isArray(answer)
      ? Object.keys(answer).slice(0, 12)
      : [],
    extractedRowsCount: rows.length,
    sampleRow: rows.length ? summarizeMt5Row(rows[0], preferredFields) : null,
  };
}

class RiskManagementService {
  constructor() {
    this.snapshot = createEmptySnapshot();
    this.alerts = [];
    this.alertKeys = new Set();
    this.started = false;
    this.refreshPromise = null;
    this.intervalId = null;
    this.lastChartState = {
      exposuresEmpty: null,
      recentTradesEmpty: null,
    };
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.refresh().catch((error) => {
      adminLogger.error("[Risk Management] Initial refresh failed", { message: error.message, stack: error.stack });
    });

    this.intervalId = setInterval(() => {
      this.refresh().catch((error) => {
        adminLogger.error("[Risk Management] Background refresh failed", { message: error.message, stack: error.stack });
      });
    }, POLL_INTERVAL_MS);
  }

  async ensureFresh(forceRefresh = false) {
    const lastUpdatedAt = this.snapshot.lastUpdatedAt
      ? new Date(this.snapshot.lastUpdatedAt).getTime()
      : 0;
    const isStale = !lastUpdatedAt || (Date.now() - lastUpdatedAt) > CACHE_MAX_AGE_MS;

    if (forceRefresh || isStale) {
      await this.refresh(forceRefresh);
    }

    return this.snapshot;
  }

  async refresh(forceRefresh = false) {
    if (this.refreshPromise && !forceRefresh) {
      return this.refreshPromise;
    }

    const refreshPromise = this.buildSnapshot()
      .then((nextSnapshot) => {
        this.snapshot = nextSnapshot;
        socketEmitRoom("risk-management-snapshot", nextSnapshot, "admins");
        return nextSnapshot;
      })
      .finally(() => {
        if (this.refreshPromise === refreshPromise) {
          this.refreshPromise = null;
        }
      });

    this.refreshPromise = refreshPromise;
    return refreshPromise;
  }

  async buildSnapshot() {
    const trackedAccounts = await Mt5Model.findAll({
      where: { isDeleted: false },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: UserModel,
          as: "user",
          attributes: ["id", "name", "email", "userName", "isDeleted"],
          where: { isDeleted: false, role: { [Op.in]: ["USER", "IB"] } },
          required: false,
        },
        {
          model: GroupModel,
          as: "group",
          attributes: ["id", "name", "leverage"],
          required: false,
        },
      ],
    });

    if (!trackedAccounts.length) {
      adminLogger.warn("[Risk Management] No tracked MT5 accounts found for dashboard snapshot.");
      return {
        ...createEmptySnapshot(),
        mt5Status: {
          connected: false,
          lastSync: new Date().toISOString(),
          serverName: configuration.MT5_URL || configuration.SERVER || "MT5",
          mode: "LIVE",
          message: "No MT5 accounts are linked yet.",
        },
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    const activeAccounts = trackedAccounts.filter((account) => account.Login);
    const logins = activeAccounts.map((account) => String(account.Login));
    const loginBatch = logins.join(",");
    const nowSeconds = Math.floor(Date.now() / 1000);
    const fromSeconds = nowSeconds - RECENT_WINDOW_SECONDS;

    adminLogger.info("[Risk Management] MT5 query parameters.", {
      trackedAccounts: activeAccounts.length,
      loginCount: logins.length,
      loginSample: logins.slice(0, 10),
      fromSeconds,
      toSeconds: nowSeconds,
      recentWindowSeconds: RECENT_WINDOW_SECONDS,
    });

    const [liveAccountsResult, positionsResult, dealsResult] = await Promise.allSettled([
      loginBatch ? MetaControllers.getMultipleTrade(loginBatch) : Promise.resolve(false),
      loginBatch ? PositionControllers.getMultiplePositions(loginBatch, "", "", "") : Promise.resolve(false),
      loginBatch ? DealControllers.getDealBatch(loginBatch, "", "", fromSeconds, nowSeconds, "") : Promise.resolve(false),
    ]);

    const mt5FetchMeta = {
      trackedAccounts: activeAccounts.length,
      liveAccountsFetch: liveAccountsResult.status,
      positionsFetch: positionsResult.status,
      dealsFetch: dealsResult.status,
    };

    if (liveAccountsResult.status === "rejected"
      || positionsResult.status === "rejected"
      || dealsResult.status === "rejected") {
      adminLogger.warn("[Risk Management] One or more MT5 fetches failed during snapshot build.", {
        ...mt5FetchMeta,
        liveAccountsError: liveAccountsResult.status === "rejected" ? liveAccountsResult.reason?.message || "Unknown error" : null,
        positionsError: positionsResult.status === "rejected" ? positionsResult.reason?.message || "Unknown error" : null,
        dealsError: dealsResult.status === "rejected" ? dealsResult.reason?.message || "Unknown error" : null,
      });
    } else {
      logRiskDebug("[Risk Management] MT5 fetches completed successfully.", mt5FetchMeta);
    }

    const liveRows = liveAccountsResult.status === "fulfilled" ? extractMt5Rows(liveAccountsResult.value) : [];
    let positionRows = positionsResult.status === "fulfilled" ? extractMt5Rows(positionsResult.value) : [];
    const dealRows = dealsResult.status === "fulfilled" ? extractMt5Rows(dealsResult.value) : [];

    if (!positionRows.length && logins.length) {
      positionRows = await this.fetchPositionRowsByLoginFallback(logins);
    }

    adminLogger.info("[Risk Management] MT5 raw snapshot counts.", {
      trackedAccounts: activeAccounts.length,
      liveRowsCount: liveRows.length,
      positionRowsCount: positionRows.length,
      dealRowsCount: dealRows.length,
      liveAccountsFetch: liveAccountsResult.status,
      positionsFetch: positionsResult.status,
      dealsFetch: dealsResult.status,
    });

    const positionsSummarySource = positionRows.length > 0
      && positionsResult.status === "fulfilled"
      && extractMt5Rows(positionsResult.value).length === 0
      ? { answer: positionRows }
      : positionsResult.value;

    adminLogger.info("[Risk Management] MT5 raw response samples.", {
      liveAccounts: liveAccountsResult.status === "fulfilled"
        ? summarizeMt5Result(liveAccountsResult.value, ["Login", "Name", "Balance", "Equity", "Profit", "Leverage"])
        : { error: liveAccountsResult.reason?.message || "Fetch failed" },
      positions: positionsResult.status === "fulfilled"
        ? {
          source: positionsSummarySource === positionsResult.value ? "batch-get_batch" : "per-login-get_page-fallback",
          ...summarizeMt5Result(positionsSummarySource, ["Login", "Position", "PositionID", "Symbol", "Action", "Type", "VolumeCurrent", "VolumeInitial", "Volume"]),
        }
        : { error: positionsResult.reason?.message || "Fetch failed" },
      deals: dealsResult.status === "fulfilled"
        ? summarizeMt5Result(dealsResult.value, ["Login", "Deal", "Order", "PositionID", "Symbol", "Action", "Entry", "Volume", "VolumeClosed", "Profit", "Time", "TimeMsc"])
        : { error: dealsResult.reason?.message || "Fetch failed" },
    });

    const liveAccountsByLogin = indexBy(liveRows, (row) => firstDefined(row.Login, row.login));
    const positionRowsByLogin = positionRows.reduce((map, row) => {
      const login = normalizeString(firstDefined(row.Login, row.login));
      if (!login) return map;
      if (!map.has(login)) map.set(login, []);
      map.get(login).push(row);
      return map;
    }, new Map());

    const recentTrades = this.buildTradeEvents(dealRows).slice(0, MAX_RECENT_TRADES);
    const recentTradesByLogin = recentTrades.reduce((map, trade) => {
      if (!map.has(trade.login)) map.set(trade.login, []);
      map.get(trade.login).push(trade);
      return map;
    }, new Map());

    const exposures = this.buildExposures(positionRows);

    const users = activeAccounts
      .map((account) => {
        const login = String(account.Login);
        const liveAccount = liveAccountsByLogin.get(login) || {};
        const accountTrades = recentTradesByLogin.get(login) || [];
        const accountPositions = positionRowsByLogin.get(login) || [];
        const wins = accountTrades.filter((trade) => trade.profit > 0).length;
        const winRate = accountTrades.length ? wins / accountTrades.length : 0.5;
        const balance = toNumber(firstDefined(liveAccount.Balance, account.Balance));
        const credit = toNumber(firstDefined(liveAccount.Credit, account.Credit));
        const equityPrevDay = toNumber(firstDefined(liveAccount.EquityPrevDay, account.EquityPrevDay));
        const equity = toNumber(firstDefined(liveAccount.Equity, balance));
        const floating = toNumber(firstDefined(liveAccount.Profit, liveAccount.Floating, equity - balance));
        const totalProfit = Number(accountTrades.reduce((sum, trade) => sum + trade.profit, 0).toFixed(2));
        const currentProfit = Number((equity - equityPrevDay).toFixed(2));
        const netDeposit = Number((balance - totalProfit).toFixed(2));
        const leverage = toNumber(firstDefined(liveAccount.Leverage, account.Leverage));
        const tradingFlags = getTradingFlags(firstDefined(liveAccount, account));
        const highRiskTradeCount = accountTrades.filter((trade) => trade.riskScore >= RISK_SCORE_THRESHOLD).length;
        const openSymbols = [...new Set(accountPositions.map((position) => normalizeString(position.Symbol)).filter(Boolean))];

        let riskProfile = "NORMAL";
        if (winRate > 0.6) riskProfile = "B_BOOK";
        if (winRate < 0.4) riskProfile = "A_BOOK";

        return {
          id: login,
          login,
          userId: account.userId,
          name: normalizeString(firstDefined(account.Name, account.user?.name, liveAccount.Name), `User ${login}`),
          email: normalizeString(firstDefined(account.Email, account.user?.email, liveAccount.Email)),
          leverage,
          winRate: Number(winRate.toFixed(2)),
          riskProfile,
          balance: Number(balance.toFixed(2)),
          credit: Number(credit.toFixed(2)),
          equityPrevDay: Number(equityPrevDay.toFixed(2)),
          equity: Number(equity.toFixed(2)),
          floating: Number(floating.toFixed(2)),
          netDeposit,
          currentProfit,
          totalProfit,
          openPositionCount: accountPositions.length,
          highRiskTradeCount,
          isTradingDisabled: tradingFlags.isDisabled,
          status: tradingFlags.isDisabled ? "DISABLED" : "ACTIVE",
          rights: tradingFlags.rights,
          serverStatus: tradingFlags.statusText,
          groupName: account.group?.name || "",
          accountType: account.accountType,
          openSymbols,
          recentFlags: [...new Set(accountTrades.flatMap((trade) => trade.flags))],
          lastTradeTime: accountTrades[0]?.closeTime || null,
        };
      })
      .sort((left, right) => {
        const riskDelta = right.highRiskTradeCount - left.highRiskTradeCount;
        if (riskDelta !== 0) return riskDelta;
        return right.floating - left.floating;
      });

    const profitRiskReport = users.map((user) => ({
      name: user.name,
      login: user.login,
      balance: user.balance,
      credit: user.credit,
      equityPrevDay: user.equityPrevDay,
      equity: user.equity,
      floating: user.floating,
      netDeposit: user.netDeposit,
      currentProfit: user.currentProfit,
      totalProfit: user.totalProfit,
      openPositionCount: user.openPositionCount,
      leverage: user.leverage,
      status: user.status,
    }));

    const scalpingReport = Array.from(recentTradesByLogin.entries())
      .map(([login, trades]) => {
        const totalLots = trades.reduce((sum, trade) => sum + trade.volume, 0);
        const scalpingTrades = trades.filter((trade) => trade.flags.includes("SCALPING"));
        const scalpingLots = scalpingTrades.reduce((sum, trade) => sum + trade.volume, 0);

        return {
          login,
          name: users.find((user) => user.login === login)?.name || `User ${login}`,
          totalLots: Number(totalLots.toFixed(2)),
          scalpingLots: Number(scalpingLots.toFixed(2)),
          netLot: Number((totalLots - scalpingLots).toFixed(2)),
          totalTrades: trades.length,
          scalpingTrades: scalpingTrades.length,
        };
      })
      .sort((left, right) => {
        const scalpingDelta = right.scalpingLots - left.scalpingLots;
        if (scalpingDelta !== 0) return scalpingDelta;
        return right.totalLots - left.totalLots;
      });

    const alertCandidates = this.buildAlerts({
      recentTrades,
      exposures,
      users,
    });
    const freshAlerts = this.consumeAlerts(alertCandidates);

    for (const alert of freshAlerts) {
      socketEmitRoom("risk-management-alert", alert, "admins");
    }

    adminLogger.info("[Risk Management] Derived dashboard payload counts.", {
      trackedAccounts: activeAccounts.length,
      liveRowsCount: liveRows.length,
      positionRowsCount: positionRows.length,
      dealRowsCount: dealRows.length,
      exposuresCount: exposures.length,
      recentTradesCount: recentTrades.length,
      usersCount: users.length,
      freshAlertsCount: freshAlerts.length,
      highRiskTrades: recentTrades.filter((trade) => trade.riskScore >= RISK_SCORE_THRESHOLD).length,
    });

    this.logChartDataState({
      activeAccounts,
      positionRows,
      dealRows,
      exposures,
      recentTrades,
      liveRows,
      freshAlerts,
    });

    return {
      metrics: {
        trackedAccounts: activeAccounts.length,
        liveAccounts: liveRows.length,
        openPositions: positionRows.length,
        recentTrades: recentTrades.length,
        highRiskTrades: recentTrades.filter((trade) => trade.riskScore >= RISK_SCORE_THRESHOLD).length,
        hedgeWarnings: exposures.filter((exposure) => Math.abs(exposure.net) >= EXPOSURE_WARNING_THRESHOLD).length,
        totalNetExposure: Number(exposures.reduce((sum, exposure) => sum + Math.abs(exposure.net), 0).toFixed(2)),
        totalFloatingPnL: Number(users.reduce((sum, user) => sum + user.floating, 0).toFixed(2)),
      },
      mt5Status: {
        connected: Boolean(liveRows.length || positionRows.length || dealRows.length),
        lastSync: new Date().toISOString(),
        serverName: configuration.MT5_URL || configuration.SERVER || "MT5",
        mode: "LIVE",
        message: liveAccountsResult.status === "fulfilled"
          ? "Risk engine synchronized with MT5."
          : "Using cached or partial data because MT5 sync is degraded.",
      },
      users,
      exposures,
      recentTrades,
      alerts: this.alerts.slice(0, MAX_ALERTS),
      profitRiskReport,
      scalpingReport,
      lastUpdatedAt: new Date().toISOString(),
      lastError: liveAccountsResult.status === "rejected"
        ? liveAccountsResult.reason?.message || "Live MT5 snapshot unavailable."
        : null,
    };
  }

  buildTradeEvents(dealRows) {
    const sortedRows = [...dealRows]
      .map((row) => ({ ...row, __time: toIsoDate(firstDefined(row.TimeMsc, row.Time)) }))
      .filter((row) => row.__time)
      .sort((left, right) => new Date(left.__time) - new Date(right.__time));

    const openingDeals = new Map();
    for (const row of sortedRows) {
      const positionId = normalizeString(firstDefined(row.PositionID, row.Position, row.Order, row.Deal));
      if (!positionId) continue;
      if (toNumber(row.Entry) === 0 && !openingDeals.has(positionId)) {
        openingDeals.set(positionId, row);
      }
    }

    return sortedRows
      .filter((row) => toNumber(row.Entry) !== 0)
      .map((row) => {
        const positionId = normalizeString(firstDefined(row.PositionID, row.Position, row.Order, row.Deal));
        const openingDeal = openingDeals.get(positionId);
        const login = normalizeString(firstDefined(row.Login, openingDeal?.Login));
        const closeTime = row.__time;
        const openTime = toIsoDate(firstDefined(openingDeal?.TimeMsc, openingDeal?.Time, row.TimeMsc, row.Time));
        const symbol = normalizeString(firstDefined(row.Symbol, openingDeal?.Symbol), "UNKNOWN");
        const volume = toLots(firstDefined(row.VolumeClosed, row.Volume, openingDeal?.Volume));
        const profit = toNumber(firstDefined(row.ProfitRaw, row.Profit));
        const type = actionToType(firstDefined(openingDeal?.Action, row.Action));

        const trade = {
          id: normalizeString(firstDefined(row.Deal, `${login}-${positionId}-${closeTime}`)),
          login,
          symbol,
          volume,
          openTime,
          closeTime,
          profit,
          type,
          positionId,
        };

        const analysis = analyzeTrade(trade);

        return {
          ...trade,
          riskScore: analysis.riskScore,
          flags: analysis.flags,
          durationSeconds: analysis.durationSeconds,
        };
      })
      .sort((left, right) => new Date(right.closeTime) - new Date(left.closeTime));
  }

  async fetchPositionRowsByLoginFallback(logins) {
    adminLogger.warn("[Risk Management] Batch MT5 positions fetch returned no rows. Falling back to per-login position queries.", {
      loginCount: logins.length,
      loginSample: logins.slice(0, 10),
    });

    const results = await Promise.allSettled(
      logins.map((login) => this.fetchPagedPositionRowsForLogin(login))
    );

    const fallbackRows = [];
    const failedLogins = [];
    const successfulLogins = [];

    for (let index = 0; index < results.length; index += 1) {
      const login = String(logins[index]);
      const result = results[index];

      if (result.status !== "fulfilled") {
        failedLogins.push({
          login,
          message: result.reason?.message || "Fetch failed",
        });
        continue;
      }

      const rows = result.value;

      successfulLogins.push({
        login,
        rowCount: rows.length,
      });
      fallbackRows.push(...rows);
    }

    adminLogger.info("[Risk Management] Per-login MT5 positions fallback completed.", {
      requestedLogins: logins.length,
      successfulLogins: successfulLogins.length,
      failedLogins: failedLogins.length,
      positionRowsCount: fallbackRows.length,
      nonEmptyLogins: successfulLogins.filter((entry) => entry.rowCount > 0).length,
      successfulSample: successfulLogins.slice(0, 10),
      failedSample: failedLogins.slice(0, 10),
    });

    return fallbackRows;
  }

  async fetchPagedPositionRowsForLogin(login) {
    const normalizedLogin = String(login);
    const rows = [];

    for (let pageIndex = 0; pageIndex < POSITION_MAX_PAGES; pageIndex += 1) {
      const offset = pageIndex * POSITION_PAGE_SIZE;
      const result = await PositionControllers.getPositionList(normalizedLogin, offset, POSITION_PAGE_SIZE);
      if (!result) {
        throw new Error("Paged MT5 position fetch failed.");
      }

      const pageRows = extractMt5Rows(result).map((row) => (
        firstDefined(row.Login, row.login) ? row : { ...row, Login: normalizedLogin }
      ));

      rows.push(...pageRows);

      if (pageRows.length < POSITION_PAGE_SIZE) {
        break;
      }
    }

    return rows;
  }

  buildExposures(positionRows) {
    const exposures = new Map();

    for (const row of positionRows) {
      const symbol = normalizeString(firstDefined(row.Symbol, row.symbol), "UNKNOWN");
      if (!exposures.has(symbol)) {
        exposures.set(symbol, {
          symbol,
          buy: 0,
          sell: 0,
          net: 0,
          openPositions: 0,
        });
      }

      const exposure = exposures.get(symbol);
      const type = actionToType(firstDefined(row.Action, row.Type));
      const volume = toLots(firstDefined(row.VolumeCurrent, row.VolumeInitial, row.Volume, row.VolumeExt));

      if (type === "BUY") exposure.buy += volume;
      if (type === "SELL") exposure.sell += volume;
      exposure.openPositions += 1;
      exposure.net = Number((exposure.buy - exposure.sell).toFixed(2));
    }

    return Array.from(exposures.values()).sort((left, right) => Math.abs(right.net) - Math.abs(left.net));
  }

  buildAlerts({ recentTrades, exposures, users }) {
    const alerts = [];

    for (const trade of recentTrades) {
      if (!trade.flags.length) continue;

      alerts.push({
        id: createAlertKey("trade", trade.id),
        type: trade.riskScore >= RISK_SCORE_THRESHOLD ? "error" : "warning",
        title: trade.riskScore >= RISK_SCORE_THRESHOLD ? "High Risk Trade" : "Trade Warning",
        message: `User ${trade.login} on ${trade.symbol}. Flags: ${trade.flags.join(", ")}`,
        login: trade.login,
        symbol: trade.symbol,
        createdAt: trade.closeTime,
        source: "trade",
      });
    }

    for (const exposure of exposures) {
      const absoluteExposure = Math.abs(exposure.net);
      if (absoluteExposure < EXPOSURE_WARNING_THRESHOLD) continue;

      alerts.push({
        id: createAlertKey("exposure", exposure.symbol, exposure.net),
        type: absoluteExposure > EXPOSURE_HEDGE_THRESHOLD ? "warning" : "info",
        title: absoluteExposure > EXPOSURE_HEDGE_THRESHOLD ? "Hedge Threshold Exceeded" : "Exposure Warning",
        message: `${exposure.symbol} net exposure is ${exposure.net.toFixed(2)} lots.`,
        symbol: exposure.symbol,
        createdAt: new Date().toISOString(),
        source: "exposure",
      });
    }

    for (const user of users) {
      if (user.isTradingDisabled) {
        alerts.push({
          id: createAlertKey("user", user.login, "disabled"),
          type: "info",
          title: "Trading Disabled",
          message: `Trading is disabled for login ${user.login}.`,
          login: user.login,
          createdAt: new Date().toISOString(),
          source: "user",
        });
      }
    }

    return alerts.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  consumeAlerts(nextAlerts) {
    const freshAlerts = [];

    for (const alert of nextAlerts) {
      if (this.alertKeys.has(alert.id)) continue;
      this.alertKeys.add(alert.id);
      freshAlerts.push(alert);
    }

    if (freshAlerts.length) {
      this.alerts = [...freshAlerts, ...this.alerts].slice(0, MAX_ALERTS);
    } else {
      this.alerts = this.alerts.slice(0, MAX_ALERTS);
    }

    if (this.alerts.length === MAX_ALERTS) {
      this.alertKeys = new Set(this.alerts.map((alert) => alert.id));
    }

    return freshAlerts;
  }

  async updateLeverage(login, leverage) {
    const mt5Account = await Mt5Model.findOne({ where: { Login: String(login), isDeleted: false } });
    if (!mt5Account) {
      throw CustomErrorHandler.notFound("MT5 account not found.");
    }

    const updatedAccount = await MetaControllers.updateUser({
      login: Number(login),
      Leverage: Number(leverage),
    });

    if (!updatedAccount) {
      throw CustomErrorHandler.serverError("Failed to update MT5 leverage.");
    }

    mt5Account.Leverage = String(leverage);
    await mt5Account.save();
    await this.refresh(true);

    return {
      status: true,
      message: `Leverage updated to 1:${leverage}.`,
    };
  }

  async closeAllPositions(login) {
    const livePositions = await this.fetchPagedPositionRowsForLogin(login);

    if (!livePositions.length) {
      return {
        status: true,
        message: `No open positions found for login ${login}.`,
        data: {
          totalPositions: 0,
          closedCount: 0,
          failedCount: 0,
          failures: [],
        },
      };
    }

    const failures = [];
    let closedCount = 0;

    for (const position of livePositions) {
      try {
        await this.closeSinglePosition(login, position);
        closedCount += 1;
      } catch (error) {
        failures.push({
          position: firstDefined(position.Position, position.PositionID, position.Ticket),
          symbol: position.Symbol,
          message: error.message,
        });
      }
    }

    await this.refresh(true);

    return {
      status: failures.length === 0,
      message: failures.length === 0
        ? `Closed ${closedCount} position(s) for login ${login}.`
        : `Closed ${closedCount} position(s), but ${failures.length} close request(s) failed.`,
      data: {
        totalPositions: livePositions.length,
        closedCount,
        failedCount: failures.length,
        failures,
      },
    };
  }

  async closeSinglePosition(login, livePosition) {
    const closePosition = this.resolveClosePositionPayload(livePosition);
    const { symbol, volume, type, position, digits } = closePosition;

    const checkPrice = await TradeRequestControllers.symbolPrice(symbol, 0);
    if (!checkPrice || !checkPrice.answer || checkPrice.answer.length === 0) {
      throw CustomErrorHandler.serverError(`Failed to fetch live price for ${symbol}.`);
    }

    const marketPrice = checkPrice.answer[0];
    const price = type === 0 ? marketPrice.Ask : marketPrice.Bid;
    const symbolInfo = await TradeRequestControllers.symbolInfo(symbol);
    const executionMode = symbolInfo?.answer?.Execution
      ?? symbolInfo?.answer?.TradeExecution
      ?? symbolInfo?.answer?.ExecutionMode;
    const flagRotation = this.getCloseTradeFlagRotation(executionMode);
    const fillRotation = [1, 0, 2];

    let lastVerification = { status: false, message: "No execution attempted." };
    let lastReqId = null;
    let lastExecutedTrade = null;

    for (const flags of flagRotation) {
      for (const typeFill of fillRotation) {
        const tradeRequest = {
          action: 200,
          login: Number(login),
          symbol,
          volume,
          typeFill,
          type,
          priceOrder: price,
          digits,
          position,
          flags,
          typeTime: 0,
        };

        const requestResult = await TradeRequestControllers.closeTrade(tradeRequest);
        if (!requestResult?.answer?.id) continue;

        lastReqId = requestResult.answer.id;
        lastExecutedTrade = await TradeRequestControllers.getExecutedTrade(lastReqId);
        lastVerification = this.verifyExecutionResult(lastExecutedTrade, lastReqId);
        if (lastVerification.status) return lastExecutedTrade;

        const retcode = String(lastExecutedTrade?.answer?.[lastReqId]?.[0]?.result?.Retcode || "");
        if (["10019", "10018", "10017", "10025", "10026", "10040"].includes(retcode)) {
          throw new Error(lastVerification.message);
        }
      }
    }

    throw new Error(lastVerification.message || `Failed to close position ${position}.`);
  }

  resolveClosePositionPayload(livePosition) {
    const symbol = normalizeString(firstDefined(livePosition.Symbol, livePosition.symbol));
    const action = toNullableNumber(firstDefined(livePosition.Action, livePosition.Type));
    const position = firstDefined(livePosition.Position, livePosition.PositionID, livePosition.Ticket);
    const digits = toNumber(firstDefined(livePosition.Digits, 2));
    const positionVolume = toNullableNumber(firstDefined(
      livePosition.VolumeCurrent,
      livePosition.Volume,
      livePosition.VolumeInitial,
      livePosition.VolumeExt
    ));

    if (!symbol) throw new Error("Position symbol is unavailable.");
    if (action === null) throw new Error("Position action is unavailable.");
    if (!position) throw new Error("Position ticket is unavailable.");
    if (!positionVolume || positionVolume <= 0) throw new Error("Position volume is unavailable.");

    return {
      symbol,
      position,
      digits,
      volume: positionVolume,
      type: action === 1 ? 0 : 1,
    };
  }

  getCloseTradeFlagRotation(executionMode) {
    const TA_FLAG_CLOSE = 1;
    const TA_FLAG_MARKET = 2;
    const numericExecutionMode = Number(executionMode);
    const preferredFlag = numericExecutionMode === 2 || numericExecutionMode === 3
      ? TA_FLAG_CLOSE | TA_FLAG_MARKET
      : TA_FLAG_CLOSE;

    return [...new Set([preferredFlag, TA_FLAG_CLOSE, TA_FLAG_CLOSE | TA_FLAG_MARKET])];
  }

  verifyExecutionResult(executedTrade, reqId) {
    if (executedTrade?.answer?.[reqId]) {
      const resultPayload = executedTrade.answer[reqId][0]?.result;
      const retcode = String(resultPayload?.Retcode || "0");
      if (!["0", "10008", "10009"].includes(retcode)) {
        return {
          status: false,
          message: this.getRetcodeMessage(retcode),
        };
      }
    }

    return { status: true };
  }

  getRetcodeMessage(retcode) {
    const retcodes = {
      "10004": "Re-quote requested by server.",
      "10006": "Trade request rejected by broker.",
      "10007": "Trade request is still processing.",
      "10008": "Order placed successfully.",
      "10009": "Trade executed successfully.",
      "10011": "Order is queued.",
      "10012": "Request accepted by dealer.",
      "10013": "Invalid trade request parameters.",
      "10014": "Order canceled by broker.",
      "10015": "Volume limit exceeded.",
      "10016": "Price is out of limits.",
      "10017": "Trading is disabled for this account.",
      "10018": "Market is closed for this symbol.",
      "10019": "Insufficient margin or account balance.",
      "10020": "Stops are too close to price.",
      "10021": "Invalid volume.",
      "10022": "Invalid price.",
      "10023": "Invalid stops.",
      "10024": "Trade not allowed for this symbol.",
      "10025": "Too many open positions.",
      "10026": "Hedges are not allowed.",
      "10027": "FIFO rule violation.",
      "10040": "Trade request rejected by the server.",
    };

    return retcodes[retcode] || `Trade execution failed (MT5 error ${retcode}).`;
  }

  logChartDataState({ activeAccounts, positionRows, dealRows, exposures, recentTrades, liveRows, freshAlerts }) {
    const nextChartState = {
      exposuresEmpty: exposures.length === 0,
      recentTradesEmpty: recentTrades.length === 0,
    };

    if (this.lastChartState.exposuresEmpty !== nextChartState.exposuresEmpty) {
      if (nextChartState.exposuresEmpty) {
        adminLogger.warn("[Risk Management] Exposure chart data is empty.", {
          trackedAccounts: activeAccounts.length,
          liveAccounts: liveRows.length,
          openPositions: positionRows.length,
          exposuresCount: exposures.length,
          reason: positionRows.length === 0
            ? "No open positions returned from MT5."
            : "Open positions were returned but no exposure buckets were built.",
        });
      } else {
        adminLogger.info("[Risk Management] Exposure chart data is available again.", {
          openPositions: positionRows.length,
          exposuresCount: exposures.length,
        });
      }
    }

    if (this.lastChartState.recentTradesEmpty !== nextChartState.recentTradesEmpty) {
      if (nextChartState.recentTradesEmpty) {
        adminLogger.warn("[Risk Management] PnL chart data is empty.", {
          trackedAccounts: activeAccounts.length,
          liveAccounts: liveRows.length,
          fetchedDeals: dealRows.length,
          recentTrades: recentTrades.length,
          reason: dealRows.length === 0
            ? "No recent MT5 deals were returned for the configured window."
            : "Deals were returned but no closed trade events were built.",
        });
      } else {
        adminLogger.info("[Risk Management] PnL chart data is available again.", {
          fetchedDeals: dealRows.length,
          recentTrades: recentTrades.length,
        });
      }
    }

    logRiskDebug("[Risk Management] Snapshot summary.", {
      trackedAccounts: activeAccounts.length,
      liveAccounts: liveRows.length,
      openPositions: positionRows.length,
      fetchedDeals: dealRows.length,
      exposuresCount: exposures.length,
      recentTrades: recentTrades.length,
      freshAlerts: freshAlerts.length,
    });

    this.lastChartState = nextChartState;
  }
}

module.exports = new RiskManagementService();
