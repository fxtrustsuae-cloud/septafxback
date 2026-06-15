const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const SupportModel = require("../../models/support.model");
const MarketingMemberModel = require("../../models/marketingUser.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.ticketList = async (request, response) => {
    try {
        marketingLogger.info('Entering ticketList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, status, priority } = request.query;
        const { user } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        const whereCondition = {
            isDeleted: false,
        };
        if (status) whereCondition.status = status;
        if (priority) whereCondition.priority = priority;

        const { count, rows: ticketList } = await SupportModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['name', 'email', 'mobile', 'userName'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                },
            ],
            limit,
            offset,
        });

        marketingLogger.info('Exiting ticketList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ticket list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                ticketList,
            },
        });
    } catch (e) {
        marketingLogger.error('Error in ticketList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.singleTicket = async (request, response) => {
    try {
        marketingLogger.info('Entering singleTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        const userData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed('Access Denied!');

        const ticket = await SupportModel.findOne({
            where: {
                id,
                isDeleted: false,
            },
        }); if (!ticket) throw CustomErrorHandler.notFound("Ticket Not Found!");
        
        marketingLogger.info('Exiting singleTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Ticket Data.',
            data: ticket,
        });
    } catch (e) {
        marketingLogger.error('Error in singleTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateTicket = async (request, response) => {
    try {
        marketingLogger.info('Entering updateTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ticketId, status } = request.body;

        const userData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed('Access Denied!');

        const ticketData = await SupportModel.findByPk(ticketId);
        if (!ticketData) throw CustomErrorHandler.notFound("Ticket Not Found!");

        ticketData.status = status;
        await ticketData.save();

        marketingLogger.info('Exiting updateTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Ticket Updated.',
            data: ticketData,
        });
    } catch (e) {
        marketingLogger.error('Error in updateTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.replay = async (request, response) => {
    try {
        marketingLogger.info('Entering replay', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ticketId, message } = request.body;

        const userData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access denied!");

        const ticketData = await SupportModel.findByPk(ticketId);
        if(!ticketData) throw CustomErrorHandler.notFound("Ticket Not Found!");
        
        if(ticketData.status == "CLOSED"){
            throw CustomErrorHandler.alreadyExist("Can't Replay, Closed!");
        };

        const messageData = { sender: "admin", text: message, time: new Date().toISOString() }
        const updateMessage = [...ticketData.message, messageData];
        ticketData.message = updateMessage;
        await ticketData.save();

        marketingLogger.info('Exiting replay: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Message Send.",
            data: ticketData
        });
    } catch (e) {
        marketingLogger.error('Error in replay', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};