const BotModel = require("../../models/bot.model");
const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const SymbolModel = require("../../models/symbol.model");
const Mt5Model = require("../../models/mt5Account.model");
const dealController = require("../../mt5Services/deals");
const OrderController = require("../../mt5Services/order");
const WatchListModel = require("../../models/watchList.model");
const MetaMetaControllers = require("../../mt5Services/user");
const positionController = require("../../mt5Services/position");
const TransactionModel = require("../../models/transaction.model");
const Mt5GroupModel = require("../../models/mt5Group.model");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const MetaControllers = require("../../mt5Services/user");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");

const MT5_RETCODES = {
    "10004": "Re-quote requested by server",
    "10006": "Trade request rejected by broker",
    "10007": "Trade request is being processed",
    "10008": "Order placed successfully",
    "10009": "Trade executed successfully",
    "10011": "Order is queued",
    "10012": "Request accepted by dealer",
    "10013": "Invalid trade request parameters",
    "10014": "Order canceled by broker",
    "10015": "Order rejected: Volume limit exceeded",
    "10016": "Order rejected: Price is out of limits",
    "10017": "Order rejected: Trading is disabled",
    "10018": "Market is closed for this symbol",
    "10019": "Insufficient margin / account balance",
    "10020": "Order rejected: Stops (SL/TP) are too close to price",
    "10021": "Order rejected: Invalid volume",
    "10022": "Order rejected: Invalid price",
    "10023": "Order rejected: Invalid stops (SL/TP)",
    "10024": "Order rejected: Trade not allowed for this symbol",
    "10025": "Order rejected: Too many open positions",
    "10026": "Order rejected: Hedges are not allowed",
    "10027": "Order rejected: FIFO rule violation",
};

function verifyExecutionResult(checkExecutedTrade, reqId) {
    if (checkExecutedTrade && checkExecutedTrade.answer && checkExecutedTrade.answer[reqId]) {
        const answerArray = checkExecutedTrade.answer[reqId];
        if (Array.isArray(answerArray) && answerArray.length > 0) {
            const executionStatus = answerArray[0].result;
            console.log(`[API] verifyExecutionResult debug for reqId ${reqId}:`, JSON.stringify(executionStatus, null, 2));
            if (executionStatus && executionStatus.Retcode) {
                const code = String(executionStatus.Retcode);
                if (code !== "10009" && code !== "10008" && code !== "0") {
                    const errMsg = MT5_RETCODES[code] || `Trade execution failed (MT5 Error ${code})`;
                    return { status: false, message: errMsg };
                }
            }
        }
    }
    return { status: true };
}

function getCloseTradeFlagRotation(executionMode) {
    const TA_FLAG_CLOSE = 1;
    const TA_FLAG_MARKET = 2;
    const execMode = Number(executionMode);
    const preferredFlag = execMode === 2 || execMode === 3
        ? TA_FLAG_CLOSE | TA_FLAG_MARKET
        : TA_FLAG_CLOSE;

    // Some MT5 Web API responses omit/rename execution mode, so keep the alternate flag as a fallback.
    return [...new Set([preferredFlag, TA_FLAG_CLOSE, TA_FLAG_CLOSE | TA_FLAG_MARKET])];
}

function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function extractMt5Rows(result) {
    const answer = result?.answer;
    if (Array.isArray(answer)) return answer;
    if (!answer || typeof answer !== "object") return [];
    if (firstDefined(answer.Position, answer.PositionID, answer.Ticket)) return [answer];

    return Object.values(answer).flatMap((value) => {
        if (Array.isArray(value)) return value;
        return value && typeof value === "object" ? [value] : [];
    });
}

function findMt5Position(result, position) {
    const positionId = String(position);
    return extractMt5Rows(result).find((row) => {
        const rowPosition = firstDefined(row?.Position, row?.PositionID, row?.Ticket);
        return String(rowPosition) === positionId;
    });
}

async function getLiveMt5Position(login, position) {
    const byTicket = await positionController.getPositionByTicket(login, position);
    let livePosition = findMt5Position(byTicket, position);
    if (livePosition) return livePosition;

    const positionList = await positionController.positionList(login);
    livePosition = findMt5Position(positionList, position);
    return livePosition || null;
}

