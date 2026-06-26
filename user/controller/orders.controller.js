const { Op } = require("sequelize");
const sequelize = require("../../config/db.config");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const Mt5Order = require("../../models/mt5order.model");
const { buildReferralTree } = require("./user.controller");
const dealController = require("../../mt5Services/deals");
const Mt5AccountsModel = require("../../models/mt5Account.model");
const SubIbComissionModel = require("../../models/subIbComission.model");
const IbComissionPlanModel = require("../../models/ibComissionPlan.model");
const IbcomissionTrxModel = require("../../models/ibComissionTransaction.model");

function splitSymbol(symbol) {
    let index = symbol.indexOf(".");
    
    if (index === -1) {
        return { symbol, extension: "" };
    }

    return {
        symbol: symbol.substring(0, index),
        extension: symbol.substring(index) // includes the dot
    };
}

function createTrackingStats(extra = {}) {
    return {
        ibCount: 0,
        referralUserCount: 0,
        mt5AccountCount: 0,
        fetchedOrdersCount: 0,
        insertedOrdersCount: 0,
        duplicateOrdersCount: 0,
        skippedEntryOrdersCount: 0,
        missingPlanOrdersCount: 0,
        failedOrdersCount: 0,
        errors: [],
        ...extra
    };
}

function mergeTrackingStats(target, source = {}) {
    const numericKeys = [
        "ibCount",
        "referralUserCount",
        "mt5AccountCount",
        "fetchedOrdersCount",
        "insertedOrdersCount",
        "duplicateOrdersCount",
        "skippedEntryOrdersCount",
        "missingPlanOrdersCount",
        "failedOrdersCount"
    ];

    numericKeys.forEach((key) => {
        target[key] = Number(target[key] || 0) + Number(source[key] || 0);
    });

    if (Array.isArray(source.errors) && source.errors.length > 0) {
        target.errors.push(...source.errors);
    }

    return target;
}

function resolveTrackingWindow(options = {}) {
    const now = Math.floor(Date.now() / 1000);
    let to = now;
    let from = to - 6 * 60 * 60;

    if (options.toDate) {
        const end = new Date(options.toDate);
        end.setHours(23, 59, 59, 999);
        to = Math.floor(end.getTime() / 1000);
    }

    if (options.fromDate) {
        const start = new Date(options.fromDate);
        start.setHours(0, 0, 0, 0);
        from = Math.floor(start.getTime() / 1000);
    }

    return { from, to };
}

