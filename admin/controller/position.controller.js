const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const Mt5Model = require("../../models/mt5Account.model");
const dealController = require("../../mt5Services/deals");
const PositionControllers = require("../../mt5Services/position");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.getSymbolPosition = async (request, response) => {
    try {
        adminLogger.info('Entering getSymbolPosition', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, symbol } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");


        const symbolPositionList = await PositionControllers.getPositionBySymbol(login, symbol);
        if(!symbolPositionList) throw CustomErrorHandler.serverError(`Failed to Fetch ${symbol} Positions!`);

        adminLogger.info('Exiting getSymbolPosition: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: symbolPositionList,
        });
    } catch (e) {
        adminLogger.error('Error in getSymbolPosition', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.positionList = async (request, response) => {
    try {
        adminLogger.info('Entering positionList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, page = 1, limit = 10 } = request.query;
    
        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        // Calculate pagination parameters
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        if (pageNum < 1 || limitNum < 1) {
            throw CustomErrorHandler.badRequest("Invalid page or limit parameters!");
        }
        const offset = (pageNum - 1) * limitNum;
    
        // Fetch paginated position list
        const positionList = await PositionControllers.getPositionList(login, offset, limitNum);
        if (!positionList) {
            throw CustomErrorHandler.serverError("Failed to fetch position list!");
        }
    
        adminLogger.info('Exiting positionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Position list fetched successfully.",
            data: positionList,
            pagination: {
                page: pageNum,
                limit: limitNum,
                offset: offset,
            },
        });
    } catch (e) {
        adminLogger.error('Error in positionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
      console.error(`[API] Error fetching position list: ${e.message}`);
      handleErrorResponse(e, response);
    }
};

module.exports.getOpenOrderList = async (request, response) => {
    try {
        adminLogger.info('Entering getOpenOrderList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { logins, groups, tickets, symbols } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const orders = await PositionControllers.openOrderList(logins, groups, tickets, symbols);
        if(!orders) throw CustomErrorHandler.serverError(`Failed to Fetch Orders!`);

        adminLogger.info('Exiting getOpenOrderList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Order list.",
            data: orders,
        });
    } catch (e) {
        adminLogger.error('Error in getOpenOrderList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

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
    const byTicket = await PositionControllers.getPositionByTicket(login, position);
    let livePosition = findMt5Position(byTicket, position);
    if (livePosition) return livePosition;

    const positionList = await PositionControllers.positionList(login);
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

module.exports.closeTradeByPosition = async (request, response) => {
    try {
        adminLogger.info('Entering closeTradeByPosition', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, typeFill, position } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!adminData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { Login: login, isDeleted: false }
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
            adminLogger.warn('closeTradeByPosition: Close trade execution failed/rejected', { reqId, message: verification.message });
            return response.status(400).json({
                status: false,
                message: verification.message,
                data: checkExecutedTrade
            });
        }
       
        adminLogger.info('Exiting closeTradeByPosition: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Closed Trade Request.",
            data: checkExecutedTrade,
        });
    } catch (e) {
        adminLogger.error('Error in closeTradeByPosition', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.closeLimitTradeOrder = async (request, response) => {
    try {
        adminLogger.info('Entering closeLimitTradeOrder', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, order, symbol, type } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!adminData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { Login: login, isDeleted: false }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const tradeRequest = { login, order, symbol, type };

        const newTradeRequest = await TradeRequestControllers.closeLimitOrder(tradeRequest);
        if(!newTradeRequest) throw CustomErrorHandler.serverError("Failed to Close Limit order!");

        const checkExecutedTrade = await TradeRequestControllers.getExecutedTrade(newTradeRequest.answer.id);
        console.log(JSON.stringify(checkExecutedTrade))
       
        adminLogger.info('Exiting closeLimitTradeOrder: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Order Closed.",
            data: checkExecutedTrade,
        });
    } catch (e) {
        adminLogger.error('Error in closeLimitTradeOrder', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.closedOrderList = async (request, response) => {
    try {
        adminLogger.info('Entering closedOrderList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData)  throw CustomErrorHandler.unAuthorized("Access Denied!");

        // const metaUser = await Mt5Model.findOne({
        //     where: { Login: login, isDeleted: false }
        // }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Login Not found!");

        const to = Math.floor(Date.now() / 1000); // current time in seconds
        const from = 0; // complete history from epoch
        const orderList = await dealController.getDealsPage(login, from, to);
        const orders = orderList?.answer || [];
        let closedPosition = [];
        for(const order of orders ) {
            if(order.Entry != 0) closedPosition.push(order);
        }

        adminLogger.info('Exiting closedOrderList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Closed order list.",
            data: closedPosition,
        });
    } catch (e) {
        adminLogger.error('Error in closedOrderList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
