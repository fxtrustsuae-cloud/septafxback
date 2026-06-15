const { Op } = require("sequelize");
const sequelize = require("../../config/db.config");
const UserModel = require("../../models/users.model");
const MasterTraderModel = require("../../models/masterTrader.model");
const Mt5AccountModel = require("../../models/mt5Account.model");
const CopyTradeSubscriptionModel = require("../../models/copyTradeSubscription.model");
const CopyTradeModel = require("../../models/copyTrade.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { actionTracking } = require("../../helpers/index");
const { adminLogger } = require("../../utils/logger");

// List Copy Trade Subscriptions (with filtering)
module.exports.listCopyTradeSubscriptions = async (request, response) => {
    try {
        adminLogger.info('Entering listCopyTradeSubscriptions', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, userId, masterTraderId, status, search } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const whereCondition = {
            isDeleted: false
        };

        if (userId) whereCondition.userId = userId;
        if (masterTraderId) whereCondition.masterTraderId = masterTraderId;
        if (status) whereCondition.status = status;

        let userSearchCondition = {};
        if (search) {
            userSearchCondition = {
                [Op.or]: [
                    { userName: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } },
                    { name: { [Op.iLike]: `%${search}%` } }
                ]
            };
        }

        const { count, rows } = await CopyTradeSubscriptionModel.findAndCountAll({
            where: whereCondition,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    where: search ? userSearchCondition : {},
                    attributes: ["id", "userName", "name", "email"]
                },
                {
                    model: MasterTraderModel,
                    as: "masterTrader",
                    attributes: ["id", "displayName", "mt5Login"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        adminLogger.info('Exiting listCopyTradeSubscriptions: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Copy Trade Subscriptions list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page),
                subscriptions: rows,
            },
        });
    } catch (e) {
        adminLogger.error('Error in listCopyTradeSubscriptions', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Single Copy Trade Subscription
module.exports.getCopyTradeSubscription = async (request, response) => {
    try {
        adminLogger.info('Entering getCopyTradeSubscription', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { id } = request.params;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const subscription = await CopyTradeSubscriptionModel.findOne({
            where: { id, isDeleted: false },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name", "email"]
                },
                {
                    model: MasterTraderModel,
                    as: "masterTrader",
                    attributes: ["id", "displayName", "mt5Login"],
                    include: [
                        {
                            model: UserModel,
                            as: "user",
                            attributes: ["id", "userName", "name"]
                        }
                    ]
                }
            ]
        });

        if (!subscription) throw CustomErrorHandler.notFound("Subscription not found!");

        adminLogger.info('Exiting getCopyTradeSubscription: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Copy Trade Subscription details.",
            data: subscription,
        });
    } catch (e) {
        adminLogger.error('Error in getCopyTradeSubscription', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Pause Copy Trade Subscription (Admin can pause any)
module.exports.pauseCopyTradeSubscription = async (request, response) => {
    try {
        adminLogger.info('Entering pauseCopyTradeSubscription', { method: request.method || "", route: request.originalUrl || "" });
        const { user, subscriptionId, reason } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const subscription = await CopyTradeSubscriptionModel.findOne({
            where: { id: subscriptionId, isDeleted: false }
        });
        if (!subscription) throw CustomErrorHandler.notFound("Subscription not found!");

        if (subscription.status !== "ACTIVE") {
            throw CustomErrorHandler.notAllowed("Only ACTIVE subscriptions can be paused!");
        }

        // Update linked CopyTrade status
        if (subscription.copyTradeId) {
            try {
                const copyTrade = await CopyTradeModel.findOne({
                    where: { id: subscription.copyTradeId, isDeleted: false }
                });
                if (copyTrade) {
                    copyTrade.status = 'PAUSED';
                    await copyTrade.save();
                }
            } catch (error) {
        adminLogger.error('Error in pauseCopyTradeSubscription', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
                console.error('[Admin] Error updating CopyTrade status:', error.message);
            }
        }

        subscription.status = "PAUSED";
        subscription.pausedAt = new Date();
        subscription.pausedBy = adminData.id;
        subscription.pauseReason = reason || "Paused by admin";
        await subscription.save();

        await actionTracking(request, adminData.id, "PAUSED-COPY-TRADE-SUBSCRIPTION", `Subscription ID: ${subscriptionId}`);

        adminLogger.info('Exiting pauseCopyTradeSubscription: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Copy Trade Subscription paused successfully.",
            data: subscription,
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

// Resume Copy Trade Subscription (Admin can resume any)
module.exports.resumeCopyTradeSubscription = async (request, response) => {
    try {
        adminLogger.info('Entering resumeCopyTradeSubscription', { method: request.method || "", route: request.originalUrl || "" });
        const { user, subscriptionId } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const subscription = await CopyTradeSubscriptionModel.findOne({
            where: { id: subscriptionId, isDeleted: false }
        });
        if (!subscription) throw CustomErrorHandler.notFound("Subscription not found!");

        if (subscription.status !== "PAUSED") {
            throw CustomErrorHandler.notAllowed("Only PAUSED subscriptions can be resumed!");
        }

        // Update linked CopyTrade status
        if (subscription.copyTradeId) {
            try {
                const copyTrade = await CopyTradeModel.findOne({
                    where: { id: subscription.copyTradeId, isDeleted: false }
                });
                if (copyTrade) {
                    copyTrade.status = 'ACTIVE';
                    await copyTrade.save();
                }
            } catch (error) {
        adminLogger.error('Error in resumeCopyTradeSubscription', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
                console.error('[Admin] Error updating CopyTrade status:', error.message);
            }
        }

        subscription.status = "ACTIVE";
        subscription.resumedAt = new Date();
        subscription.resumedBy = adminData.id;
        await subscription.save();

        await actionTracking(request, adminData.id, "RESUMED-COPY-TRADE-SUBSCRIPTION", `Subscription ID: ${subscriptionId}`);

        adminLogger.info('Exiting resumeCopyTradeSubscription: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Copy Trade Subscription resumed successfully.",
            data: subscription,
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

// Delete/Force Stop Copy Trade Subscription
module.exports.deleteCopyTradeSubscription = async (request, response) => {
    try {
        adminLogger.info('Entering deleteCopyTradeSubscription', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { id } = request.params;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const subscription = await CopyTradeSubscriptionModel.findOne({
            where: { id, isDeleted: false }
        });
        if (!subscription) throw CustomErrorHandler.notFound("Subscription not found!");

        // Update linked CopyTrade status
        if (subscription.copyTradeId) {
            try {
                const copyTrade = await CopyTradeModel.findOne({
                    where: { id: subscription.copyTradeId, isDeleted: false }
                });
                if (copyTrade) {
                    copyTrade.status = 'STOPPED';
                    copyTrade.isDeleted = true;
                    await copyTrade.save();
                }
            } catch (error) {
        adminLogger.error('Error in deleteCopyTradeSubscription', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
                console.error('[Admin] Error updating CopyTrade status:', error.message);
            }
        }

        subscription.isDeleted = true;
        subscription.unsubscribedAt = new Date();
        await subscription.save();

        await actionTracking(request, adminData.id, "DELETED-COPY-TRADE-SUBSCRIPTION", `Subscription ID: ${id}`);

        adminLogger.info('Exiting deleteCopyTradeSubscription: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Copy Trade Subscription deleted successfully.",
            data: null,
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

// Get Subscription Statistics/Summary
module.exports.getSubscriptionStats = async (request, response) => {
    try {
        adminLogger.info('Entering getSubscriptionStats', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const stats = await sequelize.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM "CopyTradeSubscriptions"
            WHERE is_deleted = false
            GROUP BY status
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        const totalStats = await sequelize.query(`
            SELECT 
                COUNT(*) as total_subscriptions,
                COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'PAUSED' THEN 1 END) as paused,
                COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as rejected,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT master_trader_id) as unique_master_traders
            FROM "CopyTradeSubscriptions"
            WHERE is_deleted = false
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        adminLogger.info('Exiting getSubscriptionStats: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Copy Trade Subscription Statistics.",
            data: {
                statusBreakdown: stats,
                totalStats: totalStats[0] || {},
            },
        });
    } catch (e) {
        adminLogger.error('Error in getSubscriptionStats', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
