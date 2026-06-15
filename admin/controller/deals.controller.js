const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const DealControllers = require("../../mt5Services/deals");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.getDealByTicket = async (request, response) => {
    try {
        adminLogger.info('Entering getDealByTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { ticket } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const dealData = await DealControllers.getDealByTicket(ticket);
        if (!dealData) throw CustomErrorHandler.serverError("Failed to Fetch Deal!");

        adminLogger.info('Exiting getDealByTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deal fetched successfully.",
            data: dealData.answer,
        });
    } catch (e) {
        adminLogger.error('Error in getDealByTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Deals List
module.exports.getDealsList = async (request, response) => {
    try {
        adminLogger.info('Entering getDealsList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, fromDate, toDate } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const dealsList = await DealControllers.getDealsList(login, fromDate, toDate);
        if (!dealsList) throw CustomErrorHandler.serverError("Failed to Fetch Deals List!");

        adminLogger.info('Exiting getDealsList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deals list fetched successfully.",
            data: dealsList.answer,
        });
    } catch (e) {
        adminLogger.error('Error in getDealsList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Deals Page
module.exports.getDealsPage = async (request, response) => {
    try {
        adminLogger.info('Entering getDealsPage', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, fromDate, toDate, page = 1, limit = 10 } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const dealsPage = await DealControllers.getDealsPage(login, fromDate, toDate, page, limit);
        if (!dealsPage) throw CustomErrorHandler.serverError("Failed to Fetch Deals Page!");

        adminLogger.info('Exiting getDealsPage: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deals page fetched successfully.",
            data: dealsPage.answer,
        });
    } catch (e) {
        adminLogger.error('Error in getDealsPage', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Deal Batch
module.exports.getDealBatch = async (request, response) => {
    try {
        adminLogger.info('Entering getDealBatch', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { logins, groups, tickets, fromDate, toDate, symbol } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const dealBatch = await DealControllers.getDealBatch(logins, groups, tickets, fromDate, toDate, symbol);
        if (!dealBatch) throw CustomErrorHandler.serverError("Failed to Fetch Deal Batch!");

        adminLogger.info('Exiting getDealBatch: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deal batch fetched successfully.",
            data: dealBatch.answer,
        });
    } catch (e) {
        adminLogger.error('Error in getDealBatch', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Update Deal
module.exports.updateDeal = async (request, response) => {
    try {
        adminLogger.info('Entering updateDeal', { method: request.method || "", route: request.originalUrl || "" });
        const { user, deal, data } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const updatedDeal = await DealControllers.updateDeal(deal, data);
        if (!updatedDeal) throw CustomErrorHandler.serverError("Failed to Update Deal!");

        adminLogger.info('Exiting updateDeal: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deal updated successfully.",
            data: updatedDeal.answer,
        });
    } catch (e) {
        adminLogger.error('Error in updateDeal', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Delete Deal
module.exports.deleteDeal = async (request, response) => {
    try {
        adminLogger.info('Entering deleteDeal', { method: request.method || "", route: request.originalUrl || "" });
        const { user, tickets } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const deletedDeal = await DealControllers.deleteDeal(tickets);
        if (!deletedDeal) throw CustomErrorHandler.serverError("Failed to Delete Deal!");

        adminLogger.info('Exiting deleteDeal: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Deal(s) deleted with tickets ${tickets}`,
            data: deletedDeal.answer,
        });
    } catch (e) {
        adminLogger.error('Error in deleteDeal', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};