async function saveOrderIndatabse(loginId, groupId, level, ibId, userId, options = {}) {
    const stats = createTrackingStats({ loginId, groupId, userId, ibId });
    try {
        const { from, to } = resolveTrackingWindow(options);
        
        const response = await dealController.getDealsPage(loginId, from, to);
        const orders = response && response.answer;
        if(!orders) return stats;
        console.log(`Fetched ${orders.length} orders.`);
        stats.fetchedOrdersCount = orders.length;

        for (const order of orders) {
            try {
                if(order.Entry == 0) {
                    stats.skippedEntryOrdersCount++;
                    continue;
                }

                const existing = await Mt5Order.findOne({ where: { PositionID: order.PositionID } });
                if (existing) {
                    stats.duplicateOrdersCount++;
                    console.log(`Skipping duplicate PositionID: ${order.PositionID}`);
                    continue;
                }

                const checkPlan = await IbComissionPlanModel.findOne({
                    where: { ibId, groupId }
                });
                if (!checkPlan) {
                    stats.missingPlanOrdersCount++;
                    console.log(`Skipping PositionID ${order.PositionID}: no IB commission plan for IB ID=${ibId}, groupId=${groupId}`);
                    continue;
                }

                const input = order.Symbol;
                const { symbol: baseSymbol, extension } = splitSymbol(input);

                await Mt5Order.create({
                    mt5GroupId: groupId,
                    level,
                    comissionPlanId: checkPlan.id,
                    ibId,
                    userId,
                    baseSymbol,
                    extension,
                    Deal: order.Deal,
                    ExternalID: order.ExternalID,
                    Login: order.Login,
                    Dealer: order.Dealer,
                    Order: order.Order,
                    Action: order.Action,
                    Entry: order.Entry,
                    Reason: order.Reason,
                    Digits: order.Digits,
                    DigitsCurrency: order.DigitsCurrency,
                    ContractSize: order.ContractSize,
                    Time: order.Time,
                    TimeMsc: order.TimeMsc,
                    Symbol: order.Symbol,
                    Price: order.Price,
                    Volume: order.Volume,
                    VolumeExt: order.VolumeExt,
                    Profit: order.Profit,
                    Storage: order.Storage,
                    Commission: order.Commission,
                    Fee: order.Fee,
                    RateProfit: order.RateProfit,
                    RateMargin: order.RateMargin,
                    ExpertID: order.ExpertID,
                    PositionID: order.PositionID,
                    Comment: order.Comment,
                    ProfitRaw: order.ProfitRaw,
                    PricePosition: order.PricePosition,
                    PriceSL: order.PriceSL,
                    PriceTP: order.PriceTP,
                    VolumeClosed: order.VolumeClosed,
                    VolumeClosedExt: order.VolumeClosedExt,
                    TickValue: order.TickValue,
                    TickSize: order.TickSize,
                    Flags: order.Flags,
                    Gateway: order.Gateway,
                    PriceGateway: order.PriceGateway,
                    VolumeGatewayExt: order.VolumeGatewayExt,
                    ActionGateway: order.ActionGateway,
                    ModifyFlags: order.ModifyFlags,
                    Value: order.Value,
                });

                stats.insertedOrdersCount++;
                console.log(`Inserted Order with PositionID: ${order.PositionID}`);
            } catch (e) {
                stats.failedOrdersCount++;
                stats.errors.push({
                    loginId,
                    positionId: order.PositionID,
                    message: e.message
                });
                console.error("Error during order insert:", e.message);
            }
        }
        console.log(`For Login ${loginId} Order Data Saved.`);
    } catch (e) {
        stats.failedOrdersCount++;
        stats.errors.push({ loginId, message: e.message });
        console.error("Error during insert:", e.message);
    }
    return stats;
}

// IB-Plan and Rebate-Plan
async function mt5AccountList(userId, level, ibId, groupIds, options = {}){
    const stats = createTrackingStats({ userId, ibId });
    try {
        const mt5List = await Mt5AccountsModel.findAll({
            where: { accountType: "REAL", userId, isDeleted: false, groupId: { [Op.in]: groupIds } }
        }); if(mt5List.length == 0) return stats;
        stats.mt5AccountCount += mt5List.length;

        for(const mt5Account of mt5List){
            const accountStats = await saveOrderIndatabse(mt5Account.Login, mt5Account.groupId, level, ibId, mt5Account.userId, options);
            mergeTrackingStats(stats, accountStats);
        }
    } catch(e) {
        stats.failedOrdersCount++;
        stats.errors.push({ userId, ibId, message: e.message });
        console.error("Fetch Mt5Account List Error:", e.message);
    }
    return stats;
}

// For Global Plan
async function mt5AccountListGlobal(userId, level, ibId, options = {}){
    const stats = createTrackingStats({ userId, ibId });
    try {
        const mt5List = await Mt5AccountsModel.findAll({
            where: { accountType: "REAL", userId, isDeleted: false }
        }); if(mt5List.length == 0) return stats;
        stats.mt5AccountCount += mt5List.length;

        for(const mt5Account of mt5List){
            const accountStats = await saveOrderIndatabse(mt5Account.Login, mt5Account.groupId, level, ibId, mt5Account.userId, options);
            mergeTrackingStats(stats, accountStats);
        }
    } catch(e) {
        stats.failedOrdersCount++;
        stats.errors.push({ userId, ibId, message: e.message });
        console.error("Fetch Mt5Account List Error:", e.message);
    }
    return stats;
}


async function ibReferralList(ibId, options = {}){
    const stats = createTrackingStats({ ibId });
    try {
        const userList = [];
        await buildReferralTree(ibId, 1, userList);
        stats.referralUserCount = userList.length;

        const globalGroup = await IbComissionPlanModel.findOne({
            where: { ibId, planType: "GLOBAL-MODEL", isDeleted: false }
        }); 
        
        if(globalGroup) {  // For Global remove group id 
            for(const user of userList){
                const userStats = await mt5AccountListGlobal(user.id, user.level, ibId, options);
                mergeTrackingStats(stats, userStats);
            }
        } else {
            const groupList = await IbComissionPlanModel.findAll({
                where: { ibId, isDeleted: false }
            }); if(groupList.length == 0) return stats;
            const groupIds = groupList.map(item => item.groupId);
    
            for(const user of userList){
                const userStats = await mt5AccountList(user.id, user.level, ibId, groupIds, options);
                mergeTrackingStats(stats, userStats);
            }
        }
    } catch(e) {
        stats.failedOrdersCount++;
        stats.errors.push({ ibId, message: e.message });
        console.error("Fetch Mt5Account List Error:", e.message);
    }
    return stats;
}

