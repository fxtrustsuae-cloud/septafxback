const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const MarketingMemberModel = require("../../models/marketingUser.model");
const MT5AccountModel = require("../../models/mt5Account.model");
const TransactionModel = require("../../models/transaction.model");
const DepositWithdrawModel = require("../../models/depositWithdraw.model");
const sequelize = require("../../config/db.config");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { BankDetails: BankModel, Documents: DocumentModel } = require("../../models/kyc.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");
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

function resolveMarketingMetaTransactionType(type, action) {
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

async function rollbackMetaBalance(mt5Login, type, balance, comment) {
    try {
        const rollbackResult = await TradeRequestControllers.depositWithdraw(
            mt5Login,
            type,
            balance,
            comment
        );

        if (!rollbackResult) {
            marketingLogger.error("Failed to rollback MT5 balance movement.", {
                mt5Login,
                type,
                balance,
                comment,
            });
        }
    } catch (rollbackError) {
        marketingLogger.error("Error while rolling back MT5 balance movement.", {
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
        marketingLogger.info('Entering metaDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, mt5Login, type, amount, comment, paymentMethods, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkMt5Login = await MT5AccountModel.findOne({
            where: { Login: mt5Login }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        const newTransactionType = resolveMarketingMetaTransactionType(type, "DEPOSIT");
        const newDeposit = await TradeRequestControllers.depositWithdraw(
            mt5Login,
            type,
            normalizedAmount,
            newTransactionType
        );
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Deposit Failed!`);

        let newTransaction;
        try {
            newTransaction = await sequelize.transaction((dbTransaction) => {
                return TransactionModel.create({
                    userId,
                    mt5Login,
                    amount: normalizedAmount,
                    transactionType: newTransactionType,
                    remark: comment,
                    paymentMethods, 
                    referrenceNo
                }, { transaction: dbTransaction });
            });
        } catch (transactionError) {
            await rollbackMetaBalance(mt5Login, type, -normalizedAmount, `${newTransactionType}-ROLLBACK`);
            throw transactionError;
        }

        marketingLogger.info('Exiting metaDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Deposited.`,
            data: newTransaction,
        });
    } catch (e) {
        marketingLogger.error('Error in metaDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaWithdraw = async (request, response) => {
    try {
        marketingLogger.info('Entering metaWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, mt5Login, amount, type, comment, paymentMethods, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not Found or Deleted!");

        const checkMt5Login = await MT5AccountModel.findOne({
            where: { Login: mt5Login }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        const newTransactionType = resolveMarketingMetaTransactionType(type, "WITHDRAW");
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
                    paymentMethods,
                    referrenceNo,
                    transactionType: newTransactionType,
                    remark: comment,
                }, { transaction: dbTransaction });
            });
        } catch (transactionError) {
            await rollbackMetaBalance(mt5Login, type, normalizedAmount, `${newTransactionType}-ROLLBACK`);
            throw transactionError;
        }

        marketingLogger.info('Exiting metaWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Withdraw done.`,
            data: newTransaction,
        });
    } catch (e) {
        marketingLogger.error('Error in metaWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.walletDeposit = async (request, response) => {
    try {
        marketingLogger.info('Entering walletDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, amount, comment, paymentMethods, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
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
                referrenceNo
            }, { transaction: dbTransaction });

            assetData.mainBalance = Number(assetData.mainBalance) + normalizedAmount;
            assetData.totalDeposit = Number(assetData.totalDeposit) + normalizedAmount;
            await assetData.save({ transaction: dbTransaction });

            return createdTransaction;
        });

        marketingLogger.info('Exiting walletDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Deposited.`,
            data: newTransaction,
        });
    } catch (e) {
        marketingLogger.error('Error in walletDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.walletWithdraw = async (request, response) => {
    try {
        marketingLogger.info('Entering walletWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, amount, comment, paymentMethods, referrenceNo } = request.body;
        const normalizedAmount = parsePositiveAmount(amount);

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
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
                referrenceNo
            }, { transaction: dbTransaction });

            assetData.mainBalance = Number(assetData.mainBalance) - normalizedAmount;
            assetData.totalWithdrawal = Number(assetData.totalWithdrawal) + normalizedAmount;
            await assetData.save({ transaction: dbTransaction });

            return createdTransaction;
        });

        marketingLogger.info('Exiting walletWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${normalizedAmount} USD Withdraw done.`,
            data: newTransaction,
        });
    } catch (e) {
        marketingLogger.error('Error in walletWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.approveRejectWithdraw = async (request, response) => {
    try {
        marketingLogger.info('Entering approveRejectWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, transactionId, status, remark } = request.body;
        const normalizedStatus = ensureDecisionStatus(status);
        
        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
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

            await pendingWithdraw.save({ transaction: dbTransaction });
            return pendingWithdraw;
        });

        const amount  = Number(transactionData.amount);

        marketingLogger.info('Exiting approveRejectWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: normalizedStatus == "APPROVED" ? `${amount} USDT Withdraw Completed.` : `${amount} USDT Withdraw Rejected.`,
            data: transactionData,
        });
    } catch (e) {
        marketingLogger.error('Error in approveRejectWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// module.exports.internalTransfer = async (request, response) => {
//     try {
//         marketingLogger.info('Entering internalTransfer', { method: request.method || "", route: request.originalUrl || "" });
//         const { user, fromUserId, toUserId, amount } = request.body;

//         const adminData = await MarketingMemberModel.findOne({
//             where: { id: user.id, isDeleted: false }
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

//         marketingLogger.info('Exiting internalTransfer: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
//         return response.json({
//             status: true,
//             message: `${amount} transferred.`,
//             data: newTransaction,
//         });
//     } catch (e) {
//         marketingLogger.error('Error in internalTransfer', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
//         handleErrorResponse(e, response);
//     }
// };

module.exports.transactionList = async (request, response) => {
    try {
        marketingLogger.info('Entering transactionList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, userId, transactionType, status, fromDate, toDate, paymentMethods, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = {};
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

        const { count, rows: usersList } = await TransactionModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                }
            ],
            offset,
        });

        marketingLogger.info('Exiting transactionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in transactionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// OUT/IN Plateform
module.exports.depositWithdrawList = async (request, response) => {
    try {
        marketingLogger.info('Entering depositWithdrawList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, transactionType, status, paymentMethods, fromDate, toDate, search } = request.query;
        const { user } = request.body;

        const userData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = { };
        if (transactionType) where.transactionType = transactionType;
        if (status) where.status = status;
        if (paymentMethods) where.paymentMethods = paymentMethods;

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
                    attributes: ["holderName", "bankName", "accountNo", "ibanNo", "ifscCode", "bankAddress", "country"] 
                }
            ],
            offset,
        });

        const host = `${request.protocol}://${request.get("host")}`;
        const depositWithdrawList = rows.map((list) => {
            return {
                ...list.toJSON(),
                image: list.image
                    ? `${host}/public/depositWithdraw/${list.image}`
                    : null,
            };
        });

        marketingLogger.info('Exiting depositWithdrawList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in depositWithdrawList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.singleDepositWithdraw = async (request, response) => {
    try {
        marketingLogger.info('Entering singleDepositWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        const userData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const depositWithdrawData = await DepositWithdrawModel.findOne({
            where: { id, isDeleted: false },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                }
            ],
        });

        if(!depositWithdrawData) throw CustomErrorHandler.notFound("Not Found!");

        const host = `${request.protocol}://${request.get("host")}`;
        depositWithdrawData.image = `${host}/public/depositWithdraw/${depositWithdrawData.image}`;
       
        marketingLogger.info('Exiting singleDepositWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Depsosit/Withdraw Data.",
            data: depositWithdrawData,
        });
    } catch (e) {
        marketingLogger.error('Error in singleDepositWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.apporveRejectDepositWithdraw = async (request, response) => {
    try {
        marketingLogger.info('Entering apporveRejectDepositWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, depositId, status, remark } = request.body;
        const normalizedStatus = ensureDecisionStatus(status);

        const userData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

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
            if (normalizedStatus == "APPROVED") {
                if (pendingTransaction.transactionType == "DEPOSIT") {
                    assetData.mainBalance = Number(assetData.mainBalance) + amount;
                    assetData.totalDeposit = Number(assetData.totalDeposit) + amount;
                } else {
                    assetData.totalWithdrawal = Number(assetData.totalWithdrawal) + amount;
                }

                await TransactionModel.create({
                    userId: pendingTransaction.userId,
                    amount,
                    transactionType: pendingTransaction.transactionType == "DEPOSIT" ? "WALLET-DEPOSIT" : "WALLET-WITHDRAW",
                    remark,
                }, { transaction: dbTransaction });
            } else if (pendingTransaction.transactionType != "DEPOSIT") {
                assetData.mainBalance = Number(assetData.mainBalance) + amount;
            }

            await assetData.save({ transaction: dbTransaction });

            pendingTransaction.status = normalizedStatus;
            pendingTransaction.remark = remark;
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

        marketingLogger.info('Exiting apporveRejectDepositWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: normalizedStatus,
            data: depositWithdrawData,
        });
    } catch (e) {
        marketingLogger.error('Error in apporveRejectDepositWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
