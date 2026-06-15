const bcrypt = require("bcrypt");
const qrcode = require('qrcode');
const socket = require("../../config/socketIO");
const speakeasy = require('speakeasy');
const { Op } = require("sequelize");
const SendMail = require("../../utils/mail");
const SendOtpMobile = require("../../utils/twilio");
const config = require("../../config/config");
const OtpModel = require("../../models/otp.model");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const PasswordModel = require("../../models/password.model");
const MfaSceretModel = require("../../models/mfaSecret.model");
const MarketingModel = require("../../models/marketingUser.model");
const LoginTrackingModel = require("../../models/loginTracking.model");
const { createUserName, errorTracking, generateNumericString, actionTracking } = require("../../helpers");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");
const {
    TOKEN_SUBJECT,
    replaceUserSession,
    signAuthToken,
    toPlainUserData,
} = require("../../utils/authSession");

module.exports.referralInfo = async (request, response) => {
    try {
        const { referralCode } = request.query;
        
        userLogger.info('Entering referralInfo', {
            method: request.method,
            route: request.originalUrl,
            referralCode
        });

        const referralData = await UserModel.findOne({
            where: { userName: referralCode.trim(), isDeleted: false }
        });
        if (!referralData) throw CustomErrorHandler.wrongCredentials("Wrong referral Code!");

        userLogger.info('Exiting referralInfo: Success', { method: request.method, route: request.originalUrl });
        return response.json({
            status: true,
            message: "Referral Details",
            data: { name: referralData.name }
        });
    } catch (e) {
        userLogger.error('Error in referralInfo', { method: request.method, route: request.originalUrl, stack: e.stack || e });
        handleErrorResponse(e, response);
    }
};