async function fetchIbList(ibId){
    try {
        const where = { isIb: true, isDeleted: false };
        if (ibId) where.id = ibId;
        const ibList = await UserModel.findAll({
            where
        }); if(!ibList) return [];
        return ibList;
    } catch(e) {
        console.error("Fetch Ib List Error:", e.message);
        return [];
    }
};

async function orderTracking(options = {}){
    const stats = createTrackingStats({ ibResults: [] });
    try {
        const ibList = await fetchIbList(options.ibId);
        stats.ibCount = ibList.length;

        for(const ib of ibList) {
            const ibStats = await ibReferralList(ib.id, options);
            stats.ibResults.push(ibStats);
            mergeTrackingStats(stats, ibStats);
        }
    } catch (e) {
        stats.failedOrdersCount++;
        stats.errors.push({ message: e.message });
        console.error("Error during insert:", e.message);
    }
    return stats;
}

// orderTracking()
// setTimeout(orderTracking, 1 * 1000);
setInterval(orderTracking, 60 * 6 * 1000);

async function distributeComission( userId, ibPlanId, order, remainingAmount, comissionPlanDetails, fromUser, ibId, distributedAmount = 0, dbTransaction = null ) {
    try {
        const queryOptions = dbTransaction ? { transaction: dbTransaction } : {};
        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false, isComissionAllowed: false },
            ...queryOptions
        }); if (!checkUser) return remainingAmount;

        // Commission row for this sub-IB
        const comissionData = await SubIbComissionModel.findOne({
            where: { ibId, ibPlanId, subIbId: userId, isDeleted: false },
            ...queryOptions
        });

        let newDistributedAmount = distributedAmount;

        // ==== PROCESS COMMISSION FOR THIS USER ====
        if (checkUser.isSubIb && comissionData) {

            const lot = order.Volume / 10000;
            let comissionAmount = comissionData.comission * lot;

            // subtract already distributed
            comissionAmount -= distributedAmount;

            // no commission possible
            if (comissionAmount <= 0 || remainingAmount < comissionAmount) {
                return remainingAmount;
            }

            await IbcomissionTrxModel.create({
                userId,
                fromUser,
                loginId: order.Login,
                orderId: order.id,
                symbol: order.Symbol,
                price: order.Price,
                volume: order.Volume,
                comissionAmount,
                ibId,
                type: (order.Action == 0 || order.Action == "0" || order.type == 0) ? "BUY" : "SELL",
            }, queryOptions);

            const assetData = await AssetModel.findOne({
                where: { userId, isDeleted: false },
                ...queryOptions
            });
            if (!assetData) {
                throw new Error(`Asset wallet not found for sub-IB User ID=${userId}`);
            }

            assetData.totalIBIncome = Number(assetData.totalIBIncome || 0) + Number(comissionAmount);
            await assetData.save(queryOptions);

            remainingAmount -= comissionAmount;
            newDistributedAmount += comissionAmount;
        }

        // ==== RECURSE UP THE TREE ====
        if (checkUser.fromUser) {
            return await distributeComission(checkUser.fromUser, ibPlanId, order, remainingAmount, comissionPlanDetails, fromUser, ibId, newDistributedAmount, dbTransaction);
        }

        return remainingAmount;

    } catch (e) {
        console.log("Error while Rebat comission Distribution", e);
        return false;
    }
}

