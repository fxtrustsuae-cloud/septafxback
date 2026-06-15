const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const MarketingModel = require("../../models/marketingUser.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");
const {
    TOKEN_SUBJECT,
    signAuthToken,
    toPlainUserData,
} = require("../../utils/authSession");

module.exports.marketingLogin = async (request, response) => {
    try {
        marketingLogger.info('Entering marketingLogin', { method: request.method || "", route: request.originalUrl || "" });
        const { userName, password } = request.body;

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
        if (!checkPassword) throw CustomErrorHandler.wrongCredentials("Wrong Password!");

        const token = signAuthToken(userData, TOKEN_SUBJECT.MARKETING);
        const safeUserData = toPlainUserData(userData);

        marketingLogger.info('Exiting marketingLogin: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Login success.",
            data: { userData: safeUserData, token }
        });
    } catch (e) {
        marketingLogger.error('Error in marketingLogin', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
