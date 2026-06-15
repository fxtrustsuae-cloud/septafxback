const UserModel = require("../../models/users.model");
const PositionControllers = require("../../mt5Services/position");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.getSymbolPosition = async (request, response) => {
    try {
        marketingLogger.info('Entering getSymbolPosition', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, symbol } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");


        const symbolPositionList = await PositionControllers.getPositionBySymbol(login, symbol);
        if(!symbolPositionList) throw CustomErrorHandler.serverError(`Failed to Fetch ${symbol} Positions!`);

        marketingLogger.info('Exiting getSymbolPosition: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: symbolPositionList,
        });
    } catch (e) {
        marketingLogger.error('Error in getSymbolPosition', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.positionList = async (request, response) => {
    try {
        marketingLogger.info('Entering positionList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, page = 1, limit = 10 } = request.query;
    
        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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
    
        marketingLogger.info('Exiting positionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in positionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
      console.error(`[API] Error fetching position list: ${e.message}`);
      handleErrorResponse(e, response);
    }
};

module.exports.getOpenOrderList = async (request, response) => {
    try {
        marketingLogger.info('Entering getOpenOrderList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { logins, groups, tickets, symbols } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const orders = await PositionControllers.openOrderList(logins, groups, tickets, symbols);
        if(!orders) throw CustomErrorHandler.serverError(`Failed to Fetch Orders!`);

        marketingLogger.info('Exiting getOpenOrderList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Order list.",
            data: orders,
        });
    } catch (e) {
        marketingLogger.error('Error in getOpenOrderList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