async function comissionDetails(ibId){
    try {
        // Plan list
        const ibComGrpList = await IbComissionPlanModel.findAll({
            where: { ibId, isDeleted: false }
        }); if(ibComGrpList.length == 0) return; 

        let symbols = [];
        ibComGrpList.forEach(group => {
            const metals = Array.isArray(group.cfdMetals) ? group.cfdMetals : [];
            const fx = Array.isArray(group.cfdFx) ? group.cfdFx : [];
            const allSymbols = [...metals, ...fx];
        
            allSymbols.forEach(sym => {
                if (group.symbolExtension) {
                    symbols.push(`${sym}${group.symbolExtension}`);
                } else {
                    symbols.push(sym); // no extension if empty
                }
            });
        });

        const sixHoursBack = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const orderList = await Mt5Order.findAll({
            where: { ibId, isDeleted: false, isComissionDistributed: false, 
                Symbol: { [Op.in]: symbols }, 
                createdAt: { [Op.gte]: sixHoursBack } 
            }
        }); if(orderList.length == 0) return false;

        for(const order of orderList){
            try {
                await sequelize.transaction(async (dbTransaction) => {
                    const currentOrder = await Mt5Order.findByPk(order.id, { transaction: dbTransaction });
                    if (!currentOrder || currentOrder.isDeleted || currentOrder.isComissionDistributed) return;

                    const existingTrxCount = await IbcomissionTrxModel.count({
                        where: { ibId, orderId: currentOrder.id, isDeleted: false },
                        transaction: dbTransaction
                    });
                    if (existingTrxCount > 0) {
                        await currentOrder.update({ isComissionDistributed: true }, { transaction: dbTransaction });
                        return;
                    }

                    const lot = Number(currentOrder.Volume) / 10000;

                    const comissionData = await IbComissionPlanModel.findOne({
                        where: { ibId, symbolExtension: currentOrder.extension, isDeleted: false },
                        transaction: dbTransaction
                    }); if(!comissionData) return;
                    const comissionAmount = Number(comissionData.ibComission || 0) * lot;
                    if (!Number.isFinite(comissionAmount) || comissionAmount <= 0) return;

                    const orderUser = await UserModel.findByPk(currentOrder.userId, { transaction: dbTransaction });
                    if(!orderUser || !orderUser.fromUser) return;
                    const remainingAmount = await distributeComission(orderUser.fromUser, comissionData.id, currentOrder, comissionAmount, comissionData, currentOrder.userId, ibId, 0, dbTransaction);
                    if (remainingAmount === false) {
                        throw new Error(`Sub-IB commission distribution failed for order ID=${currentOrder.id}`);
                    }

                    if(Number(remainingAmount) > 0) {
                        const assetData = await AssetModel.findOne({
                            where: { userId: ibId, isDeleted: false },
                            transaction: dbTransaction
                        });
                        if (!assetData) {
                            throw new Error(`Asset wallet not found for master IB ID=${ibId}`);
                        }
                        assetData.totalIBIncome = Number(assetData.totalIBIncome || 0) + Number(remainingAmount);
                        await assetData.save({ transaction: dbTransaction });

                        await IbcomissionTrxModel.create({
                            userId: ibId,
                            fromUser: currentOrder.userId,
                            loginId: currentOrder.Login,
                            orderId: currentOrder.id,
                            symbol: currentOrder.Symbol,
                            price: currentOrder.Price,
                            volume: currentOrder.Volume,
                            comissionAmount: remainingAmount,
                            ibId,
                            type: (currentOrder.Action == 0 || currentOrder.Action == "0" || currentOrder.type == 0) ? "BUY" : "SELL",
                        }, { transaction: dbTransaction });
                    }

                    const createdTrxCount = await IbcomissionTrxModel.count({
                        where: { ibId, orderId: currentOrder.id, isDeleted: false },
                        transaction: dbTransaction
                    });
                    if (createdTrxCount > 0) {
                        await currentOrder.update({ isComissionDistributed: true }, { transaction: dbTransaction });
                    }
                });
            } catch (e) {
                console.log(`Error while distributing IB commission for order ID=${order.id}`, e);
            }
        }
    } catch (e) {
        console.log("error", e)
    }
}

async function initComission(){
    try {
        const ibList = await fetchIbList();
        
        console.log("Comission Distribution started....");
        if (ibList && Array.isArray(ibList)) {
            for(const ib of ibList) {
                await comissionDetails(ib.id);
            }
        }
        console.log("Comission Distribution end.");
    } catch (e) {
        console.log("Error: While IB comission Distribution", e.message);
    }
}

// initComission()
// setTimeout(initComission, 1 * 1000);
setInterval(initComission, 9 * 60 * 1000);

module.exports = {
    orderTracking,
};
