const PositionControllers = require("../../mt5Services/position");
const UserModel = require("../../models/users.model");
const Mt5Model = require("../../models/mt5Account.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");

module.exports.getSymbolPosition = async (request, response) => {
    try {
        userLogger.info('Entering getSymbolPosition', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, symbol } = request.query;

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
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const symbolPositionList = await PositionControllers.getPositionBySymbol(login, symbol);
        if(!symbolPositionList) throw CustomErrorHandler.serverError(`Failed to Fetch ${symbol} Positions!`);

        userLogger.info('Exiting getSymbolPosition: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: symbolPositionList,
        });
    } catch (e) {
        userLogger.error('Error in getSymbolPosition', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.positionList = async (request, response) => {
    try {
        userLogger.info('Entering positionList', { method: request.method || "", route: request.originalUrl || "" });
      const { user } = request.body;
      const { login, page = 1, limit = 10 } = request.query;
  
      // Validate authenticated user
      const userData = await UserModel.findOne({
        where: {
          id: user.id,
          isDeleted: false,
        },
      });
      if (!userData) {
        throw CustomErrorHandler.unAuthorized("Access Denied!");
      }
  
      // Validate MT5 account
      const metaUser = await Mt5Model.findOne({
        where: {
          userId: user.id,
          Login: login,
          isDeleted: false,
        },
      });
      if (!metaUser) {
        throw CustomErrorHandler.unAuthorized("MT5 account not found!");
      }
  
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
  
      userLogger.info('Exiting positionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        userLogger.error('Error in positionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
      console.error(`[API] Error fetching position list: ${e.message}`);
      handleErrorResponse(e, response);
    }
};

module.exports.getOpenOrderList = async (request, response) => {
    try {
        userLogger.info('Entering getOpenOrderList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, groups, tickets, symbols } = request.query;

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
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const orders = await PositionControllers.openOrderList(login, groups, tickets, symbols);
        if(!orders) throw CustomErrorHandler.serverError(`Failed to Fetch Orders!`);

        userLogger.info('Exiting getOpenOrderList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Order list.",
            data: orders,
        });
    } catch (e) {
        userLogger.error('Error in getOpenOrderList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