module.exports.signUp = async (request, response) => {
    try {
        userLogger.info('Entering signUp', { method: request.method || "", route: request.originalUrl || "" });
        const { country, email, password, referralCode, isMarketing = "false" } = request.body;

        const checkEmail = await UserModel.findOne({ 
            where: { email: email.toLowerCase().trim() } 
        });
        if(checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");

        //GENERATING PASSWORD
        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(password, passwordSalt);

        const newUserName = await createUserName();

        let checkReferral = false;
        let marketing = false;
        if (referralCode && isMarketing == "false") {
            checkReferral = await UserModel.findOne({
                where: {
                    userName: referralCode.trim(),
                    isDeleted: false,
                }
            }); if (!checkReferral) throw CustomErrorHandler.alreadyExist("Please Enter a Valid Referral Code!");
            if(!checkReferral.isIb && !checkReferral.isSubIb) throw CustomErrorHandler.notAllowed("Referral Not allowed!");
        } else if(isMarketing == "true") {
            marketing = await MarketingModel.findOne({
                where: {
                    userName: referralCode.trim(),
                    isDeleted: false,
                }
            }); if (!marketing) throw CustomErrorHandler.alreadyExist("Please Enter a Valid Referral Code!");
        };

        //CREATING USER IN Database
        const newUsers = await UserModel.create({
            country: country.trim(),
            userName: newUserName.trim(),
            email: email.toLowerCase().trim(),
            password: passwordHash,
            fromUser: checkReferral && checkReferral.id ? checkReferral.id : null,
            level: checkReferral && checkReferral.id ? (Number(checkReferral.level) + 1) : 0,
            assingToManager: marketing && marketing.id ? marketing.id : null
        });

        await PasswordModel.create({
            userId: newUsers.id,
            mt5Login: null,
            passwordList: [
                {
                    passwordType: "LOGIN",
                    password,
                }
            ],
        });

        await AssetModel.create({
            userId: newUsers.id
        });

        const token = signAuthToken(newUsers, TOKEN_SUBJECT.USER);
        await replaceUserSession(newUsers.id, token);
        const sendData = { userData: toPlainUserData(newUsers), token };

        await actionTracking(newUsers.id, "SINGUP");

        SendMail.sendWelcomeEmail(newUsers.email, newUserName, newUserName, password).catch(() => {});

        userLogger.info('Exiting signUp: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Register successfully.",
            data: sendData,
        });
    } catch (e) {
        userLogger.error('Error in signUp', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.login = async (request, response) => {
    try {
        const { userName, password } = request.body;

        userLogger.info('Entering login', {
            method: request.method,
            route: request.originalUrl,
            userName
        });

        const userIP = request.ip || request.headers["x-forwarded-for"] || request.socket.remoteAddress;
        const userAgent = request.get("User-Agent") || "Unknown Device";

        const userData = await UserModel.scope("withPassword").findOne({
            where: {
                [Op.or]: [
                    { userName: userName.trim() },
                    { email: userName.toLowerCase().trim() }
                ],
                isDeleted: false,
                role: "USER"
            }
        });
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Not Found!");
        };

        // if (!userData.isEmailVerified) {
        //     throw CustomErrorHandler.unAuthorized("Email Not verified!");
        // };

        // if (!userData.isMobileVerified) {
        //     throw CustomErrorHandler.unAuthorized("Mobile not verified!");
        // };

        const checkPassword = await bcrypt.compare(password, userData.password);
        if (!checkPassword) {
            throw CustomErrorHandler.wrongCredentials("Wrong Password!");
        };

        // userData.lastLogin = Math.floor(Date.now() / 1000);
        // await userData.save();

        const safeUserData = toPlainUserData(userData);
        
        const host = `${request.protocol}://${request.get("host")}`;
        safeUserData.profileImage = safeUserData.profileImage ? `${host}/public/profileImage/${safeUserData.profileImage}` : null;

        const token = signAuthToken(userData, TOKEN_SUBJECT.USER);
        await LoginTrackingModel.create({
            userId: userData.id,
            ipAddress: userIP,
            device: userAgent,
            timestamp: new Date(),
            isDeleted: false
        });

        socket.socketEmitAll("logOut", { userId: userData.id })
        await replaceUserSession(userData.id, token);

        actionTracking(request, userData.id, "LOGIN");

        userLogger.info('Exiting login: Success', { method: request.method, route: request.originalUrl, userId: userData.id });

        return response.json({
            status: true,
            message: "Login success.",
            data: { userData: safeUserData, token }
        });
    } catch (e) {
        userLogger.error('Error in login', { method: request.method, route: request.originalUrl, stack: e.stack || e });
        // errorTracking(request, e)
        handleErrorResponse(e, response);
    }
};

module.exports.loginHistory = async (request, response) => {
    try {
        userLogger.info('Entering loginHistory', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10 } = request.query;
        const { user } = request.body;

        // Validate user existence

        const userData = await UserModel.findByPk(user.id);
        if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        // Pagination options
        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        // Fetch login history
        const { count, rows: loginHistory } = await LoginTrackingModel.findAndCountAll({
            where: { userId: user.id },
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        // actionTracking
        userLogger.info('Exiting loginHistory: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        userLogger.error('Error in loginHistory', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        // errorTracking(request, e.message, "LOGIN-HISTORY-API")
        handleErrorResponse(e, response);
    }
};

module.exports.logOut = async (request, response) => {
    try {
        userLogger.info('Entering logOut', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "USER" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Not Found!");

        socket.socketEmitAll("logOut", { userId: userData.id })

        await replaceUserSession(userData.id);

        // actionTracking(request, userData.id, "LOG-OUT");

        userLogger.info('Exiting logOut: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "LogOut success.",
            data: ""
        });
    } catch (e) {
        userLogger.error('Error in logOut', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        // errorTracking(request, e)
        handleErrorResponse(e, response);
    }
};

// Send Otp for Verify Email or Mobile
module.exports.sendOtp = async (request, response) => {
    try {
        userLogger.info('Entering sendOtp', { method: request.method || "", route: request.originalUrl || "" });
        const { mobile, email } = request.body;

        // Find user by email or mobile (case-insensitive)
        const userData = await UserModel.findOne({
            where: {
                isDeleted: false,
                [Op.or]: [
                    email ? { email: email.toLowerCase().trim() } : null,
                    mobile ? { mobile: mobile.trim() } : null
                ].filter(Boolean) // Remove null values
            }
        });

        if (!userData) {
            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        };

        const otp = generateNumericString(6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Save OTP in the database
        await OtpModel.create({
            userId: userData.id,
            email: email || null,
            mobile: mobile || null,
            otp,
            expiresAt,
            description: "Email verification OTP"
        });

        if (mobile) {
            await SendOtpMobile.sendOtpOnMobile(`${userData.countryCode}${userData.mobile}`);
        } else {
            await SendMail.sendOtpEmail(userData.email, userData.userName, otp);
        }

        userLogger.info('Exiting sendOtp: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: mobile ? "OTP sent to Mobile." : "OTP sent to Email.",
            data: ""
        });
    } catch (e) {
        userLogger.error('Error in sendOtp', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Verify Email or Password
module.exports.verifyOtp = async (request, response) => {
    try {
        userLogger.info('Entering verifyOtp', { method: request.method || "", route: request.originalUrl || "" });
        const { mobile, email, otp } = request.body;

        const userData = await UserModel.findOne({
            where: {
                isDeleted: false,
                [Op.or]: [
                    email ? { email: email.toLowerCase().trim() } : null,
                    mobile ? { mobile: mobile.trim() } : null
                ].filter(Boolean) // Remove null values
            }
        });

        if (!userData) {
            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        };

        // Update user verification status
        if (mobile) {
            const data = await SendOtpMobile.verifyMobileOtp(`${userData.countryCode}${userData.mobile}`, otp)
            if(!data) throw CustomErrorHandler.wrongCredentials("Failed to verify otp");
            userData.isMobileVerified = true;
        } else {
            const otpRecord = await OtpModel.findOne({
                where: {
                    userId: userData.id,
                    otp: otp.trim(),
                    isUsed: false,
                    isDeleted: false,
                    expiresAt: {
                        [Op.gt]: new Date(), // OTP not expired
                    },
                    ...(email ? { email: email.toLowerCase().trim() } : {}),
                    ...(mobile ? { mobile: mobile.trim() } : {}),
                },
                order: [['createdAt', 'DESC']] // Get the most recent OTP
            }); if (!otpRecord) throw CustomErrorHandler.notAllowed("Invalid or expired OTP!");
            
            otpRecord.isUsed = true;
            await otpRecord.save();

            userData.isEmailVerified = true;
        }
        await userData.save();

        userLogger.info('Exiting verifyOtp: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: mobile ? "Mobile Verified." : "Email Verified.",
            data: "",
        });
    } catch (e) {
        userLogger.error('Error in verifyOtp', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.changePassword = async (request, response) => {
    try {
        userLogger.info('Entering changePassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, oldPassword, newPassword, cnfPassword } = request.body;

        const userData = await UserModel.scope("withPassword").findByPk(user.id);
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        if(newPassword !== cnfPassword){
            throw CustomErrorHandler.unAuthorized("Not Match Confirm Password!");
        }

        const checkPassword = await bcrypt.compare(oldPassword, userData.password);
        if(!checkPassword) throw CustomErrorHandler.wrongCredentials("Not Match Current Password!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(newPassword, passwordSalt);
        
        userData.password = passwordHash;
        await userData.save()

        let passwordData = await PasswordModel.findOne({ where: { userId: userData.id } });

        let passwordList = [...passwordData.passwordList];
        passwordList[0] = { passwordType: "LOGIN", password: newPassword };
        passwordData.passwordList = passwordList;
        await passwordData.save();

        userLogger.info('Exiting changePassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "New Password Changed.",
            data: "",
        });
    } catch (e) {
        userLogger.error('Error in changePassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.forgetPasswordSendOtp = async (request, response) => {
    try {
        userLogger.info('Entering forgetPasswordSendOtp', { method: request.method || "", route: request.originalUrl || "" });
        const { mobile, email } = request.body;

        // Find user by email or mobile (case-insensitive)
        const userData = await UserModel.findOne({
            where: {
                isDeleted: false,
                [Op.or]: [
                    email ? { email: email.toLowerCase().trim() } : null,
                    mobile ? { mobile: mobile.trim() } : null
                ].filter(Boolean) // Remove null values
            }
        });

        if (!userData) {
            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        };
        
        const otp = generateNumericString(6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await OtpModel.create({
            userId: userData.id,
            email: email || null,
            mobile: mobile || null,
            otp,
            expiresAt,
            description: "Email verification OTP"
        });

        if (mobile) {
            await SendOtpMobile.sendOtpOnMobile(`${userData.countryCode}${userData.mobile}`);
        } else {
            await SendMail.sendOtpEmail(userData.email, userData.userName, otp);
        }

        userLogger.info('Exiting forgetPasswordSendOtp: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: mobile ? "OTP sent to Mobile." : "OTP sent to Email.",
            data: ""
        });
    } catch (e) {
        userLogger.error('Error in forgetPasswordSendOtp', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.forgetPasswordVerifyOtp = async (request, response) => {
    try {
        userLogger.info('Entering forgetPasswordVerifyOtp', { method: request.method || "", route: request.originalUrl || "" });
        const { mobile, email, otp } = request.body;

        const userData = await UserModel.findOne({
            where: {
                isDeleted: false,
                [Op.or]: [
                    email ? { email: email.toLowerCase().trim() } : null,
                    mobile ? { mobile: mobile.trim() } : null
                ].filter(Boolean) // Remove null values
            }
        });

        if (!userData) {
            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        };

        // Update user verification status
        if (mobile) {
            const data = await SendOtpMobile.verifyMobileOtp(`${userData.countryCode}${userData.mobile}`, otp)
            if(!data) throw CustomErrorHandler.wrongCredentials("Failed to verify otp");
            userData.isMobileVerified = true;
        } else {
            const otpRecord = await OtpModel.findOne({
                where: {
                    userId: userData.id,
                    otp: otp.trim(),
                    isUsed: false,
                    isDeleted: false,
                    expiresAt: {
                        [Op.gt]: new Date(), // OTP not expired
                    },
                    ...(email ? { email: email.toLowerCase().trim() } : {}),
                    ...(mobile ? { mobile: mobile.trim() } : {}),
                },
                order: [['createdAt', 'DESC']] // Get the most recent OTP
            }); if (!otpRecord) throw CustomErrorHandler.notAllowed("Invalid or expired OTP!");
            
            otpRecord.isUsed = true;
            await otpRecord.save();

            userData.isEmailVerified = true;
        }
        await userData.save();

        const token = signAuthToken(userData, TOKEN_SUBJECT.USER);
        socket.socketEmitAll("logOut", { userId: userData.id })
        await replaceUserSession(userData.id, token);
        actionTracking(request, userData.id, "Forgot Pass verify otp");

        userLogger.info('Exiting forgetPasswordVerifyOtp: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Otp Verified, Now Reset the Password.",
            data: token,
        });  
    } catch (e) {
        userLogger.error('Error in forgetPasswordVerifyOtp', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    };
};

module.exports.resetPassword = async (request, response) => {
    try {
        userLogger.info('Entering resetPassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, newPassword, cnfPassword } = request.body;

        const userData = await UserModel.findByPk(user.id);
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if(newPassword !== cnfPassword){
            throw CustomErrorHandler.unAuthorized("Not Match Confirm Password!");
        };

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(newPassword, passwordSalt);
        userData.password = passwordHash;
        await userData.save();

        let passwordData = await PasswordModel.findOne({ where: { userId: userData.id } });

        let passwordList = [...passwordData.passwordList];
        passwordList[0] = { passwordType: "LOGIN", password: newPassword };
        passwordData.passwordList = passwordList;
        await passwordData.save();

        userLogger.info('Exiting resetPassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Success Reset Password.",
            data: "",
        });
    } catch (e) {
        userLogger.error('Error in resetPassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Send Otp for Verify Email or Mobile
module.exports.setup2fa = async (request, response) => {
    try {
        userLogger.info('Entering setup2fa', { method: request.method || "", route: request.originalUrl || "" });
        const { user, otp } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        });
        if (!userData) throw CustomErrorHandler.notFound("Access Denied!");

        if ((userData.isMfaAdded && !otp) || userData.isMfaAdded) {
            throw CustomErrorHandler.wrongCredentials("2FA already enabled!");
        }

        let mfa = await MfaSceretModel.findOne({
            where: { userId: userData.id, isDeleted: false }
        });

        // If OTP is not sent, we assume setup mode
        if (!otp) {
            let secret;

            if (!mfa) {
                // First-time: create new secret
                secret = speakeasy.generateSecret({
                    name: `${config.COMPANY_NAME} (${userData.email})`,
                    issuer: `${config.COMPANY_NAME}`
                });

                mfa = await MfaSceretModel.create({
                    userId: userData.id,
                    secretKey: secret.base32,
                    status: "INACTIVE"
                });
            } else {
                // Already generated, reuse existing
                secret = {
                    base32: mfa.secretKey,
                    otpauth_url: speakeasy.otpauthURL({
                        secret: mfa.secretKey,
                        label: `${config.COMPANY_NAME} (${userData.email})`,
                        issuer: `${config.COMPANY_NAME}`,
                        encoding: "base32"
                    })
                };
            }

            const qr = await qrcode.toDataURL(secret.otpauth_url);

            userLogger.info('Exiting setup2fa: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
                status: true,
                message: "Scan the QR code using Google Authenticator",
                data: {
                    secret: secret.base32,
                    qr
                }
            });
        }

        // If OTP is sent, verify it
        if (mfa && mfa.status === "INACTIVE") {
            const verified = speakeasy.totp.verify({
                secret: mfa.secretKey,
                encoding: 'base32',
                token: otp,
                window: 1
            });

            console.log("OTP verified:", verified);

            if (!verified) {
                throw CustomErrorHandler.wrongCredentials("Invalid OTP!");
            }

            // Mark MFA as enabled
            mfa.status = "ACTIVE";
            await mfa.save();

            userData.isMfaAdded = true;
            await userData.save();

            userLogger.info('Exiting setup2fa: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
                status: true,
                message: "2FA setup successful",
                data: null
            });
        }

        // Fallback
        throw CustomErrorHandler.wrongCredentials("Something Went Wrong!");

    } catch (e) {
        userLogger.error('Error in setup2fa', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