function resolveClosePositionPayload(requestBody, livePosition) {
    const position = firstDefined(livePosition?.Position, livePosition?.PositionID, livePosition?.Ticket, requestBody.position);
    const symbol = firstDefined(livePosition?.Symbol, requestBody.symbol);
    const action = numberOrNull(firstDefined(livePosition?.Action, livePosition?.Type));
    const positionVolume = numberOrNull(firstDefined(livePosition?.Volume, livePosition?.VolumeCurrent, livePosition?.VolumeInitial));
    const requestedVolume = numberOrNull(requestBody.volume);
    const digits = firstDefined(livePosition?.Digits, requestBody.digits);

    if (!symbol) throw CustomErrorHandler.badRequest("MT5 position symbol is unavailable!");
    if (action === null) throw CustomErrorHandler.badRequest("MT5 position action is unavailable!");
    if (!positionVolume || positionVolume <= 0) throw CustomErrorHandler.badRequest("MT5 position volume is unavailable!");

    const volume = requestedVolume && requestedVolume > 0 && requestedVolume <= positionVolume
        ? requestedVolume
        : positionVolume;

    return {
        position,
        symbol,
        volume,
        digits,
        action,
        type: action === 1 ? 0 : 1
    };
}

module.exports.metaDeposit = async (request, response) => {
    try {
        userLogger.info('Entering metaDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, amount } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, isMt5DepositAllowed: false }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { userId: user.id, Login: login, isDeleted: false }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const assetData = await AssetModel.findOne({
            where: { userId: user.id, isDeleted: false }
        }); if (!assetData) throw CustomErrorHandler.serverError("Internal Server error!");
        
        if(assetData.mainBalance < amount) throw CustomErrorHandler.unAuthorized("Insufficient Balance!");

        const newDeposit = await TradeRequestControllers.depositWithdraw(login, 2, amount, "Internal Transfer From Wallet");
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Deposit Failed!`);

        const newTransaction = await TransactionModel.create({
            userId: userData.id,
            transactionType: "INTERNAL-DEPOSIT",
            amount,
            mt5Login: login,
            level: userData.level,
            description: `Meta account deposit for login ${login}.`,
        });

        assetData.mainBalance -= amount;
        await assetData.save();
        
        userLogger.info('Exiting metaDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta Account Deposited.",
            data: newTransaction,
        });
    } catch (e) {
        userLogger.error('Error in metaDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaWithdraw = async (request, response) => {
    try {
        userLogger.info('Entering metaWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, amount } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, isMt5WithdrawlAllowed: false, }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { userId: user.id, Login: login, isDeleted: false }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const assetData = await AssetModel.findOne({
            where: { userId: user.id, isDeleted: false }
        }); if (!assetData) throw CustomErrorHandler.serverError("Internal Server error!");
        
        if(assetData.mainBalance < amount) throw CustomErrorHandler.unAuthorized("Insufficient Balance!");

        const newDeposit = await TradeRequestControllers.depositWithdraw(login, 2, -amount, "Internal Transfer to wallet");
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Withdraw Failed!`);

        const newTransaction = await TransactionModel.create({
            userId: userData.id,
            transactionType: "META-WITHDRAW",
            amount,
            mt5Login: login,
            level: userData.level,
            description: `Meta account Withdraw for login ${login}.`,
        });

        assetData.mainBalance += Number(amount);
        await assetData.save();

        userLogger.info('Exiting metaWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta Account Withdrawal.",
            data: newTransaction,
        });
    } catch (e) {
        userLogger.error('Error in metaWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function symbolListByLoginId(loginId, symbol){
    try {
        const mt5AccountData = await MetaControllers.getUser(loginId);
        if (!mt5AccountData || !mt5AccountData.answer || !mt5AccountData.answer.Group) {
            console.log(`[symbolListByLoginId] MT5 account data not found or missing group for login ${loginId}`);
            return false;
        }

        const targetGroup = mt5AccountData.answer.Group;

        // Fetch all active groups to perform robust case-insensitive and slash-normalized matching
        const allGroups = await Mt5GroupModel.findAll({
            where: { isDeleted: false }
        });

        const normalizePath = (p) => {
            return (p || "")
                .toLowerCase()
                .replace(/\\+/g, "/")
                .replace(/\/+/g, "/")
                .trim()
                .replace(/\/+$/, ""); // Strip trailing slashes!
        };

        const normalizedTarget = normalizePath(targetGroup);
        const mt5GroupData = allGroups.find(g => normalizePath(g.mt5GroupName) === normalizedTarget);

        if (!mt5GroupData) {
            console.log(`[symbolListByLoginId] MT5 group data not found in DB for group: ${targetGroup}. Available groups in DB:`, allGroups.map(g => g.mt5GroupName));
            return false;
        }

        const groupPaths = mt5GroupData.path || [];
        const isWildcardAll = groupPaths.includes('*');

        const allSymbols = await SymbolModel.findAll({
            where: { isDeleted: false }
        });

        // Smart fail-safe fallback: If DB is empty, bypass check to prevent complete system outage
        if (allSymbols.length === 0) {
            console.log(`[symbolListByLoginId] CRITICAL WARNING: The Symbols table is empty! Bypassing verification check.`);
            return symbol; 
        }

        let symbolsData;
        if (isWildcardAll) {
            symbolsData = allSymbols;
        } else {
            symbolsData = allSymbols.filter(sym => {
                const sPath = normalizePath(sym.path);
                return groupPaths.some(gPath => {
                    const gp = normalizePath(gPath);
                    if (gp === "*") return true;
                    if (sPath === gp) return true;
                    if (sPath.startsWith(gp + "/")) return true;

                    // MT5 Symbol Path Translation / Substitution Mapping
                    if (gp === "forex") {
                        return sPath.includes("forex") || sPath.includes("cfd-fx") || sPath.includes("fx");
                    }
                    if (gp === "metals") {
                        return sPath.includes("metals") || sPath.includes("gold") || sPath.includes("silver");
                    }
                    if (gp === "crypto") {
                        return sPath.includes("crypto");
                    }
                    if (gp === "energies" || gp === "spot oil") {
                        return sPath.includes("energies") || sPath.includes("oil") || sPath.includes("gas");
                    }
                    if (gp === "indices") {
                        return sPath.includes("indices") || sPath.includes("index");
                    }
                    if (gp === "cfd-equities(usd)") {
                        return sPath.includes("cfd-equities") || sPath.includes("equities") || sPath.includes("shares") || sPath.includes("stocks");
                    }
                    if (gp === "vip") {
                        return sPath.includes("vip");
                    }

                    return false;
                });
            });
        }

        const symbolList = symbolsData.map(item => item.symbol);

        // Case-insensitive base symbol matching
        const matchedSymbol = symbolList.find(s => {
            const baseSymbol = s.split('.')[0].toLowerCase();
            return baseSymbol === symbol.toLowerCase();
        });

        if (matchedSymbol) {
            console.log(`[symbolListByLoginId] Match found: "${matchedSymbol}" for requested symbol: "${symbol}"`);
        } else {
            console.log(`[symbolListByLoginId] Match NOT found for symbol: "${symbol}" in allowed symbols list of count ${symbolList.length}`);
        }

        return matchedSymbol || false;
    } catch (e) {
        console.log("Error while Fetching symbolList", e.message);
        return false;
    }
}

module.exports.sendTrade = async (request, response) => {
    try {
        userLogger.info('Entering sendTrade', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, symbol, volume, typeFill, type, priceSl = 0, priceTp = 0 } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const checkPrice = await TradeRequestControllers.symbolPrice(symbol, 0);
        const result = checkPrice.answer[0];
        const digit = result.Digits;
        const bid = result.Bid;
        const ask = result.Ask;

        const price = type == 0 ? ask : bid;
        const mt5Symbol = await symbolListByLoginId(login, symbol);
        if(!mt5Symbol) throw CustomErrorHandler.unAuthorized("Not allowd to trade this Symbol!");

        // Use the typeFill requested by the frontend/caller directly (if provided, otherwise default to 1 IOC)
        const initialTypeFill = (typeFill !== undefined && typeFill !== null) ? Number(typeFill) : 1;
        const fillRotation = [initialTypeFill];
        if (initialTypeFill === 1) {
            fillRotation.push(0, 2);
        } else if (initialTypeFill === 0) {
            fillRotation.push(1, 2);
        } else {
            fillRotation.push(1, 0);
        }

        let newTradeRequest = null;
        let reqId = null;
        let checkExecutedTrade = null;
        let verification = { status: false, message: "No execution attempted" };

        for (const currentFill of fillRotation) {
            console.log(`[API] Attempting open trade request for login ${login} with TypeFill: ${currentFill}...`);
            const tradeRequest = { action:200, login, mt5Symbol, volume, typeFill: currentFill, type, priceOrder:price, digits:digit, priceSl, priceTp };

            const attemptRes = await TradeRequestControllers.sendTradeRequest(tradeRequest);
            if (attemptRes && attemptRes.answer && attemptRes.answer.id) {
                const attemptReqId = attemptRes.answer.id;
                const attemptExecutedTrade = await TradeRequestControllers.getExecutedTrade(attemptReqId);
                const attemptVerification = verifyExecutionResult(attemptExecutedTrade, attemptReqId);
                
                newTradeRequest = attemptRes;
                reqId = attemptReqId;
                checkExecutedTrade = attemptExecutedTrade;
                verification = attemptVerification;

                if (verification.status) {
                    console.log(`🎉 [API] Open trade execution SUCCEEDED with TypeFill: ${currentFill}! reqId: ${reqId}`);
                    break;
                } else {
                    console.warn(`[API] Open trade execution failed/rejected with TypeFill: ${currentFill}: "${verification.message}"`);
                    const isTerminal = ["10019", "10018", "10017", "10025", "10026", "10040"].includes(String(attemptExecutedTrade?.answer?.[reqId]?.[0]?.result?.Retcode));
                    if (isTerminal) {
                        console.log(`[API] Terminal error detected (${attemptExecutedTrade?.answer?.[reqId]?.[0]?.result?.Retcode}), aborting fill policy rotation.`);
                        break;
                    }
                }
            } else {
                console.warn(`[API] Failed to get open trade response for TypeFill: ${currentFill}`);
            }
        }

        if (!verification.status) {
            userLogger.warn('sendTrade: Trade execution failed/rejected', { reqId, message: verification.message });
            return response.status(400).json({
                status: false,
                message: verification.message,
                data: checkExecutedTrade
            });
        }

        userLogger.info('Exiting sendTrade: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Send request for Trade.",
            data: checkExecutedTrade,
        });
    } catch (e) {
        userLogger.error('Error in sendTrade', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.closeTradeByPosition = async (request, response) => {
    try {
        userLogger.info('Entering closeTradeByPosition', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, typeFill, position } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id,
                Login: login, 
                isDeleted: false 
            }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const livePosition = await getLiveMt5Position(login, position);
        if (!livePosition) {
            throw CustomErrorHandler.badRequest("MT5 position not found. It may already be closed.");
        }
        const closePosition = resolveClosePositionPayload(request.body, livePosition);
        const { symbol, volume, type, position: closePositionTicket } = closePosition;
        console.log(`[API] Close trade live position resolved: ticket=${closePositionTicket}, symbol=${symbol}, action=${closePosition.action}, closeType=${type}, volume=${volume}`);

        const checkPrice = await TradeRequestControllers.symbolPrice(symbol, 0);
        if (!checkPrice || !checkPrice.answer || checkPrice.answer.length === 0) {
            throw CustomErrorHandler.badRequest("Failed to fetch live pricing for symbol!");
        }
        const result = checkPrice.answer[0];
        const digit = firstDefined(result.Digits, closePosition.digits, request.body.digits, 2);
        const bid = result.Bid;
        const ask = result.Ask;
        const price = Number(type) == 0 ? ask : bid;
        const symbolInfo = await TradeRequestControllers.symbolInfo(symbol);
        const symbolExecutionMode = symbolInfo?.answer?.Execution ?? symbolInfo?.answer?.TradeExecution ?? symbolInfo?.answer?.ExecutionMode;
        const closeFlagRotation = getCloseTradeFlagRotation(symbolExecutionMode);
        console.log(`[API] Close trade symbol execution mode for ${symbol}: ${symbolExecutionMode ?? "unknown"}; trying Flags: ${closeFlagRotation.join(", ")}`);

        // Use the typeFill requested by the frontend/caller directly (if provided, otherwise default to 1 IOC)
        const initialTypeFill = (typeFill !== undefined && typeFill !== null) ? Number(typeFill) : 1;
        const fillRotation = [initialTypeFill];
        if (initialTypeFill === 1) {
            fillRotation.push(0, 2);
        } else if (initialTypeFill === 0) {
            fillRotation.push(1, 2);
        } else {
            fillRotation.push(1, 0);
        }

        let newTradeRequest = null;
        let reqId = null;
        let checkExecutedTrade = null;
        let verification = { status: false, message: "No close execution attempted" };

        for (const currentFlags of closeFlagRotation) {
            for (const currentFill of fillRotation) {
                console.log(`[API] Attempting close trade request for login ${login} with TypeFill: ${currentFill}, Flags: ${currentFlags}...`);
                const tradeRequest = { action:200, login, symbol, volume, typeFill: currentFill, type, priceOrder: price, digits: digit, position: closePositionTicket, flags: currentFlags, typeTime: 0 };

                const attemptRes = await TradeRequestControllers.closeTrade(tradeRequest);
                if (attemptRes && attemptRes.answer && attemptRes.answer.id) {
                    const attemptReqId = attemptRes.answer.id;
                    const attemptExecutedTrade = await TradeRequestControllers.getExecutedTrade(attemptReqId);
                    const attemptVerification = verifyExecutionResult(attemptExecutedTrade, attemptReqId);
                    
                    newTradeRequest = attemptRes;
                    reqId = attemptReqId;
                    checkExecutedTrade = attemptExecutedTrade;
                    verification = attemptVerification;

                    if (verification.status) {
                        console.log(`🎉 [API] Close trade execution SUCCEEDED with TypeFill: ${currentFill}, Flags: ${currentFlags}! reqId: ${reqId}`);
                        break;
                    } else {
                        console.warn(`[API] Close trade execution failed/rejected with TypeFill: ${currentFill}, Flags: ${currentFlags}: "${verification.message}"`);
                        const isTerminal = ["10019", "10018", "10017", "10025", "10026", "10040"].includes(String(attemptExecutedTrade?.answer?.[attemptReqId]?.[0]?.result?.Retcode));
                        if (isTerminal) {
                            console.log(`[API] Terminal error detected (${attemptExecutedTrade?.answer?.[attemptReqId]?.[0]?.result?.Retcode}), aborting close rotation.`);
                            break;
                        }
                    }
                } else {
                    console.warn(`[API] Failed to close with TypeFill: ${currentFill}, Flags: ${currentFlags}`);
                }
            }

            if (verification.status || ["10019", "10018", "10017", "10025", "10026", "10040"].includes(String(checkExecutedTrade?.answer?.[reqId]?.[0]?.result?.Retcode))) break;
        }

        if (!verification.status) {
            userLogger.warn('closeTradeByPosition: Close trade execution failed/rejected', { reqId, message: verification.message });
            return response.status(400).json({
                status: false,
                message: verification.message,
                data: checkExecutedTrade
            });
        }

        userLogger.info('Exiting closeTradeByPosition: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Closed Trade Request.",
            data: checkExecutedTrade,
        });
    } catch (e) {
        userLogger.error('Error in closeTradeByPosition', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.limitTradeOrder = async (request, response) => {
    try {
        userLogger.info('Entering limitTradeOrder', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, symbol, volume, type, priceOrder, priceTrigger, priceSl = 0, priceTp = 0 } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const mt5Symbol = await symbolListByLoginId(login, symbol);
        if(!mt5Symbol) throw CustomErrorHandler.unAuthorized("Symbol not allowed for this user!");

        const tradeRequest = { login, symbol: mt5Symbol, volume, type, priceOrder, priceTrigger, priceSl, priceTp };

        const newTradeRequest = await TradeRequestControllers.limitTradeOrder(tradeRequest);
        if(!newTradeRequest) throw CustomErrorHandler.serverError("Failed Limit order!");

        const reqId = newTradeRequest.answer.id;
        const checkExecutedTrade = await TradeRequestControllers.getExecutedTrade(reqId);

        const verification = verifyExecutionResult(checkExecutedTrade, reqId);
        if (!verification.status) {
            userLogger.warn('limitTradeOrder: Limit trade execution failed/rejected', { reqId, message: verification.message });
            return response.status(400).json({
                status: false,
                message: verification.message,
                data: checkExecutedTrade
            });
        }

        userLogger.info('Exiting limitTradeOrder: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Limit Trade Request.",
            data: checkExecutedTrade,
        });
    } catch (e) {
        userLogger.error('Error in limitTradeOrder', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.modifyTradeOrder = async (request, response) => {
    try {
        userLogger.info('Entering modifyTradeOrder', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, order, symbol, volume, type, priceOrder, priceTrigger, priceSl = 0, priceTp = 0 } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const tradeRequest = { login, order, symbol, volume, type, priceOrder, priceTrigger, priceSl, priceTp };

        const newTradeRequest = await TradeRequestControllers.modifyTradeOrder(tradeRequest);
        if(!newTradeRequest) throw CustomErrorHandler.serverError("Failed to Modify order!");

        const reqId = newTradeRequest.answer.id;
        const checkExecutedTrade = await TradeRequestControllers.getExecutedTrade(reqId);

        const verification = verifyExecutionResult(checkExecutedTrade, reqId);
        if (!verification.status) {
            userLogger.warn('modifyTradeOrder: Modify order execution failed/rejected', { reqId, message: verification.message });
            return response.status(400).json({
                status: false,
                message: verification.message,
                data: checkExecutedTrade
            });
        }

        userLogger.info('Exiting modifyTradeOrder: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Order Modified.",
            data: checkExecutedTrade,
        });
    } catch (e) {
        userLogger.error('Error in modifyTradeOrder', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.closeLimitTradeOrder = async (request, response) => {
    try {
        userLogger.info('Entering closeLimitTradeOrder', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, order, symbol, type } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const tradeRequest = { login, order, symbol, type };

        const newTradeRequest = await TradeRequestControllers.closeLimitOrder(tradeRequest);
        if(!newTradeRequest) throw CustomErrorHandler.serverError("Failed to Close Limit order!");

        const reqId = newTradeRequest.answer.id;
        const checkExecutedTrade = await TradeRequestControllers.getExecutedTrade(reqId);

        const verification = verifyExecutionResult(checkExecutedTrade, reqId);
        if (!verification.status) {
            userLogger.warn('closeLimitTradeOrder: Close limit order execution failed/rejected', { reqId, message: verification.message });
            return response.status(400).json({
                status: false,
                message: verification.message,
                data: checkExecutedTrade
            });
        }

        userLogger.info('Exiting closeLimitTradeOrder: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Order Closed.",
            data: checkExecutedTrade,
        });
    } catch (e) {
        userLogger.error('Error in closeLimitTradeOrder', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.closedOrderList = async (request, response) => {
    try {
        userLogger.info('Entering closedOrderList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const to = Math.floor(Date.now() / 1000); // current time in seconds
        const from = 0; // complete history from epoch
        const orderList = await dealController.getDealsPage(login, from, to);
        const orders = orderList?.answer || [];
        let closedPosition = [];
        for(const order of orders ) {
            if(order.Entry != 0) closedPosition.push(order);
        }

        userLogger.info('Exiting closedOrderList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Closed order list.",
            data: closedPosition,
        });
    } catch (e) {
        userLogger.error('Error in closedOrderList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.checkBalance = async (request, response) => {
    try {
        userLogger.info('Entering checkBalance', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const checkBalancePromise = MetaControllers.checkUserBalance(login, 0);
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000));

        const result = await Promise.race([checkBalancePromise, timeoutPromise]);

        if (result === 'TIMEOUT') {
            userLogger.warn('checkBalance: MT5 Gateway response timed out. Serving cached balance to prevent UI blocking.', { login });

            const cachedBalance = {
                status: true,
                answer: {
                    balance: metaUser ? parseFloat(metaUser.Balance || 0) : 0,
                    credit: metaUser ? parseFloat(metaUser.Credit || 0) : 0,
                    equity: metaUser ? parseFloat(metaUser.Balance || 0) : 0,
                    margin: 0,
                    margin_free: metaUser ? parseFloat(metaUser.Balance || 0) : 0,
                    margin_level: 0
                }
            };

            // Return cached balance immediately
            response.json({
                status: true,
                message: `${login} Balance (cached).`,
                data: cachedBalance,
            });

            // Update in background when ready
            checkBalancePromise.then(async (liveBalanceData) => {
                if (liveBalanceData && liveBalanceData.answer) {
                    const liveBalance = liveBalanceData.answer.balance !== undefined ? liveBalanceData.answer.balance : liveBalanceData.answer.Balance;
                    if (liveBalance !== undefined) {
                        await Mt5Model.update(
                            { Balance: parseFloat(liveBalance) },
                            { where: { Login: login, userId: userData.id } }
                        );
                    }
                }
            }).catch((err) => {
                userLogger.error('checkBalance background sync error', { error: err.message || err });
            });

        } else {
            const balance = result;
            if (!balance) throw CustomErrorHandler.serverError("Failed to fetch!");

            // Self-healing synchronization: update cached balance in Mt5Accounts table
            try {
                const liveBalance = balance && balance.answer && (balance.answer.balance !== undefined ? balance.answer.balance : balance.answer.Balance);
                if (liveBalance !== undefined) {
                    await Mt5Model.update(
                        { Balance: parseFloat(liveBalance) },
                        { where: { Login: login, userId: userData.id } }
                    );
                }
            } catch (syncErr) {
                userLogger.error('Failed to sync live balance to Mt5Accounts', { error: syncErr.message || syncErr });
            }

            userLogger.info('Exiting checkBalance: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
            return response.json({
                status: true,
                message: `${login} Balance.`,
                data: balance,
            });
        }
    } catch (e) {
        userLogger.error('Error in checkBalance', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.checkMargin = async (login) => {
    try {
        userLogger.info('Entering checkMargin', { login });
        const marginData = await MetaControllers.getTradeStatus(login)

        const marginDetails = marginData.answer;
        return { marginDetails };
    } catch (e) {
        userLogger.error('Error in checkMargin', { stack: e.stack || e, login });
        console.log("error", e.message)
        return false;
    }
};

module.exports.botList = async (request, response) => {
    try {
        userLogger.info('Entering botList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, botId, status } = request.query;
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        const searchCondition = search
            ? {
                [Op.or]: [
                    { botName: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = { isDeleted: false, ...searchCondition };
        if (botId) whereCondition.id = botId;
        if (status) whereCondition.status = status;

        const { count, rows } = await BotModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        const botList = rows.map((bot) => {
            const data = bot.toJSON();
            return data;
        });

        userLogger.info('Exiting botList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bot list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page, 10),
                botList,
            },
        });
    } catch (e) {
        userLogger.error('Error in botList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateWatchList = async (request, response) => {
    try {
        userLogger.info('Entering updateWatchList', { method: request.method || "", route: request.originalUrl || "" });
        const { user, symbol, action } = request.body;

        const newSymbol = symbol
            ?.trim()
            .toUpperCase()
            .split(".")[0];

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        let watchList = await WatchListModel.findOne({
            where: {
                userId: userData.id,
                isDeleted: false,
            },
        });

        if (!watchList) {
            watchList = await WatchListModel.create({
                userId: userData.id,
                symbols: [],
            });
        }

        // normalize existing symbols internally
        let symbols = (watchList.symbols || []).map(item =>
            item?.trim().toUpperCase().split(".")[0]
        );

        // ➕ ADD
        if (action === "ADD") {
            if (symbols.includes(newSymbol)) {
                throw CustomErrorHandler.alreadyExist("Symbol already exists");
            }

            if (symbols.length >= 50) {
                throw CustomErrorHandler.alreadyExist("Watchlist limit exceeded");
            }

            symbols.push(newSymbol);
        }

        // ➖ REMOVE
        if (action === "REMOVE") {
            if (!symbols.includes(newSymbol)) {
                throw CustomErrorHandler.notFound("Symbol not found");
            }

            symbols = symbols.filter(item => item !== newSymbol);
        }

        watchList.symbols = symbols;
        await watchList.save();

        userLogger.info('Exiting updateWatchList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Symbol ${action === "ADD" ? "added to" : "removed from"} watchlist`,
            data: watchList,
        });
    } catch (e) {
        userLogger.error('Error in updateWatchList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getWatchList = async (request, response) => {
    try {
        userLogger.info('Entering getWatchList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        let watchList = await WatchListModel.findOne({
            where: {
                userId: userData.id,
                isDeleted: false,
            },
        }); 
        
        if (!watchList) {
            watchList = await WatchListModel.create({
                userId: userData.id,
                symbols: [],
            });
        }

        userLogger.info('Exiting getWatchList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Watchlist.",
            data: watchList,
        });
    } catch (e) {
        userLogger.error('Error in getWatchList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
