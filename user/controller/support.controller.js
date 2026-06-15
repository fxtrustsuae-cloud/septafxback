const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const { actionTracking } = require("../../helpers/index");
const SupportModel = require("../../models/support.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");

module.exports.createTicket = async (request, response) => {
    try {
        userLogger.info('Entering createTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { user, subject, message, priority } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access denied!");

        const newTicket = await SupportModel.create({
            userId: userData.id,
            subject,
            priority,
            message:[{ sender: "user", text: message, time: new Date().toISOString() }]
        })

        actionTracking(request, userData.id, "TICKET-CREATED");
        userLogger.info('Exiting createTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ticket Created.",
            data: newTicket
        });
    } catch (e) {
        userLogger.error('Error in createTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ticketList = async (request, response) => {
    try {
        userLogger.info('Entering ticketList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, status, priority } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        const whereCondition = {
            isDeleted: false,
            userId: userData.id,
        };
        if (status) whereCondition.status = status;
        if (priority) whereCondition.priority = priority;

        const { count, rows: ticketList } = await SupportModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        actionTracking(request, userData.id, "CHECKED-TICKET-LIST");
        userLogger.info('Exiting ticketList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        userLogger.error('Error in ticketList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.singleTicket = async (request, response) => {
    try {
        userLogger.info('Entering singleTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed('Access Denied!');

        const ticket = await SupportModel.findOne({
            where: {
                id,
                isDeleted: false,
            },
        }); if (!ticket) throw CustomErrorHandler.notFound("Ticket Not Found!");
        
        userLogger.info('Exiting singleTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Ticket Data.',
            data: ticket,
        });
    } catch (e) {
        userLogger.error('Error in singleTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.closeTicket = async (request, response) => {
    try {
        userLogger.info('Entering closeTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ticketId } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed('Access Denied!');

        const ticketData = await SupportModel.findByPk(ticketId);
        if (!ticketData) throw CustomErrorHandler.notFound("Ticket Not Found!");

        if(ticketData.status == "CLOSED"){
            throw CustomErrorHandler.alreadyExist("Already Closed!");
        };

        ticketData.status = "CLOSED";
        await ticketData.save();

        actionTracking(request, userData.id, "CLOSED-TICKET");

        userLogger.info('Exiting closeTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Ticket Closed.',
            data: ticketData,
        });
    } catch (e) {
        userLogger.error('Error in closeTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.replay = async (request, response) => {
    try {
        userLogger.info('Entering replay', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ticketId, message } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access denied!");

        const ticketData = await SupportModel.findByPk(ticketId);
        if(!ticketData) throw CustomErrorHandler.notFound("Ticket Not Found!");
        
        if(ticketData.status == "CLOSED"){
            throw CustomErrorHandler.alreadyExist("Can't Replay, Closed!");
        };

        const messageData = { sender: "user", text: message, time: new Date().toISOString() }
        const updateMessage = [...ticketData.message, messageData];
        ticketData.message = updateMessage;
        await ticketData.save();

        actionTracking(request, userData.id, "REPLAY-TICKET");

        userLogger.info('Exiting replay: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Message Send.",
            data: ticketData
        });
    } catch (e) {
        userLogger.error('Error in replay', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};