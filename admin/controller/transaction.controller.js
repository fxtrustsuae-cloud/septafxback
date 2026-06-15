const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const MT5AccountModel = require("../../models/mt5Account.model");
const TransactionModel = require("../../models/transaction.model");
const DepositWithdrawModel = require("../../models/depositWithdraw.model");
const PaymentChargeModel = require("../../models/paymentCharge.model");
const sequelize = require("../../config/db.config");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { BankDetails: BankModel, Documents: DocumentModel } = require("../../models/kyc.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { createExcelExport, getExcelHeaders, generateFileName } = require("../../utils/excelExport");
const { adminLogger } = require("../../utils/logger");
const SendMail = require("../../utils/mail");

function parsePositiveAmount(value, fieldName = "Amount") {
    const normalizedValue = Number(value);
    if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
        throw CustomErrorHandler.notAllowed(`${fieldName} must be a positive number!`);
    }

    return normalizedValue;
}

function ensureDecisionStatus(status) {
    if (!["APPROVED", "REJECTED"].includes(status)) {
        throw CustomErrorHandler.notAllowed("Invalid status!");
    }

    return status;
}

function calculatePaymentCharge(amountValue, activeCharge) {
    const amount = Number(amountValue) || 0;
    let chargeAmount = 0;

    if (activeCharge && amount > 0) {
        const chargeValue = Number(activeCharge.chargeValue);
        chargeAmount = activeCharge.chargeType === "PERCENTAGE"
            ? (amount * chargeValue) / 100
            : chargeValue;
        chargeAmount = Math.min(parseFloat(chargeAmount.toFixed(2)), amount);
    }

    return {
        grossAmount: amount,
        chargeAmount,
        netAmount: parseFloat((amount - chargeAmount).toFixed(2)),
    };
}

function resolveAdminClientTransactionType(type, action) {
    if (type == 2) {
        return action === "DEPOSIT" ? "CLIENT-DEPOSIT" : "CLIENT-WITHDRAW";
    }

    if (type == 3) {
        return action === "DEPOSIT" ? "CREDIT-DEPOSIT" : "CREDIT-WITHDRAW";
    }

    if (type == 6) {
        return action === "DEPOSIT" ? "BONUS-DEPOSIT" : "BONUS-WITHDRAW";
    }

    throw CustomErrorHandler.notAllowed("Unsupported MT5 transaction type!");
}

function resolveAdminInternalTransactionType(type, action) {
    if (type == 2) {
        return action === "DEPOSIT" ? "INTERNAL-DEPOSIT" : "INTERNAL-WITHDRAW";
    }

    if (type == 3) {
        return action === "DEPOSIT" ? "CREDIT-DEPOSIT" : "CREDIT-WITHDRAW";
    }

    if (type == 6) {
        return action === "DEPOSIT" ? "BONUS-DEPOSIT" : "BONUS-WITHDRAW";
    }

    throw CustomErrorHandler.notAllowed("Unsupported MT5 transaction type!");
}

async function rollbackMetaBalance(mt5Login, type, balance, comment) {
    try {
        const rollbackResult = await TradeRequestControllers.depositWithdraw(
            mt5Login,
            type,
            balance,
            comment
        );

        if (!rollbackResult) {
            adminLogger.error("Failed to rollback MT5 balance movement.", {
                mt5Login,
                type,
                balance,
                comment,
            });
        }
    } catch (rollbackError) {
        adminLogger.error("Error while rolling back MT5 balance movement.", {
            mt5Login,
            type,
            balance,
            comment,
            stack: rollbackError.stack || rollbackError,
        });
    }
}

