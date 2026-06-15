const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const speakeasy = require('speakeasy');
const SendMail = require("../../utils/mail");
const config = require("../../config/config");
const IbController = require("./ib.controller");
const IbModel = require("../../models/ib.model");
const OtpModel = require("../../models/otp.model");
const SendOtpMobile = require("../../utils/twilio");
const BankModel = require("../../models/kyc.model");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const MfaModel = require("../../models/mfaSecret.model");
const PasswordModel = require("../../models/password.model");
const Mt5OrderModel = require("../../models/mt5order.model");
const Mt5AccountModel = require("../../models/mt5Account.model");
const PromotionalModel = require("../../models/promotional.model");
const TransactionModel = require("../../models/transaction.model");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const MetaControllers = require("../../mt5Services/user");
const DepositWithdrawModel = require("../../models/depositWithdraw.model");
const { actionTracking, generateNumericString } = require("../../helpers/index");
const IbcomissionTrxModel = require("../../models/ibComissionTransaction.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { BankDetails: BankDetailsModel, Documents: DocumentModel } = require("../../models/kyc.model");
const { userLogger } = require("../../utils/logger");

// Get Transaction list
module.exports.transactionList = async (request, response) => {
    try {
        userLogger.info('Entering transactionList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, login, transactionType, status, fromDate, toDate, paymentMethods, search } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        if (login) {
            const metaUser = await Mt5AccountModel.findOne({
                where: { userId: user.id, Login: login, isDeleted: false }
            }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Mt5 Account Not Found!");
        };

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = { userId: userData.id };
        if (transactionType) where.transactionType = transactionType;
        if (status) where.status = status;
        if (paymentMethods) where.paymentMethods = paymentMethods;
        if (login) where.mt5Login = login;

        if (search) {
            where[Op.or] = [
                { referrenceNo: { [Op.iLike]: `%${search}%` } },
                { id: { [Op.iLike]: `%${search}%` } },
            ];
        };

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
            offset,
        });

        actionTracking(request, userData.id, "TRANSACTIONLIST");

        userLogger.info('Exiting transactionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        userLogger.error('Error in transactionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        actionTracking(request.body.user.id, "TRANSACTIONLIST", `Failed to fetch: ${e.message}`);
        handleErrorResponse(e, response);
    }
};

module.exports.bankDeposit = async (request, response) => {
    try {
        userLogger.info('Entering bankDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { amount, transactionReference, remark } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false, isDepositeAllowed: false }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkTransactionReference = await DepositWithdrawModel.findOne({
            where: { transactionReference: transactionReference }
        }); if (checkTransactionReference) throw CustomErrorHandler.alreadyExist("Transaction Reference already exists!")

        const newDeposit = await DepositWithdrawModel.create({
            userId: user.id,
            amount,
            transactionReference,
            transactionType: "DEPOSIT",
            paymentMethods: "BANK",
            remark,
            image: request.files["image"][0].filename
        })
        
        actionTracking(request, userData.id, "BANKDEPOSIT")
        SendMail.sendTransactionAlertEmail(
            config.ALERT_MAIL, 
            userData.name, 
            "DEPOSIT", 
            amount, 
            newDeposit.id, 
            new Date(),
        );

        userLogger.info('Exiting bankDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deposit Success, Wait for Approvel.",
            data: newDeposit
        });
    } catch (e) {
        userLogger.error('Error in bankDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankWithdraw = async (request, response) => {
    try {
        userLogger.info('Entering bankWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, bankId, amount, code, remark } = request.body;

        const currentDay = new Date().getDay();
        if (currentDay === 0 || currentDay === 6) {
            throw CustomErrorHandler.notAllowed("Withdrawal not allowed on Saturday and Sunday!");
        };

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false, isWithdrawlAllowed: false }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const assetData = await AssetModel.findOne({
            where: { userId: userData.id }
        }); if(!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");

        if(assetData.mainBalance < amount){
            throw CustomErrorHandler.wrongCredentials("Low Main Balance!");
        }
        if(!userData.isEmailVerified) throw CustomErrorHandler.notAllowed("Email address is not verified. Please verify your email before making a withdrawal.");
        if(!userData.isKycVerified) throw CustomErrorHandler.notAllowed("Pending Kyc!");
        if(!userData.securityMethods) throw CustomErrorHandler.notFound("Security Method not Found!");

        const otp = generateNumericString(6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        if(userData.securityMethods == "MOBILE" && !code){
            await SendOtpMobile.sendOtpOnMobile(`${userData.countryCode}${userData.mobile}`);

            userLogger.info('Exiting bankWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
                status: true,
                message: "Otp Send on mobile.",
                data: ""
            });
        }
        
        if(userData.securityMethods == "EMAIL" && !code){
            await OtpModel.create({
                userId: userData.id,
                email: userData.email,
                otp,
                expiresAt,
                description: "Bank Withdrawal OTP"
            });
            await SendMail.sendOtpEmail(userData.email, userData.userName, otp);

            userLogger.info('Exiting bankWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
                status: true,
                message: "Otp Send on email.",
                data: ""
            });
        }

        if (userData.securityMethods == "MOBILE" && code) {
            const data = await SendOtpMobile.verifyMobileOtp(`${userData.countryCode}${userData.mobile}`, code)
            if(!data) throw CustomErrorHandler.wrongCredentials("Failed to verify otp");
        }
        
        if (userData.securityMethods == "EMAIL" && code) {
            const otpRecord = await OtpModel.findOne({
                where: {
                    userId: userData.id,
                    otp: code.trim(),
                    isUsed: false,
                    isDeleted: false,
                    expiresAt: {
                        [Op.gt]: new Date(), // OTP not expired
                    },
                    email: userData.email
                },
                order: [['createdAt', 'DESC']] // Get the most recent OTP
            }); if (!otpRecord) throw CustomErrorHandler.notAllowed("Invalid or expired OTP!");
            // console.log(otpRecord)
            otpRecord.isUsed = true;
            await otpRecord.save();
            // throw CustomErrorHandler.notAllowed("Success!");
        }

        if(userData.securityMethods == "GOOGLE-AUTH" && !code){
            throw CustomErrorHandler.notAllowed("Please enter auth code!");
        }

        if(userData.securityMethods == "GOOGLE-AUTH" && code) {
            const authData = await MfaModel.findOne({
                where: { userId: user.id, isDeleted: false }
            }); if(!authData) throw CustomErrorHandler.notFound("Auth Data Not Found!");
    
            const verified = speakeasy.totp.verify({
                secret: authData.secretKey,
                encoding: 'base32',
                token: code,
                window: 1 // Time step window (optional, default 0)
            }); if(!verified) throw CustomErrorHandler.wrongCredentials("Wrong Auth Code!");
        }

        const bankData = await BankDetailsModel.findOne({
            where: { id: bankId, userId: userData.id, isDeleted: false }
        }); if(!bankData) throw CustomErrorHandler.notFound("Bank Details Not Found!");

        const newWithdraw = await DepositWithdrawModel.create({
            userId: user.id,
            amount,
            transactionType: "WITHDRAW",
            paymentMethods: "BANK",
            remark,
            bankId: bankData.id
        })

        assetData.mainBalance -= amount;
        await assetData.save();
        
        actionTracking(request, userData.id, "BANKWITHDRAW")
        SendMail.sendTransactionAlertEmail(
            config.ALERT_MAIL,
            userData.name, 
            "WITHDRAW",
            amount,
            newWithdraw.id, 
            new Date()
        );

        userLogger.info('Exiting bankWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Withdrawal Request submitted, Wait for Approval.",
            data: newWithdraw
        });
    } catch (e) {
        userLogger.error('Error in bankWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.depositWithdrawList = async (request, response) => {
    try {
        userLogger.info('Entering depositWithdrawList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, transactionType, status, paymentMethods, fromDate, toDate, search } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = { userId: userData.id };
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

        actionTracking(request, userData.id, "DEPOSIT/WITHDRAW List")
        userLogger.info('Exiting depositWithdrawList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        userLogger.error('Error in depositWithdrawList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaDeposit = async (request, response) => {
    try {
        userLogger.info('Entering metaDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, mt5Login, type, amount } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, isMt5DepositAllowed: false }
        }); if(!userData) throw CustomErrorHandler.notFound("Access Denied!");

        const assetData = await AssetModel.findOne({
            where: { userId: userData.id }
        }); if(!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!")

        const checkMt5Login = await Mt5AccountModel.findOne({
            where: { Login: mt5Login, accountType: "REAL", userId: userData.id }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        if(assetData.mainBalance < amount ){
            throw CustomErrorHandler.wrongCredentials("Low main balance!")
        }

        const newDeposit = await TradeRequestControllers.depositWithdraw(mt5Login, type, amount, "DEPOSIT");
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Deposit Failed!`);

        assetData.mainBalance -= amount;
        assetData.totalMetaDeposit += Number(amount);
        await assetData.save();

        let newTransactionType;
        if(type == 2){
            newTransactionType = "INTERNAL-DEPOSIT";
        }else if (type == 3){
            newTransactionType = "CREDIT-DEPOSIT";
        }else if (type == 6){
            newTransactionType = "BONUS-DEPOSIT";
        }

        const newTransaction = await TransactionModel.create({
            userId: userData.id,
            mt5Login,
            amount,
            transactionType: newTransactionType,
        }); 

        actionTracking(request, userData.id, "META-DEPOSIT")

        userLogger.info('Exiting metaDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${amount} USD Deposited in ${mt5Login} Mt5.`,
            data: newTransaction,
        });
    } catch (e) {
        userLogger.error('Error in metaDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaWithdraw = async (request, response) => {
    try {
        userLogger.info('Entering metaWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, mt5Login, amount, type } = request.body;
        console.log()
        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, isMt5WithdrawlAllowed: false }
        }); if(!userData) throw CustomErrorHandler.notFound("Access Denied!");

        const checkMt5Login = await Mt5AccountModel.findOne({
            where: { userId: userData.id, accountType: "REAL", Login: mt5Login }
        }); if(!checkMt5Login) throw CustomErrorHandler.notFound("MT5 Account Not Found!");
        
        const assetData = await AssetModel.findOne({
            where: { userId: userData.id }
        }); if(!assetData) throw CustomErrorHandler.notFound("Asset Details not found!");

        // remove credit if found
        const metaBalance = await MetaControllers.checkUserBalance(mt5Login, 0);
        const result = metaBalance.answer.credit;
        // if(result.user > 0) {
        //     const newWithdraw = await TradeRequestControllers.depositWithdraw(mt5Login, 3, -result.user, "Bonus Removed");
        //     // if(!newWithdraw) throw CustomErrorHandler.serverError(`Meta Withdraw Failed!`);
        //     if(newWithdraw){
        //         await TransactionModel.create({
        //             userId: userData.id,
        //             mt5Login,
        //             amount: result.user,
        //             transactionType: "CREDIT-WITHDRAW",
        //             remark: "Bonus Removed.",
        //         });
        //     }
        // }

        const newWithdraw = await TradeRequestControllers.depositWithdraw(mt5Login, type, -amount, "WITHDRAW");
        if(!newWithdraw) throw CustomErrorHandler.serverError(`Meta Withdraw Failed!`);

        assetData.mainBalance += Number(amount);
        assetData.totalMetaWithdrawal += Number(amount);
        await assetData.save();

        let newTransactionType;
        if(type == 2){
            newTransactionType = "INTERNAL-WITHDRAW";
        }else if (type == 3){
            newTransactionType = "CREDIT-WITHDRAW";
        }else if (type == 6){
            newTransactionType = "BONUS-WITHDRAW";
        }

        const newTransaction = await TransactionModel.create({
            userId: userData.id,
            mt5Login,
            amount,
            transactionType: newTransactionType,
        });

        actionTracking(request, userData.id, "META-WITHDRAW")
        userLogger.info('Exiting metaWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${amount} USD Withdraw ${mt5Login} Mt5.`,
            data: newTransaction,
        });
    } catch (e) {
        userLogger.error('Error in metaWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.withdrawUsdt = async (request, response) => {
    try {
        userLogger.info('Entering withdrawUsdt', { method: request.method || "", route: request.originalUrl || "" });
        const currentDay = new Date().getDay();
        if (currentDay === 0 || currentDay === 6) {
            throw CustomErrorHandler.notAllowed("Withdrawal not allowed on Saturday and Sunday!")
        };
        
        const { user, network, walletAddress, amount, code } = request.body;
        
        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, isWithdrawlAllowed: false }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const assetData = await AssetModel.findOne({
            where: { userId: userData.id, isDeleted: false }
        }); if(!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");
        if (assetData.mainBalance < amount) throw CustomErrorHandler.lowBalance("Low Main Balance!");

        if(!userData.isEmailVerified) throw CustomErrorHandler.notAllowed("Email address is not verified. Please verify your email before making a withdrawal.");
        if(!userData.isKycVerified) throw CustomErrorHandler.notAllowed("Pending Kyc!");
        if(!userData.securityMethods) throw CustomErrorHandler.notFound("Security Method not Found!");

        const otp = generateNumericString(6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        if(userData.securityMethods == "MOBILE" && !code){
            await SendOtpMobile.sendOtpOnMobile(`${userData.countryCode}${userData.mobile}`);

            userLogger.info('Exiting withdrawUsdt: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
                status: true,
                message: "Otp Send on mobile.",
                data: ""
            });
        }
        
        if(userData.securityMethods == "EMAIL" && !code){
            await OtpModel.create({
                userId: userData.id,
                email: userData.email,
                otp,
                expiresAt,
                description: "USDT Withdrawal OTP"
            });
            await SendMail.sendOtpEmail(userData.email, userData.userName, otp);

            userLogger.info('Exiting withdrawUsdt: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
                status: true,
                message: "Otp Send on email.",
                data: ""
            });
        }

        if (userData.securityMethods == "MOBILE" && code) {
            const data = await SendOtpMobile.verifyMobileOtp(`${userData.countryCode}${userData.mobile}`, code)
            if(!data) throw CustomErrorHandler.wrongCredentials("Failed to verify otp");
        }
        
        if (userData.securityMethods == "EMAIL" && code) {
            const otpRecord = await OtpModel.findOne({
                where: {
                    userId: userData.id,
                    otp: code.trim(),
                    isUsed: false,
                    isDeleted: false,
                    expiresAt: {
                        [Op.gt]: new Date(), // OTP not expired
                    },
                    email: userData.email
                },
                order: [['createdAt', 'DESC']] // Get the most recent OTP
            }); if (!otpRecord) throw CustomErrorHandler.notAllowed("Invalid or expired OTP!");
            otpRecord.isUsed = true;
            await otpRecord.save();
        }

        if(userData.securityMethods == "GOOGLE-AUTH" && !code){
            throw CustomErrorHandler.notAllowed("Please enter auth code!");
        }

        if(userData.securityMethods == "GOOGLE-AUTH" && code) {
            const authData = await MfaModel.findOne({
                where: { userId: user.id, isDeleted: false }
            }); if(!authData) throw CustomErrorHandler.notFound("Auth Data Not Found!");
    
            const verified = speakeasy.totp.verify({
                secret: authData.secretKey,
                encoding: 'base32',
                token: code,
                window: 1 // Time step window (optional, default 0)
            }); if(!verified) throw CustomErrorHandler.wrongCredentials("Wrong Auth Code!");
        }
        const newWithdraw = await DepositWithdrawModel.create({
            userId: user.id,
            amount,
            transactionType: "WITHDRAW",
            paymentMethods: "CRYPTO",
            network, 
            walletAddress,
            remark: "Wait for Admin approval",
        })

        assetData.mainBalance -= amount;
        await assetData.save();

        actionTracking(request, userData.id, "USDT-WITHDRAW")
        SendMail.sendTransactionAlertEmail(
            config.ALERT_MAIL,
            userData.name,
            "USDT-WITHDRAW",
            amount,
            newWithdraw.id,
            new Date(),
        );
        SendMail.sendPendingTransactionAlertEmail(
            userData.email,
            userData.userName,
            "USDT-WITHDRAW",
            amount,
            newWithdraw.id,
            new Date(),
        ).catch(() => {});

        userLogger.info('Exiting withdrawUsdt: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: `${amount} USDT Withdraw Requested.`,
            data: newWithdraw,
        });
    } catch (e) {
        userLogger.error('Error in withdrawUsdt', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Withdraw:", e.message);
        handleErrorResponse(e, response);
    }
};

// Update personal info
module.exports.updateUserProfile = async (request, response) => {
    try {
        userLogger.info('Entering updateUserProfile', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, countryCode, mobile, dob, gender, address  } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        })
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        const updateData = {};
        if (name) updateData.name = name;
        if (mobile){
            const checkMobile = await UserModel.findOne({
                where: { mobile, id: { [Op.ne]: user.id } }
            });
            if(checkMobile) throw CustomErrorHandler.alreadyExist("Mobile Already Used!");
    
            if(!countryCode) throw CustomErrorHandler.wrongCredentials("Invalid Country Code!")
            updateData.mobile = mobile;
            updateData.countryCode = countryCode;
            updateData.isMobileVerified = true;
        } 
        if (dob) updateData.dob = dob;
        if (gender) updateData.gender = gender;
        if (address) updateData.address = address;

        if (Object.keys(updateData).length === 0) throw CustomErrorHandler.wrongCredentials("Nothing to update!");

        await UserModel.update(updateData, {
            where: { id: user.id }
        });

        // Fetch updated user data
        const updatedUser = await UserModel.findOne({ where: { id: user.id } });

        actionTracking(request, userData.id, "UPDATE-PROFILE");
        userLogger.info('Exiting updateUserProfile: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Update successfully.",
            data: updatedUser,
        });
    } catch (e) {
        userLogger.error('Error in updateUserProfile', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Updating user details", e);
        handleErrorResponse(e, response);
    }
};

module.exports.createTransactionPassword = async (request, response) => {
    try {
        userLogger.info('Entering createTransactionPassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, securityQuestion, answer, password, cnfPassword } = request.body;

        const userData = await UserModel.findByPk(user.id)
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (userData.isTrxPassCreated){
            throw CustomErrorHandler.alreadyExist("Already Created Transaction Password!");
        }; 

        const passwordSalt = await bcrypt.genSalt(Number(config.SALT_ROUND));
        const passwordHash = await bcrypt.hash(password, passwordSalt);

        userData.trxPassword = passwordHash;
        userData.isTrxPassCreated = true;
        await userData.save();

        await PasswordModel.create({
            userId: user.id,
            securityQuestion,
            answer,
            password: passwordHash,
        })

        userLogger.info('Exiting createTransactionPassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Password Created.",
            data: userData,
        });
    } catch (e) {
        userLogger.error('Error in createTransactionPassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Create Transaction password", e);
        handleErrorResponse(e, response);
    }
};

// use for future requirement
module.exports.changeTransactionPassword = async (request, response) => {
    try {
        userLogger.info('Entering changeTransactionPassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, currPassword, newPassword } = request.body;

        const userData = await UserModel.findByPk(user.id)
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (!userData.isTrxPassCreated){
            throw CustomErrorHandler.alreadyExist("Please Create Transaction Password!");
        }; 

        const checkPassword = await bcrypt.compare(
            currPassword,
            userData.trxPassword
        );
        if (!checkPassword) throw CustomErrorHandler.wrongCredentials("Wrong Current Password!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(newPassword, passwordSalt);

        userData.trxPassword = passwordHash;
        await userData.save();

        userLogger.info('Exiting changeTransactionPassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Password Changed.",
            data: null,
        });
    } catch (e) {
        userLogger.error('Error in changeTransactionPassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Changing Transaction password", e);
        handleErrorResponse(e, response);
    }
};

module.exports.addBankDetails = async (request, response) => {
    try {
        userLogger.info('Entering addBankDetails', { method: request.method || "", route: request.originalUrl || "" });
        const { user, holderName, bankName, accountNo, ifscCode, branchName, accountType, panNumber } = request.body;

        const userData = await UserModel.findByPk(user.id)
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (userData.isBankAccAdded){
            throw CustomErrorHandler.alreadyExist("Already Added Bank account!");
        }; 

        const checkBank = await BankModel.findOne({
            where: { accountNo: accountNo }
        });
        if (checkBank) throw CustomErrorHandler.alreadyExist("Account No Already Exist!");

        const checkPan = await BankModel.findOne({
            where: { panNumber: panNumber }
        });
        if (checkPan) throw CustomErrorHandler.alreadyExist("Pan Number Already Exist!");

        await BankModel.create({
            userId: user.id,
            holderName, 
            bankName, 
            accountNo, 
            ifscCode, 
            branchName, 
            accountType, 
            panNumber
        });

        userData.isBankAccAdded = true;
        await userData.save();

        userLogger.info('Exiting addBankDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details Added.",
            data: userData,
        });
    } catch (e) {
        userLogger.error('Error in addBankDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while adding bank account", e);
        handleErrorResponse(e, response);
    }
};

module.exports.getBankDetails = async (request, response) => {
    try {
        userLogger.info('Entering getBankDetails', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        // Validate user existence
        const userData = await UserModel.findByPk(user.id);
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Access Denied!");
        }

        const fetchBank = await BankModel.findOne({
            where: { userId: user.id }
        });
        if(!fetchBank) throw CustomErrorHandler.notFound("Bank account not found!")

        userLogger.info('Exiting getBankDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details.",
            data: fetchBank
        });
    } catch (e) {
        userLogger.error('Error in getBankDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// User referral array list
module.exports.referralList = async (request, response) => {
    try {
        userLogger.info('Entering referralList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] },
        }); if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userList = [];
        await buildReferralTree(userData.id, 1, userList);

        actionTracking(request, userData.id, "REFERRAL-LIST")
        userLogger.info('Exiting referralList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Referral Level List.",
            data: {userList, totalTeam: userList.length}
            
        });
    } catch (e) {
        userLogger.error('Error in referralList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

const buildReferralTree = async (userId, level = 1, userList = []) => {
    const user = await UserModel.findByPk(userId);

    if (!user) {
      return userList;
    }
    
    if (level > 1) {
      userList.push({
        name: user.name,
        id: user.id,
        userName: user.userName,
        isSubIb: user.isSubIb,
        date: user.createdAt,
        // level: level - 1 // Adjust the level to exclude level 1 users
        level: user.level // Adjust the level to exclude level 1 users
      });
    }
    
    const referrals = await UserModel.findAll({ 
        where: { fromUser: userId }
    });
    
    for (const referral of referrals) {
      await buildReferralTree(referral.id, level + 1, userList);
    }
    
    return userList;
};
module.exports.buildReferralTree = buildReferralTree;

module.exports.getUserReferralTree = async (request, response) => {
    try {
        userLogger.info('Entering getUserReferralTree', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const mainUserData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] }
        }); if(!mainUserData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        const userReferralData = await UserModel.findAll({
            where: { id: user.fromUser, isDeleted: false }
        }); if(!userReferralData) throw CustomErrorHandler.notFound("Referral Not found!");

        let referralData = {},
            totalTeam = 0;
        for (const element of userReferralData) {
            try {
                const getUserREferralData = await getReferralData(element.id);
                totalTeam += getUserREferralData.totalTeam + 1;
                referralData[
                    `${element.name}-${element.userName}-Total Team : ${getUserREferralData.totalTeam}`
                ] = getUserREferralData.data;
            } catch (error) {
        userLogger.error('Error in getUserReferralTree', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
                console.log(
                    "%c 🌽 error: ",
                    "font-size:20px;background-color: #B03734;color:#fff;",
                    error,
                );
            }
        }
        let sendData = {};
        sendData[
             `${mainUserData.name}-${mainUserData.userName}- Total Team : ${totalTeam}`
        ] = referralData;

        actionTracking(request, mainUserData.id, "REFERRAL-TREE-VIEW")

        userLogger.info('Exiting getUserReferralTree: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User referral Tree",
            data: sendData,
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

const getReferralData = async (userId) => {
    return new Promise(async (resolve) => {
        const userReferralData = await UserModel.findAll({
            where: { fromUser: userId, isDeleted: false }
        });

        if (userReferralData.length > 0) {
            let referralData = {},
                totalTeam = 0;
            for (const element of userReferralData) {
                const getUserREferralData = await getReferralData(element.id);

                totalTeam += getUserREferralData.totalTeam + 1;
                referralData[
                    `${element.name}-${element.userName}-Total Team : ${getUserREferralData.totalTeam}`
                ] = getUserREferralData.data;
            }
            resolve({ data: referralData, totalTeam: totalTeam });
        } else resolve({ data: null, totalTeam: 0 });
    });
};

// request for IB
module.exports.requestIb = async (request, response) => {
    try {
        userLogger.info('Entering requestIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, country, tradingExperienceLevel, expectedClintsPerMonths, networkSize, monthlyIncomeGoal,
            instagram, facebook, linkedin, tweeterX, youtube, tiktok, whyWantToBecomeIb, howYouAcquireClients, whatsYourDreamLuxuryReward, remark } = request.body;
0
        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkRequestIb = await IbModel.findOne({
            where: { userId: user.id }
        }); if(checkRequestIb) throw CustomErrorHandler.alreadyExist(`Already Requested and Ib Status:- ${checkRequestIb.status}`);

        const checkMobile = await IbModel.findOne({
            where: { mobile: mobile || userData.mobile }
        }); if(checkMobile) throw CustomErrorHandler.alreadyExist("Mobile already Exists!");

        const newIbRequest = await IbModel.create({
            userId: userData.id,
            name: userData.name? userData.name: name,
            email: userData.email ? userData.email : email,
            mobile: userData.mobile ? userData.mobile : mobile,
            country: userData.country ? userData.country : country,
            tradingExperienceLevel, 
            expectedClintsPerMonths,
            networkSize, 
            monthlyIncomeGoal,
            instagram, 
            facebook, 
            linkedin, 
            tweeterX, 
            youtube, 
            tiktok, 
            whyWantToBecomeIb, 
            howYouAcquireClients, 
            whatsYourDreamLuxuryReward, 
            remark
        })

        actionTracking(request, userData.id, "REQUESTED-FOR-IB")
        userLogger.info('Exiting requestIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Requested for IB.",
            data: newIbRequest,
        });
    } catch (e) {
        userLogger.error('Error in requestIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getRequestIb = async (request, response) => {
    try {
        userLogger.info('Entering getRequestIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkRequestIb = await IbModel.findOne({
            where: { userId: user.id }
        }); if(!checkRequestIb) throw CustomErrorHandler.alreadyExist("Not Found!");

        actionTracking(request, userData.id, "CHECKED-IB-STATUS")
        userLogger.info('Exiting getRequestIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib Request.",
            data: checkRequestIb,
        });
    } catch (e) {
        userLogger.error('Error in getRequestIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getUpdatedDetails = async (request, response) => {
    try {
        userLogger.info('Entering getUpdatedDetails', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const assetData = await AssetModel.findOne({
            where: { userId: user.id }
        });

        const mt5AccountList = await Mt5AccountModel.findAll({
            where: { userId: user.id }
        });

        const host = `${request.protocol}://${request.get("host")}`;
        userData.profileImage = userData.profileImage ? `${host}/public/profileImage/${userData.profileImage}` : null;
     
        actionTracking(request, userData.id, "CHECKED-UPDATED-DETAILS")

        userLogger.info('Exiting getUpdatedDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Updated Data.",
            data: { userData, assetData, mt5AccountList },
        });
    } catch (e) {
        userLogger.error('Error in getUpdatedDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.yopipsTrail = async (request, response) => {
    try {
        userLogger.info('Entering yopipsTrail', { method: request.method || "", route: request.originalUrl || "" });
        const { email, token } = request.query;

        if(token != config.YOPIPS_TOKEN){
            throw CustomErrorHandler.unAuthorized("Invalid Token");
        };

        if(!email) throw CustomErrorHandler.notFound("Enter Valid email!")

        const userData = await UserModel.findOne({
            where: { email }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Not Found!");

        const assetData = await AssetModel.findOne({
            where: { userId: userData.id }
        });

        if(assetData.totalDeposit < 200){
            throw CustomErrorHandler.notAllowed("Low Deposit, Trail Not Allowed!");
        }

        userLogger.info('Exiting yopipsTrail: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trail Allowed.",
            data: "",
        });
    } catch (e) {
        userLogger.error('Error in yopipsTrail', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateProfile = async (request, response) => {
    try {
        userLogger.info('Entering updateProfile', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");
        
        userData.profileImage = request.files["image"][0].filename;
        await userData.save();
        
        const host = `${request.protocol}://${request.get("host")}`;
        userData.profileImage = userData.profileImage ? `${host}/public/profileImage/${userData.profileImage}` : null;
        
        userLogger.info('Exiting updateProfile: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Profile Image Updated.",
            data: userData
        });
    } catch (e) {
        userLogger.error('Error in updateProfile', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateSecuriyMethod = async (request, response) => {
    try {
        userLogger.info('Entering updateSecuriyMethod', { method: request.method || "", route: request.originalUrl || "" });
        const { user, securityMentod } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        userData.securityMethods = securityMentod;
        await userData.save();

        userLogger.info('Exiting updateSecuriyMethod: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Security Method Updated.",
            data: userData
        });
    } catch (e) {
        userLogger.error('Error in updateSecuriyMethod', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ibComissionList = async (request, response) => {
    try {
        userLogger.info('Entering ibComissionList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, fromDate, toDate, search } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = { userId: userData.id };

        if (fromDate && toDate) {
            where.createdAt = {
                [Op.between]: [
                    new Date(fromDate + " 00:00:00"),
                    new Date(toDate + " 23:59:59"),
                ],
            };
        } else if (fromDate) {
            where.createdAt = { [Op.gte]: new Date(fromDate + " 00:00:00") };
        } else if (toDate) {
            where.createdAt = { [Op.lte]: new Date(toDate + " 23:59:59") };
        };

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

        const { count, rows: comissionTrxList } = await IbcomissionTrxModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: Mt5OrderModel,
                    as: "orderDetails",
                },
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                },
                {
                    model: UserModel,
                    as: "ibDetails",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                },
                {
                    model: UserModel,
                    as: "fromUserDetails",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                    where: { ...searchCondition }
                },
            ],
            limit,
            offset,
        });

        actionTracking(request, userData.id, "IB-COMISSION-LIST");

        userLogger.info('Exiting ibComissionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib Comission trxlist.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                comissionTrxList,
            },
        });
    } catch (e) {
        userLogger.error('Error in ibComissionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.acceptPromotion = async (request, response) => {
    try {
        userLogger.info('Entering acceptPromotion', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false, isIb: true },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const chekPromotional = await PromotionalModel.findOne({
            where: { userId: userData.id }
        }); if(chekPromotional) throw CustomErrorHandler.alreadyExist("Already accepted!");

        const newData = await PromotionalModel.create({
            userId: userData.id,
            isPromotionalAllowed: true
        });

        userData.isPromotionalAllowed = true;
        await userData.save()

        actionTracking(request, userData.id, "PROMOTIONAL-ACCEPTED");

        userLogger.info('Exiting acceptPromotion: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Promotionl offer accepted.",
            data: newData,
        });
    } catch (e) {
        userLogger.error('Error in acceptPromotion', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
