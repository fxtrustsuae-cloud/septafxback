const { Op } = require("sequelize");
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

async function saveOrderIndatabse(loginId, groupId, level, ibId, userId) {
    try {
        const to = Math.floor(Date.now() / 1000); // current timestamp in seconds
        const from = to - 6 * 60 * 60; // (6 hours) back
        
        const response = await dealController.getDealsPage(loginId, from, to);
        const orders = response.answer;
        if(!orders) return false;
        console.log(`Fetched ${orders.length} orders.`);

        for (const order of orders) {
            if(order.Entry == 0) continue;
            const existing = await Mt5Order.findOne({ where: { PositionID: order.PositionID } });
            if (existing) {
                console.log(`Skipping duplicate PositionID: ${order.PositionID}`);
                continue;
            }

            const checkPlan = await IbComissionPlanModel.findOne({
                where: { ibId, groupId }
            });

            const input = order.Symbol;
            const { symbol: baseSymbol, extension } = splitSymbol(input);

            // console.log(order)
            const newOrder = await Mt5Order.create({
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

            console.log(`Inserted Order with PositionID: ${order.PositionID}`);
        }
        console.log(`For Login ${loginId} Order Data Saved.`);
    } catch (e) {
        console.error("Error during insert:", e.message);
    }
}

// IB-Plan and Rebate-Plan
async function mt5AccountList(userId, level, ibId, groupIds){
    try {
        const mt5List = await Mt5AccountsModel.findAll({
            where: { accountType: "REAL", userId, isDeleted: false, groupId: { [Op.in]: groupIds } }
        }); if(mt5List.length == 0) return false;

        for(const mt5Account of mt5List){
            await saveOrderIndatabse(mt5Account.Login, mt5Account.groupId, level, ibId, mt5Account.userId);
        }
        return true;
    } catch(e) {
        console.error("Fetch Mt5Account List Error:", e.message);
        return false;
    }
}

// For Global Plan
async function mt5AccountListGlobal(userId, level, ibId){
    try {
        const mt5List = await Mt5AccountsModel.findAll({
            where: { accountType: "REAL", userId, isDeleted: false }
        }); if(mt5List.length == 0) return false;

        for(const mt5Account of mt5List){
            await saveOrderIndatabse(mt5Account.Login, mt5Account.groupId, level, ibId, mt5Account.userId);
        }
        return true;
    } catch(e) {
        console.error("Fetch Mt5Account List Error:", e.message);
        return false;
    }
}


async function ibReferralList(ibId){
    try {
        const userList = [];
        await buildReferralTree(ibId, 1, userList);

        const globalGroup = await IbComissionPlanModel.findOne({
            where: { ibId, planType: "GLOBAL-MODEL", isDeleted: false }
        }); 
        
        if(globalGroup) {  // For Global remove group id 
            for(const user of userList){
                await mt5AccountListGlobal(user.id, user.level, ibId);
            }
        } else {
            const groupList = await IbComissionPlanModel.findAll({
                where: { ibId, isDeleted: false }
            }); if(groupList.length == 0) return;
            const groupIds = groupList.map(item => item.groupId);
    
            for(const user of userList){
                await mt5AccountList(user.id, user.level, ibId, groupIds);
            }
        }

        return true;
    } catch(e) {
        console.error("Fetch Mt5Account List Error:", e.message);
        return false;
    }
}

async function fetchIbList(){
    try {
        const ibList = await UserModel.findAll({
            where: { isIb: true, isDeleted: false }
        }); if(!ibList) return [];
        return ibList;
    } catch(e) {
        console.error("Fetch Ib List Error:", e.message);
        return [];
    }
};

async function orderTracking(){
    try {
        const ibList = await fetchIbList();

        for(const ib of ibList) {
            await ibReferralList(ib.id);
        }
    } catch (e) {
        console.error("Error during insert:", e.message);
    }
}

// orderTracking()
// setTimeout(orderTracking, 1 * 1000);
setInterval(orderTracking, 60 * 6 * 1000);

async function distributeComission( userId, ibPlanId, order, remainingAmount, comissionPlanDetails, fromUser, ibId, distributedAmount = 0 ) {
    try {
        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false, isComissionAllowed: false }
        }); if (!checkUser) return remainingAmount;

        // Commission row for this sub-IB
        const comissionData = await SubIbComissionModel.findOne({
            where: { ibId, ibPlanId, subIbId: userId, isDeleted: false }
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
                price: order.PriceOrder,
                volume: order.Volume,
                comissionAmount,
                ibId,
                type: order.type == 0 ? "BUY" : "SELL",
            });

            const assetData = await AssetModel.findOne({
                where: { userId, isDeleted: false }
            });

            assetData.totalIBIncome += Number(comissionAmount);
            await assetData.save();

            remainingAmount -= comissionAmount;
            newDistributedAmount += comissionAmount;
        }

        // ==== RECURSE UP THE TREE ====
        if (checkUser.fromUser) {
            return await distributeComission(checkUser.fromUser, ibPlanId, order, remainingAmount, comissionPlanDetails, fromUser, ibId, newDistributedAmount);
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
            const lot = order.Volume / 10000;
            
            const comissionData = await IbComissionPlanModel.findOne({
                where: { ibId, symbolExtension: order.extension, isDeleted: false }
            }); if(!comissionData) continue;
            const comissionAmount = comissionData.ibComission * lot;

            const orderUser = await UserModel.findByPk(order.userId);
            if(!orderUser.fromUser) continue;
            const remainingAmount = await distributeComission(orderUser.fromUser, comissionData.id, order, comissionAmount, comissionData, order.userId, ibId, 0);

            if(remainingAmount) {
                const assetData = await AssetModel.findOne({
                    where: { userId: ibId, isDeleted: false }
                });
                assetData.totalIBIncome += remainingAmount;
                await assetData.save();

                await IbcomissionTrxModel.create({
                    userId: ibId,
                    fromUser: order.userId,
                    loginId: order.Login,
                    orderId: order.id,
                    symbol: order.Symbol,
                    price: order.PriceOrder,
                    volume: order.Volume,
                    comissionAmount: remainingAmount,
                    ibId,
                    type: order.type == 0 ? "BUY" : "SELL",
                });
            }

            await Mt5Order.update({
                isComissionDistributed: true 
            }, {
                where: { id: order.id }
            });
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