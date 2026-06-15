const { Op, fn, col } = require("sequelize");
const IbModel = require("../../models/ib.model");
const UserModel = require("../../models/users.model");
const MarketingMemberModel = require("../../models/marketingUser.model");
const Mt5AccountsModel = require("../../models/mt5Account.model");
const TransactionModel = require("../../models/transaction.model");
const DepositWithdrawModel = require("../../models/depositWithdraw.model");
const RequestedMt5AccModel = require("../../models/requestedMt5Accounts.model");
const { BankDetails: BankModel, Documents: DocumentModel } = require("../../models/kyc.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.dashboard = async (request, response) => {
    try {
        marketingLogger.info('Entering dashboard', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const userList = await UserModel.findAll({
            where: { role: "USER", isDeleted: false, assingToManager: adminData.id }
        }); const userIds = userList.map((e) => e.id);

        const [
            totalClient,
            totalIb,
            pendingIb,
            pendingDeposit,
            pendingWithdraw,
            pendingBank,
            pendingDocument,
            pendingMt5Account,
        ] = await Promise.all([
            UserModel.count({ where: { role: "USER", isDeleted: false, assingToManager: adminData.id } }),
            UserModel.count({ where: { role: "USER", isDeleted: false, isIb: true, assingToManager: adminData.id } }),
            IbModel.count({ where: { status: "PENDING", isDeleted: false, userId: { [Op.in]: userIds } } }),
            DepositWithdrawModel.count({ where: { status: "PENDING", isDeleted: false, transactionType: "DEPOSIT", userId: { [Op.in]: userIds } } }),
            DepositWithdrawModel.count({ where: { status: "PENDING", isDeleted: false, transactionType: "WITHDRAW", userId: { [Op.in]: userIds } } }),
            BankModel.count({ where: { status: "PENDING", isDeleted: false, userId: { [Op.in]: userIds } } }),
            DocumentModel.count({ where: { status: "PENDING", isDeleted: false, userId: { [Op.in]: userIds } } }),
            RequestedMt5AccModel.count({ where: { status: "PENDING", isDeleted: false, userId: { [Op.in]: userIds } } })
        ]);

        const data = { totalClient, totalIb, pendingIb, pendingDeposit, pendingWithdraw, pendingBank, pendingDocument, pendingMt5Account };

        marketingLogger.info('Exiting dashboard: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Dashboard Data.",
            data
        });
    } catch (e) {
        marketingLogger.error('Error in dashboard', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function getTotalByType(transactionType, range = null) {
    const where = {
        transactionType,
        status: "COMPLETED",
        isDeleted: false
    };

    if (range) {
        where.createdAt = { [Op.between]: [range.start, range.end] };
    }

    const result = await TransactionModel.findOne({
        attributes: [[fn("SUM", col("amount")), "total"]],
        where
    });

    return parseFloat(result?.dataValues?.total || 0);
}

module.exports.transactionDashboard = async (request, response) => {
    try {
        marketingLogger.info('Entering transactionDashboard', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: "ADMIN", isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.wrongCredentials("Not Found!");

        const now = new Date();

        // TODAY
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        // THIS WEEK (Mon - Sun)
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // THIS MONTH
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const results = {
            today: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT", { start: startOfToday, end: endOfToday }),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW", { start: startOfToday, end: endOfToday }),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT", { start: startOfToday, end: endOfToday }),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW", { start: startOfToday, end: endOfToday }),
                ibWithdraw: await getTotalByType("IB-WITHDRAW", { start: startOfToday, end: endOfToday }),
                ibComission: await getTotalByType("IB-COMISSION", { start: startOfToday, end: endOfToday })
            },
            week: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT", { start: startOfWeek, end: endOfWeek }),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW", { start: startOfWeek, end: endOfWeek }),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT", { start: startOfWeek, end: endOfWeek }),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW", { start: startOfWeek, end: endOfWeek }),
                ibWithdraw: await getTotalByType("IB-WITHDRAW", { start: startOfWeek, end: endOfWeek }),
                ibComission: await getTotalByType("IB-COMISSION", { start: startOfWeek, end: endOfWeek })
            },
            month: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT", { start: startOfMonth, end: endOfMonth }),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW", { start: startOfMonth, end: endOfMonth }),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT", { start: startOfMonth, end: endOfMonth }),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW", { start: startOfMonth, end: endOfMonth }),
                ibWithdraw: await getTotalByType("IB-WITHDRAW", { start: startOfMonth, end: endOfMonth }),
                ibComission: await getTotalByType("IB-COMISSION", { start: startOfMonth, end: endOfMonth })
            },
            total: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT"),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW"),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT"),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW"),
                ibWithdraw: await getTotalByType("IB-WITHDRAW"),
                ibComission: await getTotalByType("IB-COMISSION")
            }
        };

        marketingLogger.info('Exiting transactionDashboard: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Dashboard Data.",
            data: results
        });
    } catch (e) {
        marketingLogger.error('Error in transactionDashboard', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function userGetTotalByType(type, userId) {
    const where = {
        transactionType: { [Op.in]: type },
        status: "COMPLETED",
        isDeleted: false,
        userId
    };
  
    const result = await TransactionModel.findOne({
        attributes: [[fn("SUM", col("amount")), "total"]],
        where
    });
  
    return parseFloat(result?.dataValues?.total || 0);
}

module.exports.userDashboard = async (request, response) => {
    try {
        marketingLogger.info('Entering userDashboard', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { userId } = request.query;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, role: "USER", isDeleted: false, assingToManager: adminData.id }
        }); if(!checkUser) throw CustomErrorHandler.notFound("Access Denied, User not assinged to you!");

        const totalMt5Account = await Mt5AccountsModel.count({
            where: { userId, isDeleted: false }
        });

        const data = {
            totalDeposit: await userGetTotalByType(["DEPOSIT", "WALLET-DEPOSIT"], userId),
            totalWithdraw: await userGetTotalByType(["WITHDRAW", "WALLET-WITHDRAW"], userId),
            totalMt5Account
        };

        marketingLogger.info('Exiting userDashboard: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Dashboard Data.",
            data
        });
    } catch (e) {
        marketingLogger.error('Error in userDashboard', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
