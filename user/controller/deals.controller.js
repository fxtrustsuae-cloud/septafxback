const DealControllers = require("../../mt5Services/deals");
const UserModel = require("../../models/UserModel");
const Mt5Model = require("../../models/Mt5Model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");

// Get Deal by Ticket
module.exports.getDealByTicket = async (request, response) => {
    try {
        userLogger.info('Entering getDealByTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { ticket } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        });
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const dealData = await DealControllers.getDealByTicket(ticket);
        if (!dealData) throw CustomErrorHandler.serverError("Failed to Fetch Deal!");

        userLogger.info('Exiting getDealByTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deal fetched successfully.",
            data: dealData.answer,
        });
    } catch (e) {
        userLogger.error('Error in getDealByTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Deals List
module.exports.getDealsList = async (request, response) => {
    try {
        userLogger.info('Entering getDealsList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, fromDate, toDate } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        });if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const dealsList = await DealControllers.getDealsList(login, fromDate, toDate);
        if (!dealsList) throw CustomErrorHandler.serverError("Failed to Fetch Deals List!");

        userLogger.info('Exiting getDealsList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deals list fetched successfully.",
            data: dealsList.answer,
        });
    } catch (e) {
        userLogger.error('Error in getDealsList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Deals Page
module.exports.getDealsPage = async (request, response) => {
    try {
        userLogger.info('Entering getDealsPage', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, fromDate, toDate, offset, total } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        });
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        });if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const dealsPage = await DealControllers.getDealsPage(login, fromDate, toDate, offset, total);
        if (!dealsPage) throw CustomErrorHandler.serverError("Failed to Fetch Deals Page!");

        userLogger.info('Exiting getDealsPage: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deals page fetched successfully.",
            data: dealsPage.answer,
        });
    } catch (e) {
        userLogger.error('Error in getDealsPage', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};