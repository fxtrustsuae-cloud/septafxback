const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const socket = require("../../config/socketIO");
const UserModel = require("../../models/users.model");
const MarketingModel = require("../../models/marketingUser.model");
const LoginTrackingModel = require("../../models/loginTracking.model");
const { actionTracking } = require("../../helpers/index");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");
const {
    TOKEN_SUBJECT,
    replaceUserSession,
    signAuthToken,
    toPlainUserData,
} = require("../../utils/authSession");

module.exports.login = async (request, response) => {
    try {
        adminLogger.info('Entering login', { method: request.method || "", route: request.originalUrl || "" });
        const { userName, password } = request.body;

        const userIP = request.ip || request.headers["x-forwarded-for"] || request.socket.remoteAddress;
        const userAgent = request.get("User-Agent") || "Unknown Device";

        const userData = await UserModel.scope("withPassword").findOne({
            where: {
                [Op.or]: [
                    { userName: userName.trim() },
                    { email: userName.trim() }
                ],
                role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] },
                isDeleted: false
            }
        });
        if (!userData) throw CustomErrorHandler.wrongCredentials("Not Found!");

        const checkPassword = await bcrypt.compare(password, userData.password);
        if (!checkPassword) {
            throw CustomErrorHandler.wrongCredentials("Wrong Password!");
        }

        const token = signAuthToken(userData, TOKEN_SUBJECT.USER);
        const safeUserData = toPlainUserData(userData);

        if (userData.role === "ADMIN") {
            const AdminPermissionModel = require("../../models/adminPermission.model");
            const permissions = await AdminPermissionModel.findAll({
                where: { userId: userData.id, isDeleted: false }
            });
            safeUserData.permissions = permissions.map(p => p.permission);
        } else if (userData.role === "SUPER-ADMIN") {
            safeUserData.permissions = ["ALL"];
        }

        await LoginTrackingModel.create({
            userId: userData.id,
            ipAddress: userIP,
            device: userAgent,
            timestamp: new Date(),
            isDeleted: false
        });

        socket.socketEmitAll("logOut", { userId: userData.id });
        await replaceUserSession(userData.id, token);

        actionTracking(request, userData.id, "LOGIN");

        adminLogger.info('Exiting login: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Login success.",
            data: { userData: safeUserData, token }
        });
    } catch (e) {
        adminLogger.error('Error in login', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.loginHistory = async (request, response) => {
    try {
        adminLogger.info('Entering loginHistory', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, userId } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);
        const where = userId ? { userId } : {};

        const { count, rows: loginHistory } = await LoginTrackingModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"]
                }
            ],
            offset
        });

        actionTracking(request, userData.id, "CHECKED-LOGIN-HISTORY");
        adminLogger.info('Exiting loginHistory: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Login History list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                loginHistory
            }
        });
    } catch (e) {
        adminLogger.error('Error in loginHistory', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.marketingLogin = async (request, response) => {
    try {
        adminLogger.info('Entering marketingLogin', { method: request.method || "", route: request.originalUrl || "" });
        const { userName, password } = request.body;

        const userIP = request.ip || request.headers["x-forwarded-for"] || request.socket.remoteAddress;
        const userAgent = request.get("User-Agent") || "Unknown Device";

        const userData = await MarketingModel.scope("withPassword").findOne({
            where: {
                [Op.or]: [
                    { mobile: userName.trim() },
                    { email: userName.trim() }
                ],
                isDeleted: false
            }
        });
        if (!userData) throw CustomErrorHandler.wrongCredentials("Not Found!");

        const checkPassword = await bcrypt.compare(password, userData.password);
        if (!checkPassword) {
            throw CustomErrorHandler.wrongCredentials("Wrong Password!");
        }

        const token = signAuthToken(userData, TOKEN_SUBJECT.MARKETING);
        const safeUserData = toPlainUserData(userData);

        await LoginTrackingModel.create({
            userId: userData.id,
            ipAddress: userIP,
            device: userAgent,
            timestamp: new Date(),
            isDeleted: false
        });

        adminLogger.info('Exiting marketingLogin: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Login success.",
            data: { userData: safeUserData, token }
        });
    } catch (e) {
        adminLogger.error('Error in marketingLogin', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
