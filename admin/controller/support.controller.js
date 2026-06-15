const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const SupportModel = require("../../models/support.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.ticketList = async (request, response) => {
    try {
        adminLogger.info('Entering ticketList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, status, priority } = request.query;
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
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

        adminLogger.info('Exiting ticketList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        adminLogger.error('Error in ticketList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.singleTicket = async (request, response) => {
    try {
        adminLogger.info('Entering singleTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed('Access Denied!');

        const ticket = await SupportModel.findOne({
            where: {
                id,
                isDeleted: false,
            },
        }); if (!ticket) throw CustomErrorHandler.notFound("Ticket Not Found!");
        
        adminLogger.info('Exiting singleTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Ticket Data.',
            data: ticket,
        });
    } catch (e) {
        adminLogger.error('Error in singleTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateTicket = async (request, response) => {
    try {
        adminLogger.info('Entering updateTicket', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ticketId, status } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed('Access Denied!');

        const ticketData = await SupportModel.findByPk(ticketId);
        if (!ticketData) throw CustomErrorHandler.notFound("Ticket Not Found!");

        ticketData.status = status;
        await ticketData.save();

        adminLogger.info('Exiting updateTicket: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Ticket Updated.',
            data: ticketData,
        });
    } catch (e) {
        adminLogger.error('Error in updateTicket', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.replay = async (request, response) => {
    try {
        adminLogger.info('Entering replay', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ticketId, message } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
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

        adminLogger.info('Exiting replay: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Message Send.",
            data: ticketData
        });
    } catch (e) {
        adminLogger.error('Error in replay', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};