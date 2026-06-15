const { Op, fn, col } = require("sequelize");
const IbModel = require("../../models/ib.model");
const UserModel = require("../../models/users.model");
const AppSetting = require("../../models/appSetting.model");
const Mt5AccountsModel = require("../../models/mt5Account.model");
const AssetModel = require("../../models/asset.model");
const TransactionModel = require("../../models/transaction.model");
const DepositWithdrawModel = require("../../models/depositWithdraw.model");
const RequestedMt5AccModel = require("../../models/requestedMt5Accounts.model");
const { BankDetails: BankModel, Documents: DocumentModel } = require("../../models/kyc.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.dashboard = async (request, response) => {
    try {
        adminLogger.info('Entering dashboard', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.wrongCredentials("Not Found!");

        const [
            totalClient,
            totalIb,
            pendingIb,
            pendingDeposit,
            pendingWithdraw,
            pendingBank,
            pendingDocument,
            pendingMt5Account,
            mainBalance,
        ] = await Promise.all([
            UserModel.count({ where: { role: "USER", isDeleted: false, isIb: false } }),
            UserModel.count({ where: { role: "USER", isDeleted: false, isIb: true } }),
            IbModel.count({ where: { status: "PENDING", isDeleted: false } }),
            DepositWithdrawModel.count({ where: { status: "PENDING", isDeleted: false, transactionType: "DEPOSIT" } }),
            DepositWithdrawModel.count({ where: { status: "PENDING", isDeleted: false, transactionType: "WITHDRAW" } }),
            BankModel.count({ where: { status: "PENDING", isDeleted: false } }),
            DocumentModel.count({ where: { status: "PENDING", isDeleted: false } }),
            RequestedMt5AccModel.count({ where: { status: "PENDING", isDeleted: false } }),
            AssetModel.sum("mainBalance", { where: { isDeleted: false } })
        ]);

        const data = { totalClient, totalIb, pendingIb, pendingDeposit, pendingWithdraw, pendingBank, pendingDocument, pendingMt5Account, mainBalance: Number(mainBalance || 0) };

        adminLogger.info('Exiting dashboard: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Dashboard Data.",
            data
        });
    } catch (e) {
        adminLogger.error('Error in dashboard', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function getTotalByType(transactionType, range = null) {
    const where = {
        transactionType,
        status: "COMPLETED",
        // isDeleted: false
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

async function getNetCredit(range = null) {
    const [deposit, withdraw] = await Promise.all([
        getTotalByType("CREDIT-DEPOSIT", range),
        getTotalByType("CREDIT-WITHDRAW", range)
    ]);

    return deposit - withdraw;
}

module.exports.transactionDashboard = async (request, response) => {
    try {
        adminLogger.info('Entering transactionDashboard', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.wrongCredentials("Not Found!");

        const now = new Date();

        // ---- DATE RANGES ----
        // TODAY
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const endOfToday = new Date(now.setHours(23, 59, 59, 999));

        // WEEK (Mon - Sun)
        const current = new Date();
        const day = current.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const startOfWeek = new Date(current.setDate(current.getDate() + diff));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // MONTH
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        // ---- DASHBOARD RESPONSE ----
        const results = {
            today: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT", { start: startOfToday, end: endOfToday }),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW", { start: startOfToday, end: endOfToday }),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT", { start: startOfToday, end: endOfToday }),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW", { start: startOfToday, end: endOfToday }),
                ibWithdraw: await getTotalByType("IB-WITHDRAW", { start: startOfToday, end: endOfToday }),
                ibComission: await getTotalByType("IB-COMISSION", { start: startOfToday, end: endOfToday }),
                totalCreditDeposit: await getTotalByType("CREDIT-DEPOSIT", { start: startOfToday, end: endOfToday }),
                totalCreditWithdraw: await getTotalByType("CREDIT-WITHDRAW", { start: startOfToday, end: endOfToday }),
                availableCreditDeposit: await getNetCredit({ start: startOfToday, end: endOfToday })
            },
            week: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT", { start: startOfWeek, end: endOfWeek }),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW", { start: startOfWeek, end: endOfWeek }),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT", { start: startOfWeek, end: endOfWeek }),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW", { start: startOfWeek, end: endOfWeek }),
                ibWithdraw: await getTotalByType("IB-WITHDRAW", { start: startOfWeek, end: endOfWeek }),
                ibComission: await getTotalByType("IB-COMISSION", { start: startOfWeek, end: endOfWeek }),
                totalCreditDeposit: await getTotalByType("CREDIT-DEPOSIT", { start: startOfWeek, end: endOfWeek }),
                totalCreditWithdraw: await getTotalByType("CREDIT-WITHDRAW", { start: startOfWeek, end: endOfWeek }),
                availableCreditDeposit: await getNetCredit({ start: startOfWeek, end: endOfWeek })
            },
            month: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT", { start: startOfMonth, end: endOfMonth }),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW", { start: startOfMonth, end: endOfMonth }),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT", { start: startOfMonth, end: endOfMonth }),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW", { start: startOfMonth, end: endOfMonth }),
                ibWithdraw: await getTotalByType("IB-WITHDRAW", { start: startOfMonth, end: endOfMonth }),
                ibComission: await getTotalByType("IB-COMISSION", { start: startOfMonth, end: endOfMonth }),
                totalCreditDeposit: await getTotalByType("CREDIT-DEPOSIT", { start: startOfMonth, end: endOfMonth }),
                totalCreditWithdraw: await getTotalByType("CREDIT-WITHDRAW", { start: startOfMonth, end: endOfMonth }),
                availableCreditDeposit: await getNetCredit({ start: startOfMonth, end: endOfMonth })
            },
            total: {
                walletDeposit: await getTotalByType("WALLET-DEPOSIT"),
                walletWithdraw: await getTotalByType("WALLET-WITHDRAW"),
                metaDeposit: await getTotalByType("INTERNAL-DEPOSIT"),
                metaWithdraw: await getTotalByType("INTERNAL-WITHDRAW"),
                ibWithdraw: await getTotalByType("IB-WITHDRAW"),
                ibComission: await getTotalByType("IB-COMISSION"),
                totalCreditDeposit: await getTotalByType("CREDIT-DEPOSIT"),
                totalCreditWithdraw: await getTotalByType("CREDIT-WITHDRAW"),
                availableCreditDeposit: await getNetCredit()
            }
        };

        adminLogger.info('Exiting transactionDashboard: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Dashboard Data.",
            data: results
        });
    } catch (e) {
        adminLogger.error('Error in transactionDashboard', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
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
        adminLogger.info('Entering userDashboard', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { userId } = request.query;

        if (!userId) throw CustomErrorHandler.notFound("userId required!");

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.wrongCredentials("Not Found!");

        const totalMt5Account = await Mt5AccountsModel.count({
            where: { userId, isDeleted: false }
        });

        const assetData = await AssetModel.findOne({
            where: { userId, isDeleted: false },
            attributes: ["mainBalance"]
        });

        const data = {
            mainBalance: Number(assetData?.mainBalance || 0),
            totalDeposit: await userGetTotalByType(["DEPOSIT", "WALLET-DEPOSIT"], userId),
            totalWithdraw: await userGetTotalByType(["WITHDRAW", "WALLET-WITHDRAW"], userId),
            totalMt5Account
        };

        adminLogger.info('Exiting userDashboard: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Dashboard Data.",
            data
        });
    } catch (e) {
        adminLogger.error('Error in userDashboard', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};


module.exports.appSetting = async (request, response) => {
    try {
        adminLogger.info('Entering appSetting', { method: request.method || "", route: request.originalUrl || "" });
        const { user, isMentnance, isForceUpdate, iosVersion, androidVersion } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        let appSetting = await AppSetting.findOne();

        if (!appSetting) {
            // Create if not exists
            appSetting = await AppSetting.create({
                isMentnance,
                isForceUpdate,
                iosVersion,
                androidVersion,
                admin: adminData.id
            });
        } else {
            // Update existing
            await appSetting.update({
                isMentnance,
                isForceUpdate,
                iosVersion,
                androidVersion,
                admin: adminData.id
            });
        }

        adminLogger.info('Exiting appSetting: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "App setting updated successfully.",
            data: appSetting
        });
    } catch (e) {
        adminLogger.error('Error in appSetting', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getAppSetting = async (request, response) => {
    try {
        adminLogger.info('Entering getAppSetting', { method: request.method || "", route: request.originalUrl || "" });
        let appSetting = await AppSetting.findOne();

        if (!appSetting) throw CustomErrorHandler.notFound("App Setting not Found!");

        adminLogger.info('Exiting getAppSetting: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "App setting.",
            data: appSetting
        });
    } catch (e) {
        adminLogger.error('Error in getAppSetting', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};