module.exports.metaDeposit = async (request, response) => {
    try {
        adminLogger.info('Entering metaDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, mt5Login, type, amount, comment, referrenceNo, expireDays } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkMt5Login = await MT5AccountModel.findOne({
            where: { Login: mt5Login }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        const newTransactionType = resolveAdminClientTransactionType(type, "DEPOSIT");
        const newDeposit = await TradeRequestControllers.depositWithdraw(
            mt5Login,
            type,
            normalizedAmount,
            newTransactionType
        );
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Deposit Failed!`);

        let expireAt = null;
        if(expireDays) {
            expireAt = new Date();
            expireAt.setDate(expireAt.getDate() + Number(expireDays));
        }

        let newTransaction;
        try {
            newTransaction = await sequelize.transaction((dbTransaction) => {
                return TransactionModel.create({
                    userId,
                    mt5Login,
                    amount: normalizedAmount,
                    transactionType: newTransactionType,
                    remark: comment,
                    referrenceNo,
                    expireAt,
                    admin: adminData.id
                }, { transaction: dbTransaction });
            });
        } catch (transactionError) {
            await rollbackMetaBalance(mt5Login, type, -normalizedAmount, `${newTransactionType}-ROLLBACK`);
            throw transactionError;
        }

        adminLogger.info('Exiting metaDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Deposited.`,
            data: newTransaction,
        });
    } catch (e) {
        adminLogger.error('Error in metaDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaWithdraw = async (request, response) => {
    try {
        adminLogger.info('Entering metaWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, mt5Login, amount, type, comment, paymentMethods, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkMt5Login = await MT5AccountModel.findOne({
            where: { Login: mt5Login }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        const newTransactionType = resolveAdminClientTransactionType(type, "WITHDRAW");
        const newDeposit = await TradeRequestControllers.depositWithdraw(
            mt5Login,
            type,
            -normalizedAmount,
            newTransactionType
        );
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Withdraw Failed!`);

        let newTransaction;
        try {
            newTransaction = await sequelize.transaction((dbTransaction) => {
                return TransactionModel.create({
                    userId,
                    mt5Login,
                    amount: normalizedAmount,
                    referrenceNo,
                    transactionType: newTransactionType,
                    remark: comment,
                    paymentMethods,
                    admin: adminData.id
                }, { transaction: dbTransaction });
            });
        } catch (transactionError) {
            await rollbackMetaBalance(mt5Login, type, normalizedAmount, `${newTransactionType}-ROLLBACK`);
            throw transactionError;
        }

        adminLogger.info('Exiting metaWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Withdraw done.`,
            data: newTransaction,
        });
    } catch (e) {
        adminLogger.error('Error in metaWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.walletToMetaDeposit = async (request, response) => {
    try {
        adminLogger.info('Entering walletToMetaDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, mt5Login, type, amount, comment, referrenceNo, expireDays } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkMt5Login = await MT5AccountModel.findOne({
            where: { Login: mt5Login }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        const newTransactionType = resolveAdminInternalTransactionType(type, "DEPOSIT");
        const newDeposit = await TradeRequestControllers.depositWithdraw(
            mt5Login,
            type,
            normalizedAmount,
            newTransactionType
        );
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Deposit Failed!`);

        let expireAt = null;
        if(expireDays) {
            expireAt = new Date();
            expireAt.setDate(expireAt.getDate() + Number(expireDays));
        }

        let newTransaction;
        try {
            newTransaction = await sequelize.transaction(async (dbTransaction) => {
                if (type == 2) {
                    const assetData = await AssetModel.findOne({
                        where: { userId: checkUser.id, isDeleted: false },
                        transaction: dbTransaction,
                        lock: dbTransaction.LOCK.UPDATE,
                    });
                    if (!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");
                    if (Number(assetData.mainBalance) < normalizedAmount) {
                        throw CustomErrorHandler.lowBalance("Low Balance!");
                    }

                    assetData.mainBalance = Number(assetData.mainBalance) - normalizedAmount;
                    await assetData.save({ transaction: dbTransaction });
                }

                return TransactionModel.create({
                    userId,
                    mt5Login,
                    amount: normalizedAmount,
                    transactionType: newTransactionType,
                    remark: comment,
                    referrenceNo,
                    expireAt,
                    admin: adminData.id
                }, { transaction: dbTransaction });
            });
        } catch (transactionError) {
            await rollbackMetaBalance(mt5Login, type, -normalizedAmount, `${newTransactionType}-ROLLBACK`);
            throw transactionError;
        }

        adminLogger.info('Exiting walletToMetaDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Deposited.`,
            data: newTransaction,
        });
    } catch (e) {
        adminLogger.error('Error in walletToMetaDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaToWalletWithdraw = async (request, response) => {
    try {
        adminLogger.info('Entering metaToWalletWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, mt5Login, amount, type, comment, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkMt5Login = await MT5AccountModel.findOne({
            where: { Login: mt5Login }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        const newTransactionType = resolveAdminInternalTransactionType(type, "WITHDRAW");
        const newDeposit = await TradeRequestControllers.depositWithdraw(
            mt5Login,
            type,
            -normalizedAmount,
            newTransactionType
        );
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Withdraw Failed!`);

        let newTransaction;
        try {
            newTransaction = await sequelize.transaction(async (dbTransaction) => {
                if (type == 2) {
                    const assetData = await AssetModel.findOne({
                        where: { userId: checkUser.id, isDeleted: false },
                        transaction: dbTransaction,
                        lock: dbTransaction.LOCK.UPDATE,
                    });
                    if (!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");

                    assetData.mainBalance = Number(assetData.mainBalance) + normalizedAmount;
                    await assetData.save({ transaction: dbTransaction });
                }

                return TransactionModel.create({
                    userId,
                    mt5Login,
                    amount: normalizedAmount,
                    referrenceNo,
                    transactionType: newTransactionType,
                    remark: comment,
                    admin: adminData.id
                }, { transaction: dbTransaction });
            });
        } catch (transactionError) {
            await rollbackMetaBalance(mt5Login, type, normalizedAmount, `${newTransactionType}-ROLLBACK`);
            throw transactionError;
        }

        adminLogger.info('Exiting metaToWalletWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Withdraw done.`,
            data: newTransaction,
        });
    } catch (e) {
        adminLogger.error('Error in metaToWalletWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.removeBonus = async (request, response) => {
    try {
        adminLogger.info('Entering removeBonus', { method: request.method || "", route: request.originalUrl || "" });
        const { user, bonusId } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const depositData = await TransactionModel.findOne({
            where: { id: bonusId, transactionType: "CREDIT-DEPOSIT", isDeleted: false }
        }); if(!depositData) throw CustomErrorHandler.notFound("Not Found!");

        const newDeposit = await TradeRequestControllers.depositWithdraw(depositData.mt5Login, 3, -(depositData.amount));
        if(!newDeposit) throw CustomErrorHandler.serverError(`Failed to remove Bonus!`);

        depositData.isDeleted = true;
        await depositData.save()

        await TransactionModel.create({
            userId: depositData.userId,
            mt5Login: depositData.mt5Login,
            amount: depositData.amount,
            transactionType: "CREDIT-WITHDRAW",
            remark: "Bonus Removed.",
        });

        adminLogger.info('Exiting removeBonus: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${depositData.amount} USD Removed.`,
            data: depositData,
        });
    } catch (e) {
        adminLogger.error('Error in removeBonus', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.walletDeposit = async (request, response) => {
    try {
        adminLogger.info('Entering walletDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, amount, comment, paymentMethods, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkAsset = await AssetModel.findOne({
            where: { userId, isDeleted: false }
        }); if(!checkAsset) throw CustomErrorHandler.notFound("Asset Details Not Found!");

        const newTransaction = await sequelize.transaction(async (dbTransaction) => {
            const assetData = await AssetModel.findOne({
                where: { userId, isDeleted: false },
                transaction: dbTransaction,
                lock: dbTransaction.LOCK.UPDATE,
            });
            if (!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");

            const createdTransaction = await TransactionModel.create({
                userId,
                amount: normalizedAmount,
                transactionType: "WALLET-DEPOSIT",
                remark: comment,
                paymentMethods, 
                referrenceNo,
                admin: adminData.id
            }, { transaction: dbTransaction });

            assetData.mainBalance = Number(assetData.mainBalance) + normalizedAmount;
            assetData.totalDeposit = Number(assetData.totalDeposit) + normalizedAmount;
            await assetData.save({ transaction: dbTransaction });

            return createdTransaction;
        });

        adminLogger.info('Exiting walletDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Deposited.`,
            data: newTransaction,
        });
    } catch (e) {
        adminLogger.error('Error in walletDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.walletWithdraw = async (request, response) => {
    try {
        adminLogger.info('Entering walletWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, amount, comment, paymentMethods, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkAsset = await AssetModel.findOne({
            where: { userId, isDeleted: false }
        }); if(!checkAsset) throw CustomErrorHandler.notFound("Asset Details Not Found!");

        if(Number(checkAsset.mainBalance) < normalizedAmount) {
            throw CustomErrorHandler.wrongCredentials("Low Balance!");
        }

        const newTransaction = await sequelize.transaction(async (dbTransaction) => {
            const assetData = await AssetModel.findOne({
                where: { userId, isDeleted: false },
                transaction: dbTransaction,
                lock: dbTransaction.LOCK.UPDATE,
            });
            if (!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");
            if (Number(assetData.mainBalance) < normalizedAmount) {
                throw CustomErrorHandler.wrongCredentials("Low Balance!");
            }

            const createdTransaction = await TransactionModel.create({
                userId,
                amount: normalizedAmount,
                transactionType: "WALLET-WITHDRAW",
                remark: comment,
                paymentMethods, 
                referrenceNo,
                admin: adminData.id
            }, { transaction: dbTransaction });

            assetData.mainBalance = Number(assetData.mainBalance) - normalizedAmount;
            assetData.totalWithdrawal = Number(assetData.totalWithdrawal) + normalizedAmount;
            await assetData.save({ transaction: dbTransaction });

            return createdTransaction;
        });

        adminLogger.info('Exiting walletWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Withdraw done.`,
            data: newTransaction,
        });
    } catch (e) {
        adminLogger.error('Error in walletWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// USDT withdraw Approval
module.exports.approveRejectWithdraw = async (request, response) => {
    try {
        adminLogger.info('Entering approveRejectWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, transactionId, status, remark } = request.body;
        const normalizedStatus = ensureDecisionStatus(status);
        
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const transactionData = await sequelize.transaction(async (dbTransaction) => {
            const pendingWithdraw = await DepositWithdrawModel.findOne({
                where: {
                    id: transactionId,
                    transactionType: "WITHDRAW",
                    isDeleted: false,
                },
                transaction: dbTransaction,
                lock: dbTransaction.LOCK.UPDATE,
            });
            if (!pendingWithdraw) throw CustomErrorHandler.notFound("Withdraw request Not Found!");
            if (pendingWithdraw.status == "COMPLETED") {
                throw CustomErrorHandler.alreadyExist("Already Approved!");
            }
            if (pendingWithdraw.status == "REJECTED") {
                throw CustomErrorHandler.alreadyExist("Already Rejected!");
            }

            const amount = Number(pendingWithdraw.amount);
            if (normalizedStatus == "APPROVED") {
                pendingWithdraw.status = "COMPLETED";
                pendingWithdraw.remark = remark ? remark : `${amount} approved by admin.`;

                await TransactionModel.create({
                    userId: pendingWithdraw.userId,
                    amount,
                    transactionType: "WALLET-WITHDRAW",
                    remark: pendingWithdraw.remark,
                    admin: adminData.id
                }, { transaction: dbTransaction });
            } else {
                const assetData = await AssetModel.findOne({
                    where: { userId: pendingWithdraw.userId, isDeleted: false },
                    transaction: dbTransaction,
                    lock: dbTransaction.LOCK.UPDATE,
                });
                if (!assetData) throw CustomErrorHandler.notFound("Failed To Fetch Asset Data!");

                pendingWithdraw.status = "REJECTED";
                pendingWithdraw.remark = remark ? remark : "Rejected By admin.";
                assetData.mainBalance = Number(assetData.mainBalance) + amount;
                await assetData.save({ transaction: dbTransaction });
            }

            pendingWithdraw.approvedBy = adminData.id;
            await pendingWithdraw.save({ transaction: dbTransaction });
            return pendingWithdraw;
        });

        const amount = Number(transactionData.amount);

        adminLogger.info('Exiting approveRejectWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: normalizedStatus == "APPROVED" ? `${amount} USDT Withdraw Completed.` : `${amount} USDT Withdraw Rejected.`,
            data: transactionData,
        });
    } catch (e) {
        adminLogger.error('Error in approveRejectWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// module.exports.internalTransfer = async (request, response) => {
//     try {
//         adminLogger.info('Entering internalTransfer', { method: request.method || "", route: request.originalUrl || "" });
//         const { user, fromUserId, toUserId, amount } = request.body;

//         const adminData = await UserModel.findOne({
//             where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
//         });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

//         const checkFromUser = await UserModel.findOne({
//             where: { id: fromUserId, isDeleted: false }
//         }); if(!checkFromUser) throw CustomErrorHandler.notFound("From User Not Found or Deleted!");
        
//         const checkToUser = await UserModel.findOne({
//             where: { id: toUserId, isDeleted: false }
//         }); if(!checkToUser) throw CustomErrorHandler.notFound("To User Not Found or Deleted!");

//         const checkFromUserAsset = await AssetModel.findOne({
//             where: { userId: fromUserId, isDeleted: false }
//         }); if(!checkFromUserAsset) throw CustomErrorHandler.notFound("From User Asset Details Not Found!");
        
//         const checkToUserAsset = await AssetModel.findOne({
//             where: { userId: toUserId, isDeleted: false }
//         }); if(!checkToUserAsset) throw CustomErrorHandler.notFound("To User Asset Details Not Found!");

//         if(checkFromUserAsset.mainBalance < amount){
//             throw CustomErrorHandler.lowBalance("Insufficent Balance!");
//         };
        
//         // for from user
//         const newTransaction = await TransactionModel.create({
//             userId: fromUserId,
//             amount,
//             transactionType: "INTERNAL-TRANSFER",
//             remark: `Transfer Done by Admin, ${amount} send to user ${checkToUser.userName}`,
//         });

//         // for recepient
//         await TransactionModel.create({
//             userId: toUserId,
//             amount,
//             transactionType: "INTERNAL-TRANSFER",
//             remark: `Transfer Done by Admin, ${amount} received from user ${checkToUser.userName}`,
//         });

//         checkFromUserAsset.mainBalance -= float(amount);
//         checkFromUserAsset.totalInternalTransfer += float(amount);
//         await checkFromUserAsset.save();

//         checkToUserAsset.mainBalance += float(amount);
//         await checkToUserAsset.save();

//         adminLogger.info('Exiting internalTransfer: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
//         return response.json({
//             status: true,
//             message: `${amount} transferred.`,
//             data: newTransaction,
//         });
//     } catch (e) {
//         adminLogger.error('Error in internalTransfer', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
//         handleErrorResponse(e, response);
//     }
// };

module.exports.transactionList = async (request, response) => {
    try {
        adminLogger.info('Entering transactionList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, userId, transactionType, status, fromDate, toDate, paymentMethods, search, isDeleted, fileExport: isExport } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = isExport === 'true' ? 0 : (page - 1) * sizePerPage;
        const limit = isExport === 'true' ? 100000 : sizePerPage;

        let where = { };
        if (transactionType) where.transactionType = transactionType;
        if (status) where.status = status;
        if (paymentMethods) where.paymentMethods = paymentMethods;
        if (isDeleted) where.isDeleted = isDeleted;
        if (userId) where.userId = userId;

        const searchCondition = search
            ? {
                  [Op.or]: [
                      { name: { [Op.iLike]: `%${search}%` } },
                      { email: { [Op.iLike]: `%${search}%` } },
                      { mobile: { [Op.iLike]: `%${search}%` } },
                      { userName: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        if (fromDate && toDate) {
            where.createdAt = {
                [Op.between]: [new Date(fromDate), new Date(toDate)],
            };
        } else if (fromDate) {
            where.createdAt = {
                [Op.gte]: new Date(fromDate),
            };
        } else if (toDate) {
            where.createdAt = {
                [Op.lte]: new Date(toDate),
            };
        }

        const { count, rows: usersList } = await TransactionModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                    where: searchCondition ,
                },
                {
                    model: UserModel,
                    as: "byAdmin",
                    attributes: ["id", "name", "email", "userName"],
                    required: false,
                }
            ],
            offset,
        });

        // If export is requested, return Excel file
        if (isExport === 'true') {
            const exportData = usersList.map(tx => {
                return {
                    "ID": tx.id || "",
                    "User Name": tx.user?.name || "",
                    "User Email": tx.user?.email || "",
                    "MT5 Login ID": tx.mt5Login || "",
                    "Transaction Type": tx.transactionType || "",
                    "Payment Methods": tx.paymentMethods || "",
                    "Reference No.": tx.referrenceNo || "",
                    "Amount": tx.amount ?? "",
                    "Status": tx.status || "",
                    "Approved By": tx.byAdmin?.email || "",
                    "Remark": tx.remark || "",
                    "Registration Date": tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "",
                };
            });

            const excelBuffer = createExcelExport(exportData, {
                emailFields: [],
                sheetName: 'Transaction List',
                fileName: generateFileName('transaction_list')
            });

            return response.set(getExcelHeaders('transaction_list.xlsx'))
                .send(excelBuffer);
        }

        adminLogger.info('Exiting transactionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in transactionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// OUT/IN Plateform
module.exports.depositWithdrawList = async (request, response) => {
    try {
        adminLogger.info('Entering depositWithdrawList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, userId, transactionType, status, paymentMethods, fromDate, toDate, search, fileExport: isExport } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = isExport === 'true' ? 0 : (page - 1) * sizePerPage;
        const limit = isExport === 'true' ? 100000 : sizePerPage;

        let where = { };
        if (transactionType) where.transactionType = transactionType;
        if (status) where.status = status;
        if (paymentMethods) where.paymentMethods = paymentMethods;
        if (userId) where.userId = userId;

        if (search) {
            where[Op.or] = [
                { referrenceNo: { [Op.iLike]: `%${search}%` } },
                { id: { [Op.iLike]: `%${search}%` } },
            ];
        }

        if (fromDate && toDate) {
            where.createdAt = {
                [Op.between]: [new Date(fromDate), new Date(toDate)],
            };
        } else if (fromDate) {
            where.createdAt = {
                [Op.gte]: new Date(fromDate),
            };
        } else if (toDate) {
            where.createdAt = {
                [Op.lte]: new Date(toDate),
            };
        }

        const { count, rows } = await DepositWithdrawModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                },
                {
                    model: BankModel,
                    as: "bank",
                    attributes: ["holderName", "bankName", "accountNo", "ibanNo", "ifscCode", "bankAddress", "country"],
                    required: false
                }
            ],
            offset,
        });

        const activePaymentCharges = await PaymentChargeModel.findAll({
            where: {
                applicableFor: { [Op.in]: ["DEPOSIT", "WITHDRAWAL"] },
                status: "ACTIVE",
                isDeleted: false,
            },
        });
        const paymentChargeByType = activePaymentCharges.reduce((acc, charge) => {
            acc[charge.applicableFor] = charge;
            return acc;
        }, {});

        const host = `${request.protocol}://${request.get("host")}`;
        const depositWithdrawList = rows.map((list) => {
            const transaction = list.toJSON();
            const applicableFor = transaction.transactionType === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL";
            const chargeDetails = calculatePaymentCharge(transaction.amount, paymentChargeByType[applicableFor]);

            return {
                ...transaction,
                ...chargeDetails,
                image: list.image
                    ? `${host}/public/depositWithdraw/${list.image}`
                    : null,
            };
        });

        if (isExport === 'true') {
            const approvedByIds = [
                ...new Set(depositWithdrawList.map((item) => item.approvedBy).filter(Boolean)),
            ];
            const approvingAdmins = approvedByIds.length > 0
                ? await UserModel.findAll({
                    where: { id: { [Op.in]: approvedByIds } },
                    attributes: ["id", "name", "email", "userName"],
                })
                : [];
            const approvingAdminById = approvingAdmins.reduce((acc, admin) => {
                acc[admin.id] = admin.email || admin.name || admin.userName || admin.id;
                return acc;
            }, {});

            const exportData = depositWithdrawList.map((item) => {
                const displayAmount = item.status === "PENDING" && item.transactionType === "WITHDRAW"
                    ? item.netAmount
                    : item.amount;

                return {
                    "ID": item.id || "",
                    "Name": item.user?.name || "",
                    "Email": item.user?.email || "",
                    "Amount": displayAmount ?? "",
                    "Deposit Proof": item.image || "",
                    "Transaction Type": item.transactionType || "",
                    "Payment Methods": item.paymentMethods || "",
                    "Network": item.network || "",
                    "Wallet Address": item.walletAddress || "",
                    "Transaction Reference": item.transactionReference || "",
                    "Remark": item.remark || "",
                    "Status": item.status || "",
                    "Approved By": item.approvedBy ? approvingAdminById[item.approvedBy] || item.approvedBy : "",
                    "Date": item.createdAt ? new Date(item.createdAt).toLocaleString() : "",
                };
            });

            const excelBuffer = createExcelExport(exportData, {
                sheetName: 'Pending Transactions',
                fileName: generateFileName('pending_transactions')
            });

            return response.set(getExcelHeaders('pending_transactions.xlsx'))
                .send(excelBuffer);
        }

        adminLogger.info('Exiting depositWithdrawList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Depsosit/Withdraw list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                depositWithdrawList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in depositWithdrawList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.singleDepositWithdraw = async (request, response) => {
    try {
        adminLogger.info('Entering singleDepositWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const depositWithdrawData = await DepositWithdrawModel.findOne({
            where: { id, isDeleted: false },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                },
                {
                    model: BankModel,
                    as: "bank",
                    attributes: ["holderName", "bankName", "accountNo", "ibanNo", "ifscCode", "bankAddress", "country"],
                    required: false
                }
            ],
        });

        if(!depositWithdrawData) throw CustomErrorHandler.notFound("Not Found!");

        const host = `${request.protocol}://${request.get("host")}`;
        depositWithdrawData.image = `${host}/public/depositWithdraw/${depositWithdrawData.image}`;
       
        adminLogger.info('Exiting singleDepositWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Depsosit/Withdraw Data.",
            data: depositWithdrawData,
        });
    } catch (e) {
        adminLogger.error('Error in singleDepositWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.apporveRejectDepositWithdraw = async (request, response) => {
    try {
        adminLogger.info('Entering apporveRejectDepositWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, depositId, status, remark } = request.body;
        const normalizedStatus = ensureDecisionStatus(status);

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const depositWithdrawData = await sequelize.transaction(async (dbTransaction) => {
            const pendingTransaction = await DepositWithdrawModel.findOne({
                where: { id: depositId, isDeleted: false },
                transaction: dbTransaction,
                lock: dbTransaction.LOCK.UPDATE,
            });
            if (!pendingTransaction) throw CustomErrorHandler.notFound("Not Found!");
            if (pendingTransaction.status != "PENDING") {
                throw CustomErrorHandler.alreadyExist("Deposit/Withdraw is already approved/rejected!");
            }

            const assetData = await AssetModel.findOne({
                where: { userId: pendingTransaction.userId, isDeleted: false },
                transaction: dbTransaction,
                lock: dbTransaction.LOCK.UPDATE,
            });
            if (!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");

            const amount = Number(pendingTransaction.amount);

            // Calculate payment charge deduction for both deposits and withdrawals
            let chargeAmount = 0;
            if (normalizedStatus === "APPROVED") {
                const txApplicableFor = pendingTransaction.transactionType === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL";
                const activeCharge = await PaymentChargeModel.findOne({
                    where: { applicableFor: txApplicableFor, status: "ACTIVE", isDeleted: false },
                });
                if (activeCharge) {
                    chargeAmount = calculatePaymentCharge(amount, activeCharge).chargeAmount;
                }
            }
            const netAmount = parseFloat((amount - chargeAmount).toFixed(2));

            if (normalizedStatus == "APPROVED") {
                if (pendingTransaction.transactionType == "DEPOSIT") {
                    // Credit only the net amount (gross minus charge) to the wallet
                    assetData.mainBalance = Number(assetData.mainBalance) + netAmount;
                    assetData.totalDeposit = Number(assetData.totalDeposit) + amount;
                } else {
                    // For withdrawals, mainBalance was already deducted on submission.
                    // Track gross withdrawal; the net amount is what the user actually receives.
                    assetData.totalWithdrawal = Number(assetData.totalWithdrawal) + amount;
                }

                const txRemark = chargeAmount > 0
                    ? `${remark || ""}${remark ? " | " : ""}Charge deducted: ${chargeAmount}`
                    : (remark || "");

                await TransactionModel.create({
                    userId: pendingTransaction.userId,
                    amount: netAmount,
                    transactionType: pendingTransaction.transactionType == "DEPOSIT" ? "WALLET-DEPOSIT" : "WALLET-WITHDRAW",
                    remark: txRemark,
                    referrenceNo: pendingTransaction.walletAddress ? pendingTransaction.walletAddress : "",
                    admin: adminData.id
                }, { transaction: dbTransaction });
            } else if (pendingTransaction.transactionType != "DEPOSIT") {
                // Rejected withdrawal: refund the full amount (no charge applies)
                assetData.mainBalance = Number(assetData.mainBalance) + amount;
            }

            await assetData.save({ transaction: dbTransaction });

            pendingTransaction.status = normalizedStatus;
            pendingTransaction.remark = remark;
            pendingTransaction.approvedBy = adminData.id;
            await pendingTransaction.save({ transaction: dbTransaction });
            return pendingTransaction;
        });

        if (normalizedStatus === "APPROVED" && depositWithdrawData.transactionType === "DEPOSIT") {
            const depositor = await UserModel.findOne({ where: { id: depositWithdrawData.userId, isDeleted: false }, attributes: ["name", "email"] });
            if (depositor) {
                SendMail.sendTransactionAlertEmail(
                    depositor.email,
                    depositor.name,
                    "DEPOSIT",
                    `$${Number(depositWithdrawData.amount).toFixed(2)}`,
                    depositWithdrawData.id,
                    new Date(),
                ).catch(() => {});
            }
        }

        adminLogger.info('Exiting apporveRejectDepositWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: normalizedStatus,
            data: depositWithdrawData,
        });
    } catch (e) {
        adminLogger.error('Error in apporveRejectDepositWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateDepositWithdrawAmount = async (request, response) => {
    try {
        adminLogger.info('Entering updateDepositWithdrawAmount', { method: request.method || "", route: request.originalUrl || "" });
        const { user, depositId, amount, remark } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const depositWithdrawData = await DepositWithdrawModel.findOne({
            where: { id: depositId, isDeleted: false }
        }); if (!depositWithdrawData) throw CustomErrorHandler.notFound("Not Found!");

        if (depositWithdrawData.status !== "PENDING") {
            throw CustomErrorHandler.alreadyExist("Only pending Deposit/Withdraw amount can be updated!");
        }

        if (depositWithdrawData.transactionType !== "DEPOSIT") {
            throw CustomErrorHandler.notAllowed("This API allows amount update only for pending DEPOSIT requests!");
        }

        const oldAmount = Number(depositWithdrawData.amount);
        const newAmount = Number(amount);

        if (oldAmount === newAmount) throw CustomErrorHandler.alreadyExist("The new amount is the same as the old amount!");

        depositWithdrawData.amount = newAmount;
        if (remark) depositWithdrawData.remark = remark;
        depositWithdrawData.approvedBy = adminData.id;
        await depositWithdrawData.save();

        adminLogger.info('Exiting updateDepositWithdrawAmount: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deposit/Withdraw amount updated.",
            data: depositWithdrawData,
        });
    } catch (e) {
        adminLogger.error('Error in updateDepositWithdrawAmount', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ibWithdraw = async (request, response) => {
    try {
        adminLogger.info('Entering ibWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ibId, amount } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");
        
        const userData = await UserModel.findOne({
            where: { id: ibId, role: "USER", isDeleted: false, isIb: true }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Ib not Found!");

        const assetData = await AssetModel.findOne({
            where: { userId: userData.id }
        }); if(!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");

        const availableAmount = Number(assetData.totalIBIncome) - Number(assetData.totalIBWithdrawl);

        if(availableAmount < normalizedAmount) throw CustomErrorHandler.wrongCredentials("Low Available Comission Balance!");

        const newWithdraw = await sequelize.transaction(async (dbTransaction) => {
            const lockedAssetData = await AssetModel.findOne({
                where: { userId: userData.id, isDeleted: false },
                transaction: dbTransaction,
                lock: dbTransaction.LOCK.UPDATE,
            });
            if (!lockedAssetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");

            const lockedAvailableAmount = Number(lockedAssetData.totalIBIncome) - Number(lockedAssetData.totalIBWithdrawl);
            if (lockedAvailableAmount < normalizedAmount) {
                throw CustomErrorHandler.wrongCredentials("Low Available Comission Balance!");
            }

            const createdWithdraw = await TransactionModel.create({
                userId: userData.id,
                amount: normalizedAmount,
                transactionType: "IB-WITHDRAW",
                remark: "Transferred to main Balance",
                admin: adminData.id
            }, { transaction: dbTransaction });

            lockedAssetData.totalIBWithdrawl = Number(lockedAssetData.totalIBWithdrawl) + normalizedAmount;
            lockedAssetData.mainBalance = Number(lockedAssetData.mainBalance) + normalizedAmount;
            await lockedAssetData.save({ transaction: dbTransaction });

            return createdWithdraw;
        });

        adminLogger.info('Exiting ibWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} Transferred to Main balance.`,
            data: newWithdraw
        });
    } catch (e) {
        adminLogger.error('Error in ibWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
