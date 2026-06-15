const bcrypt = require("bcrypt");
const { Op, fn, col, where } = require("sequelize");
const config = require("../../config/config");
const { createUserName, generatePassword } = require("../../helpers/index");
const MailSender = require("../../utils/mail");
const { BankDetails: BankModel, Documents: DocumentModel } = require("../../models/kyc.model");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const PasswordModel = require("../../models/password.model");
const TrackingModel = require("../../models/tracking.model");
const Mt5Model = require("../../models/mt5Account.model");
const PermissionModel = require("../../models/permission.model");
const TransactionModel = require("../../models/transaction.model");
const FiatDepositModel = require("../../models/depositWithdraw.model");
const MarketingMemberModel = require("../../models/marketingUser.model");
const IbModel = require("../../models/ib.model");
const Mt5GroupModel = require("../../models/mt5Group.model");
const GroupModel = require("../../models/group.model");
const MetaControllers = require("../../mt5Services/user");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { createExcelExport, getExcelHeaders, generateFileName } = require("../../utils/excelExport");
const { adminLogger } = require("../../utils/logger");

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const normalizeBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
        const normalizedValue = value.trim().toLowerCase();
        return normalizedValue === "true" || normalizedValue === "1";
    }
    return Boolean(value);
};

module.exports.addUser = async (request, response) => {
    try {
        adminLogger.info('Entering addUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, password, country, countryCode, mobile, dob, gender, address } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkEmail = await UserModel.findOne({
            where: { email: email.toLowerCase().trim() }
        }); if (checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");

        const checkMobile = await UserModel.findOne({
            where: { mobile: mobile.trim() }
        }); if (checkMobile) throw CustomErrorHandler.alreadyExist("Your Mobile Is Already Registered!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(password, passwordSalt);

        const newUserName = await createUserName();

        const newUsers = await UserModel.create({
            userName: newUserName.trim(),
            name: name.trim(),
            country: country,
            countryCode,
            email: email.toLowerCase().trim(),
            mobile: mobile,
            password: passwordHash,
            dob, gender, address,
            isEmailVerified: true,
            isMobileVerified: true,
        });

        await AssetModel.create({
            userId: newUsers.id
        });

        await PasswordModel.create({
            userId: newUsers.id,
            passwordList: [
                {
                    passwordType: "LOGIN",
                    password,
                }
            ],
        });

        MailSender.sendWelcomeEmail(email, name, newUsers.userName, password);

        adminLogger.info('Exiting addUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "User added.",
            data: newUsers,
        });
    } catch (e) {
        adminLogger.error('Error in addUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateUser = async (request, response) => {
    try {
        adminLogger.info('Entering updateUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, name, email, password, country, countryCode, mobile, isSubIb, isDeleted, dob, gender, isIb,
            address, isMt5WithdrawlAllowed, isMt5DepositAllowed, isIbWithdrawlAllowed, isTransferAllowed, isWithdrawlAllowed,
            isDepositeAllowed, isMobileVerified, isEmailVerified, isKycVerified, isBankVerified } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkUser = await UserModel.findByPk(userId);
        if (!checkUser) throw CustomErrorHandler.notFound("User id not found");

        if (email) {
            const checkEmail = await UserModel.findOne({
                where: { email: email.toLowerCase().trim(), id: { [Op.ne]: userId } }
            });
            if (checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");
            checkUser.email = email.toLowerCase().trim();
        }

        if (mobile) {
            const checkMobile = await UserModel.findOne({
                where: { mobile: mobile.trim(), id: { [Op.ne]: userId } }
            });
            if (checkMobile) throw CustomErrorHandler.alreadyExist("Your Mobile Is Already Registered!");
            checkUser.mobile = mobile;
        }

        if (name) checkUser.name = name.trim();
        if (country) checkUser.country = country.trim().toUpperCase();
        if (dob) checkUser.dob = dob;
        if (gender) checkUser.gender = gender;
        if (address) checkUser.address = address;
        if (isIb) checkUser.isIb = isIb;
        if (isSubIb) checkUser.isSubIb = isSubIb;
        if (countryCode) checkUser.countryCode = countryCode;

        if (password) {
            const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
            const passwordHash = await bcrypt.hash(password, passwordSalt);

            checkUser.password = passwordHash;

            let passwordData = await PasswordModel.findOne({ where: { userId } });

            let passwordList = [...passwordData.passwordList];
            passwordList[0] = { passwordType: "LOGIN", password };
            passwordData.passwordList = passwordList;
            await passwordData.save();
        };

        if (hasOwn(request.body, "isDeleted")) checkUser.isDeleted = normalizeBoolean(isDeleted);
        if (hasOwn(request.body, "isMt5WithdrawlAllowed")) checkUser.isMt5WithdrawlAllowed = normalizeBoolean(isMt5WithdrawlAllowed);
        if (hasOwn(request.body, "isMt5DepositAllowed")) checkUser.isMt5DepositAllowed = normalizeBoolean(isMt5DepositAllowed);
        if (hasOwn(request.body, "isIbWithdrawlAllowed")) checkUser.isIbWithdrawlAllowed = normalizeBoolean(isIbWithdrawlAllowed);
        if (hasOwn(request.body, "isTransferAllowed")) checkUser.isTransferAllowed = normalizeBoolean(isTransferAllowed);
        if (hasOwn(request.body, "isWithdrawlAllowed")) checkUser.isWithdrawlAllowed = normalizeBoolean(isWithdrawlAllowed);
        if (hasOwn(request.body, "isDepositeAllowed")) checkUser.isDepositeAllowed = normalizeBoolean(isDepositeAllowed);
        if (hasOwn(request.body, "isMobileVerified")) checkUser.isMobileVerified = normalizeBoolean(isMobileVerified);
        if (hasOwn(request.body, "isEmailVerified")) checkUser.isEmailVerified = normalizeBoolean(isEmailVerified);
        if (hasOwn(request.body, "isBankVerified")) checkUser.isBankVerified = normalizeBoolean(isBankVerified);

        if (hasOwn(request.body, "isKycVerified")) {
            const nextKycVerified = normalizeBoolean(isKycVerified);
            checkUser.isKycVerified = nextKycVerified;

            const kycDocument = await DocumentModel.findOne({
                where: { userId, isDeleted: false },
                order: [["updatedAt", "DESC"]],
            });

            if (kycDocument) {
                await kycDocument.update({
                    status: nextKycVerified ? "APPROVED" : "REJECTED",
                    approvedBy: adminData.id,
                });
            }
        }

        await checkUser.save();

        adminLogger.info('Exiting updateUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "User Updated.",
            data: checkUser,
        });
    } catch (e) {
        adminLogger.error('Error in updateUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userList = async (request, response) => {
    try {
        adminLogger.info('Entering userList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, isIb, isSubIb, marketingId, isKycVerified, fromDate, toDate,
            search, country, fileExport: isExport, exportType } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = isExport === 'true' ? 0 : (page - 1) * sizePerPage;
        const limit = isExport === 'true' ? 100000 : sizePerPage; // No limit for export

        // Search condition
        const searchCondition = search
            ? {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } },
                    { mobile: { [Op.iLike]: `%${search}%` } },
                    { userName: { [Op.iLike]: `%${search}%` } },
                    { country: { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = {
            role: "USER",
            ...searchCondition,
        };

        if (fromDate && toDate) {
            whereCondition.createdAt = {
                [Op.between]: [new Date(fromDate), new Date(toDate)],
            };
        } else if (fromDate) {
            whereCondition.createdAt = {
                [Op.gte]: new Date(fromDate),
            };
        } else if (toDate) {
            whereCondition.createdAt = {
                [Op.lte]: new Date(toDate),
            };
        }

        if (isIb) whereCondition.isIb = true;
        if (isSubIb) whereCondition.isSubIb = true;
        if (marketingId) whereCondition.assingToManager = marketingId;
        if (isKycVerified) whereCondition.isKycVerified = isKycVerified;
        if (country) whereCondition.country = country;

        const { count, rows: usersList } = await UserModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: MarketingMemberModel,
                    as: 'sales',
                    attributes: ['name', 'email'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
                {
                    model: UserModel,
                    as: 'parent',
                    attributes: ['name', 'userName', 'email', 'isIb', 'isSubIb'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
            limit,
            offset,
        });

        // If export is requested, return Excel file
        if (isExport === 'true') {
            if (exportType === "IB_USER") {
                const userIds = usersList.map((u) => u.id);
                const ibRecords = userIds.length > 0
                    ? await IbModel.findAll({
                        where: { userId: { [Op.in]: userIds }, isDeleted: false },
                        attributes: ["userId", "remark"],
                        order: [["createdAt", "DESC"]],
                    })
                    : [];
                const remarkByUserId = ibRecords.reduce((acc, ibRecord) => {
                    if (!acc[ibRecord.userId]) {
                        acc[ibRecord.userId] = ibRecord.remark || "";
                    }
                    return acc;
                }, {});

                const exportData = usersList.map(u => {
                    return {
                        "Name": u.name || "",
                        "Email": u.email || "",
                        "Phone": u.mobile || "",
                        "Country": u.country || "",
                        "Parent Name": u.parent?.name || "",
                        "Parent Email": u.parent?.email || "",
                        "Parent User Name": u.parent?.userName || "",
                        "Remark": remarkByUserId[u.id] || "",
                    };
                });

                const excelBuffer = createExcelExport(exportData, {
                    sheetName: 'IB User List',
                    fileName: generateFileName('ib_user_list')
                });

                return response.set(getExcelHeaders('ib_user_list.xlsx'))
                    .send(excelBuffer);
            }

            const exportData = usersList.map(u => {
                return {
                    "User name": u.userName || "",
                    "Name": u.name || "",
                    "Email": u.email || "",
                    "Country": u.country || "",
                    "Parent Name": u.parent?.name || "",
                    "Parent Email": u.parent?.email || "",
                    "Sales Name": u.sales?.name || "",
                    "Sales Email": u.sales?.email || "",
                    "Registration Date": u.createdAt ? new Date(u.createdAt).toLocaleString() : "",
                    "Status": u.isDeleted ? "Inactive" : "Active",
                };
            });

            const excelBuffer = createExcelExport(exportData, {
                sheetName: 'User List',
                fileName: generateFileName('user_list')
            });

            return response.set(getExcelHeaders('user_list.xlsx'))
                .send(excelBuffer);
        }

        adminLogger.info('Exiting userList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in userList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.assetList = async (request, response) => {
    try {
        adminLogger.info('Entering assetList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, fromDate, toDate, search, isFtd } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        // Search condition
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

        const whereCondition = {};

        if (fromDate && toDate) {
            whereCondition.createdAt = {
                [Op.between]: [new Date(fromDate), new Date(toDate)],
            };
        } else if (fromDate) {
            whereCondition.createdAt = {
                [Op.gte]: new Date(fromDate),
            };
        } else if (toDate) {
            whereCondition.createdAt = {
                [Op.lte]: new Date(toDate),
            };
        }

        if (isFtd) {
            whereCondition.totalDeposit = {
                [Op.gte]: 1,
            };
        }

        const { count, rows: assetList } = await AssetModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['name', 'userName', 'email', 'mobile', 'isSubIb'], // Only fetch name, email, mobile
                    where: { isDeleted: false, role: "USER", ...searchCondition }, // Respect soft deletes in User
                    required: false
                },
            ],
            limit,
            offset,
        });

        adminLogger.info('Exiting assetList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Asset list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                assetList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in assetList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userById = async (request, response) => {
    try {
        adminLogger.info('Entering userById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const userData = await UserModel.findOne({
            where: { role: { [Op.ne]: "ADMIN" }, id },
            include: [
                {
                    model: MarketingMemberModel,
                    as: 'sales',
                    attributes: ['name', 'email'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
                {
                    model: UserModel,
                    as: 'parent',
                    attributes: ['name', 'userName', 'email', 'isIb', 'isSubIb'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
        });

        const assetData = await AssetModel.findOne({
            where: { userId: id }
        })

        if (!userData) throw CustomErrorHandler.notFound("User Not found!");

        const kycDocument = await DocumentModel.findOne({
            where: { userId: id, isDeleted: false },
            attributes: ["id", "status"],
            order: [["updatedAt", "DESC"]],
        });

        const userDataJson = userData.toJSON();
        userDataJson.kycStatus = kycDocument?.status || null;

        if (kycDocument?.status === "APPROVED") {
            userDataJson.isKycVerified = true;

            if (!userData.isKycVerified) {
                await userData.update({ isKycVerified: true });
            }
        }

        adminLogger.info('Exiting userById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Details.",
            data: { userData: userDataJson, assetData }
        });
    } catch (e) {
        adminLogger.error('Error in userById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addMT5User = async (request, response) => {
    try {
        adminLogger.info('Entering addMT5User', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, groupId, Leverage, PassMain } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userData = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notFound("Not found or Deleted!");

        const PassInvestor = generatePassword();
        const checkGroup = await GroupModel.findOne({
            where: {
                id: groupId,
            },
            include: [
                {
                    model: Mt5GroupModel,
                    as: "mt5GroupData",
                    attributes: ["mt5GroupName"],
                },
            ],
        }); if (!checkGroup) throw CustomErrorHandler.notFound("Group not found!");
        if (checkGroup.leverage < Leverage) throw CustomErrorHandler.wrongCredentials("Group Laverage Limit exceeds!")

        const group = checkGroup.mt5GroupData.mt5GroupName;

        let login = 0;
        if (checkGroup.type == "REAL") {
            const mt5Account = await Mt5Model.findOne({
                where: {
                    accountType: "REAL",
                    [Op.and]: [
                        where(fn("LENGTH", col("Login")), { [Op.gte]: parseInt(config.REAL_SERIES) || 6 })
                    ],
                },
                order: [["createdAt", "DESC"]],
            });
            console.log("mt5Account", mt5Account);
            login = mt5Account ? Number(mt5Account.Login) + 1 : Math.pow(10, (parseInt(config.REAL_SERIES) || 6) - 1);
        } else {
            const mt5Account = await Mt5Model.findOne({
                where: {
                    accountType: "DEMO",
                    [Op.and]: [
                        where(fn("LENGTH", col("Login")), { [Op.gte]: parseInt(config.DEMO_SERIES) || 6 })
                    ],
                },
                order: [["createdAt", "DESC"]],
            });
            login = mt5Account ? Number(mt5Account.Login) + 1 : Math.pow(10, (parseInt(config.DEMO_SERIES) || 6) - 1);
        }

        // Final safety check to ensure login is a valid number
        if (isNaN(login)) {
            login = 100000;
        }

        const metaUserData = {
            login: parseInt(login),
            name: userData.name || userData.userName || userData.email,
            group,
            Leverage: parseInt(Leverage),
            PassMain,
            PassInvestor,
            Email: userData.email,
            Phone: userData.mobile ? userData.mobile : "",
            Country: userData.country ? userData.country : "",
            City: "",
            State: "",
            ZipCode: "",
            Address: "",
            PhonePassword: "",
        };
        console.log("Create mt5 Account Payload:", metaUserData)
        let newUserData = null;
        let attempt = 0;

        while (!newUserData && attempt < 5) {
            const result = await MetaControllers.addUser(metaUserData);
            if (result && !result._mt5Error) {
                newUserData = result;
            } else {
                console.log(`Failed to create MT5 User with login ${metaUserData.login}. Incrementing and retrying...`);
                metaUserData.login += 1;
                attempt++;
            }
        }

        // Fallback to auto-allocate if custom login attempts fail
        if (!newUserData) {
            console.log("[MT5] Custom login creation failed. Retrying with auto-allocate (Login: 0)...");
            metaUserData.login = 0;
            const result = await MetaControllers.addUser(metaUserData);
            if (result && !result._mt5Error) {
                newUserData = result;
            }
        }

        if (!newUserData) throw CustomErrorHandler.serverError("Failed to Create MT5 User after multiple attempts!");

        let passwordEntry = await PasswordModel.findOne({ where: { userId: userData.id } });

        if (!passwordEntry) {
            // Create new if not exists
            passwordEntry = await PasswordModel.create({
                userId: userData.id,
                mt5Login: newUserData.answer.Login,
                passwordList: [
                    { passwordType: "MT5-MAIN", password: PassMain, mt5Login: newUserData.answer.Login },
                    { passwordType: "MT5-INVESTOR", password: PassInvestor, mt5Login: newUserData.answer.Login }
                ]
            });
        } else {
            // Update mt5Login and append to passwordList
            const updatedList = [...passwordEntry.passwordList];

            updatedList.push(
                { passwordType: "MT5-MAIN", password: PassMain, mt5Login: newUserData.answer.Login },
                { passwordType: "MT5-INVESTOR", password: PassInvestor, mt5Login: newUserData.answer.Login }
            );

            await passwordEntry.update({
                mt5Login: newUserData.answer.Login,
                passwordList: updatedList
            });
        }

        const newAccount = await Mt5Model.create({
            userId: userData.id,
            Login: newUserData.answer.Login,
            accountType: checkGroup.type,
            groupId: checkGroup.id,
            CertSerialNumber: newUserData.answer.CertSerialNumber || "0",
            Rights: newUserData.answer.Rights || "",
            MQID: newUserData.answer.MQID || "0",
            Registration: newUserData.answer.Registration || "",
            LastAccess: newUserData.answer.LastAccess || "",
            LastPassChange: newUserData.answer.LastPassChange || "",
            LastIP: newUserData.answer.LastIP || "",
            Name: newUserData.answer.Name || "",
            FirstName: newUserData.answer.FirstName || "",
            LastName: newUserData.answer.LastName || "",
            MiddleName: newUserData.answer.MiddleName || "",
            Company: newUserData.answer.Company || "",
            Account: newUserData.answer.Account || "",
            Country: newUserData.answer.Country || Country || "",
            Language: newUserData.answer.Language || "0",
            ClientID: newUserData.answer.ClientID || "0",
            City: newUserData.answer.City || "",
            State: newUserData.answer.State || "",
            ZipCode: newUserData.answer.ZipCode || "",
            Address: newUserData.answer.Address || "",
            Phone: newUserData.answer.Phone || "",
            Email: newUserData.answer.Email || "",
            ID: newUserData.answer.ID || "",
            Status: newUserData.answer.Status || "",
            Comment: newUserData.answer.Comment || "",
            Color: newUserData.answer.Color || "",
            PhonePassword: newUserData.answer.PhonePassword || "",
            Leverage: newUserData.answer.Leverage || Leverage || "",
            Agent: newUserData.answer.Agent || "0",
            LimitPositions: newUserData.answer.LimitPositions || "0",
            LimitOrders: newUserData.answer.LimitOrders || "0",
            CurrencyDigits: newUserData.answer.CurrencyDigits || "2",
            Balance: parseFloat(newUserData.answer.Balance || "0.00"),
            Credit: parseFloat(newUserData.answer.Credit || "0.00"),
            InterestRate: parseFloat(newUserData.answer.InterestRate || "0.00"),
            CommissionDaily: parseFloat(newUserData.answer.CommissionDaily || "0.00"),
            CommissionMonthly: parseFloat(newUserData.answer.CommissionMonthly || "0.00"),
            CommissionAgentDaily: parseFloat(newUserData.answer.CommissionAgentDaily || "0.00"),
            CommissionAgentMonthly: parseFloat(newUserData.answer.CommissionAgentMonthly || "0.00"),
            BalancePrevDay: parseFloat(newUserData.answer.BalancePrevDay || "0.00"),
            BalancePrevMonth: parseFloat(newUserData.answer.BalancePrevMonth || "0.00"),
            EquityPrevDay: parseFloat(newUserData.answer.EquityPrevDay || "0.00"),
            EquityPrevMonth: parseFloat(newUserData.answer.EquityPrevMonth || "0.00"),
            TradeAccounts: newUserData.answer.TradeAccounts || "",
        })

        MailSender.sendMt5WelcomeEmail(userData.email, userData.name, newAccount.Login, PassMain, PassInvestor)

        adminLogger.info('Exiting addMT5User: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 User added.",
            data: newAccount,
        });
    } catch (e) {
        adminLogger.error('Error in addMT5User', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.mt5UserList = async (request, response) => {
    try {
        adminLogger.info('Entering mt5UserList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, searchWithLogin, userId, type, fileExport: isExport } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = isExport === 'true' ? 0 : (page - 1) * sizePerPage;
        const limit = isExport === 'true' ? 100000 : sizePerPage;

        // Search condition
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

        const searchByLogin = searchWithLogin
            ? {
                [Op.or]: [
                    { Login: { [Op.iLike]: `%${searchWithLogin}%` } },
                ],
            }
            : {};

        const whereCondition = {
            ...searchByLogin,
            ...(userId && { userId }),
            ...(type && { accountType: type }),
        };

        const { count, rows: usersList } = await Mt5Model.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                    where: { isDeleted: false, ...searchCondition }
                },
                {
                    model: GroupModel,
                    as: "group",
                    attributes: ["name", "leverage"] // Adjust based on your Groups table fields
                }
            ],
            offset,
        });
        // console.log("MT5 User List:", usersList)
        if (isExport === 'true') {
            const exportData = usersList.map(u => {
                return {
                    Login: u.Login,
                    Name: u.Name,
                    FirstName: u.FirstName,
                    email: u.Email ? u.Email.replace(/.(?=.{2}@)/g, '*') : u.email,
                    Leverage: u.Leverage,
                    mobile: u.Phone,
                    Registration: u.Registration,
                    Country: u.Country,
                    CurrencyDigits: u.CurrencyDigits,
                    group: u.group.name,
                    createdAt: u.createdAt
                };
            });

            const excelBuffer = createExcelExport(exportData, {
                emailFields: ['email'],
                sheetName: 'User List',
                fileName: generateFileName('user_list')
            });

            return response.set(getExcelHeaders('user_list.xlsx'))
                .send(excelBuffer);
        }

        adminLogger.info('Exiting mt5UserList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Mt5 Account list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in mt5UserList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.mt5UserById = async (request, response) => {
    try {
        adminLogger.info('Entering mt5UserById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const userData = await Mt5Model.findOne({
            where: { id, isDeleted: false },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                }
            ],
        })

        adminLogger.info('Exiting mt5UserById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Mt5 User Details.",
            data: userData,
        });
    } catch (e) {
        adminLogger.error('Error in mt5UserById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addBank = async (request, response) => {
    try {
        adminLogger.info('Entering addBank', { method: request.method || "", route: request.originalUrl || "" });
        const { userId, holderName, accountNo, ifscCode, ibanNo, bankName, bankAddress, country } = request.query;
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, role: "USER", isDeleted: false }
        }); if (!checkUser) throw CustomErrorHandler.notFound("User Not found or Deleted!");

        const checkBank = await BankModel.findOne({
            where: { accountNo: accountNo }
        }); if (checkBank) throw CustomErrorHandler.alreadyExist("Account no Already exists!")

        const newBank = await BankModel.create({
            userId,
            holderName,
            accountNo,
            ifscCode,
            ibanNo,
            bankName,
            bankAddress,
            country,
            image: request.files && request.files.image ? request.files.image[0].filename : null
        });

        adminLogger.info('Exiting addBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Bank added.",
            data: newBank,
        });
    } catch (e) {
        adminLogger.error('Error in addBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateBank = async (request, response) => {
    try {
        adminLogger.info('Entering updateBank', { method: request.method || "", route: request.originalUrl || "" });
        const { bankId, isDeleted, holderName, accountNo, ifscCode, ibanNo, bankName, bankAddress, country } = request.query;
        const { user } = request.body;

        const image = request.files && request.files.image ? request.files.image[0].filename : null;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkBank = await BankModel.findOne({
            where: { id: bankId }
        }); if (!checkBank) throw CustomErrorHandler.notFound("Bank Details not found!");

        const checkUser = await UserModel.findByPk(checkBank.userId);
        if (!checkUser) throw CustomErrorHandler.notFound("User Not found!");

        if (accountNo) {
            const duplicateBank = await BankModel.findOne({
                where: {
                    accountNo,
                    id: { [Op.ne]: checkBank.id }
                }
            }); if (duplicateBank) throw CustomErrorHandler.alreadyExist("Account no Already exists!");
        }

        if (isDeleted) checkBank.isDeleted = isDeleted;
        if (holderName) checkBank.holderName = holderName;
        if (accountNo) checkBank.accountNo = accountNo;
        if (ifscCode) checkBank.ifscCode = ifscCode;
        if (ibanNo) checkBank.ibanNo = ibanNo;
        if (bankName) checkBank.bankName = bankName;
        if (bankAddress) checkBank.bankAddress = bankAddress;
        if (country) checkBank.country = country;
        if (image) checkBank.image = image;

        checkBank.approvedBy = adminData.id;
        await checkBank.save();

        const approvedBankCount = await BankModel.count({
            where: {
                userId: checkUser.id,
                isDeleted: false,
                status: "APPROVED",
                id: { [Op.ne]: checkBank.id }
            }
        });

        checkUser.isBankVerified = approvedBankCount > 0;
        await checkUser.save();

        adminLogger.info('Exiting updateBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Bank updated.",
            data: checkBank,
        });
    } catch (e) {
        adminLogger.error('Error in updateBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankList = async (request, response) => {
    try {
        adminLogger.info('Entering bankList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, status, userId, fileExport: isExport } = request.query;
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = isExport === 'true' ? 100000 : sizePerPage;

        // Search condition
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

        const whereCondition = {};
        if (userId) whereCondition.userId = userId;
        if (status) whereCondition.status = status;

        const { count, rows } = await BankModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                    where: { isDeleted: false, ...searchCondition }
                }
            ],
            offset,
        });

        const host = `${request.protocol}://${request.get("host")}`;

        const usersList = rows.map((bank) => {
            return {
                ...bank.toJSON(),
                imageUrl: bank.image
                    ? `${host}/public/bankDetails/${bank.image}`
                    : null,
            };
        });

        // If export is requested, return Excel file
        if (isExport === 'true') {
            const exportData = usersList.map(bank => {
                return {
                    holderName: bank.holderName,
                    bankName: bank.bankName,
                    accountNo: bank.accountNo,
                    ibanNo: bank.ibanNo,
                    ifscCode: bank.ifscCode,
                    bankAddress: bank.bankAddress,
                    country: bank.country
                };
            });

            const excelBuffer = createExcelExport(exportData, {
                emailFields: [],
                sheetName: 'Bank List',
                fileName: generateFileName('bank_list')
            });

            return response.set(getExcelHeaders('bank_list.xlsx'))
                .send(excelBuffer);
        }

        adminLogger.info('Exiting bankList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in bankList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankById = async (request, response) => {
    try {
        adminLogger.info('Entering bankById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const bank = await BankModel.findOne({
            where: { id, isDeleted: false },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                }
            ],
        })

        if (!bank) throw CustomErrorHandler.notFound("Bank Details not found!");

        const host = `${request.protocol}://${request.get("host")}`;
        bank.image = bank.image ? `${host}/public/bankDetails/${bank.image}` : null;

        adminLogger.info('Exiting bankById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details.",
            data: bank,
        });
    } catch (e) {
        adminLogger.error('Error in bankById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.approveBank = async (request, response) => {
    try {
        adminLogger.info('Entering approveBank', { method: request.method || "", route: request.originalUrl || "" });
        const { user, bankId, status, remark } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkBank = await BankModel.findOne({
            where: { id: bankId, isDeleted: false },
        }); if (!checkBank) throw CustomErrorHandler.notFound("Bank Details not found!");

        const checkUser = await UserModel.findByPk(checkBank.userId);
        if (!checkUser) throw CustomErrorHandler.notFound("User Not found!");

        const updateData = {
            status,
            approvedBy: adminData.id,
            remark
        };

        await checkBank.update(updateData);

        const approvedBankCount = await BankModel.count({
            where: { userId: checkUser.id, isDeleted: false, status: "APPROVED" }
        });
        checkUser.isBankVerified = approvedBankCount > 0;
        await checkUser.save();

        adminLogger.info('Exiting approveBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Bank ${status.toLowerCase()} successfully.`,
            data: checkBank,
        });
    } catch (e) {
        adminLogger.error('Error in approveBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.uploadDocument = async (request, response) => {
    try {
        adminLogger.info('Entering uploadDocument', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { userId } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const poi = request.files.poi ? request.files.poi[0].filename : null;
        const poa = request.files.poa ? request.files.poa[0].filename : null;

        // Multiple documents
        const extraDocs = request.files.extraDocs
            ? request.files.extraDocs.map((x) => x.filename)
            : [];

        let doc = await DocumentModel.findOne({
            where: { userId, isDeleted: false },
        });

        // 📌 If document exists → update freely
        if (doc) {
            const updateData = {};

            if (poi) updateData.poi = poi;
            if (poa) updateData.poa = poa;

            // append new extra docs
            if (extraDocs.length > 0) {
                updateData.extraDocs = [
                    ...(doc.extraDocs || []),
                    ...extraDocs,
                ];
            }

            // No condition for updating extraDocs
            doc = await doc.update(updateData);
        }
        else {
            // 📌 Create fresh document
            doc = await DocumentModel.create({
                userId,
                poi,
                poa,
                extraDocs,
                status: "APPROVED", // You can change if needed
                approvedBy: user.id,
            });
        }

        adminLogger.info('Exiting uploadDocument: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Document Uploaded.",
            data: doc,
        });

    } catch (e) {
        adminLogger.error('Error in uploadDocument', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.documentList = async (request, response) => {
    try {
        adminLogger.info('Entering documentList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, status, userId } = request.query;
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } },
        });
        if (!adminData) throw new Error("Access Denied! Admin access required.");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

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

        const whereCondition = { isDeleted: false };
        if (userId) whereCondition.userId = userId;
        if (status) whereCondition.status = status;

        const { count, rows } = await DocumentModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"],
                    where: { isDeleted: false, ...searchCondition },
                },
            ],
            offset,
        });

        const host = `${request.protocol}://${request.get("host")}`;
        const makeUrl = (file) => (file ? `${host}/public/documents/${file}` : null);

        const documentsList = rows.map((doc) => {
            const data = doc.toJSON();

            return {
                ...data,
                poi: makeUrl(data.poi),
                poa: makeUrl(data.poa),
                extraDocs: Array.isArray(data.extraDocs)
                    ? data.extraDocs.map((f) => makeUrl(f))
                    : [],
            };
        });

        adminLogger.info('Exiting documentList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Document list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page, 10),
                documentsList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in documentList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.approveKyc = async (request, response) => {
    try {
        adminLogger.info('Entering approveKyc', { method: request.method || "", route: request.originalUrl || "" });
        const { user, documentId, status, poi, poa, remark } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const document = await DocumentModel.findOne({
            where: { id: documentId, isDeleted: false },
        }); if (!document) throw CustomErrorHandler.notFound("Document not found!");

        const checkUser = await UserModel.findByPk(document.userId);
        if (!checkUser) throw CustomErrorHandler.notFound("User Not found!");

        const updateData = {
            status,
            remark,
            approvedBy: adminData.id,
        };

        if (status === "REJECTED") {
            if (poi == 0) updateData.poi = null;
            if (poa == 0) updateData.poa = null;
        }

        await document.update(updateData);

        checkUser.isKycVerified = status === "APPROVED";
        await checkUser.save();

        adminLogger.info('Exiting approveKyc: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Document ${status.toLowerCase()} successfully.`,
            data: document,
        });
    } catch (e) {
        adminLogger.error('Error in approveKyc', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.passwordList = async (request, response) => {
    try {
        adminLogger.info('Entering passwordList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, userId } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

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

        const whereCondition = {
            isDeleted: false,
        };

        if (userId) whereCondition.userId = userId;

        const { count, rows: passwordList } = await PasswordModel.findAndCountAll({
            where: whereCondition,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'mobile', 'userName'], // Only fetch name, email, mobile
                    where: { isDeleted: false, ...searchCondition }, // Respect soft deletes in User
                },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        // This admin-only endpoint powers the password detail views, so it must
        // return the decrypted password list instead of the model's redacted
        // toJSON() representation.
        const sanitizedPasswordList = passwordList.map((row) => row.get({ plain: true }));

        adminLogger.info('Exiting passwordList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                passwordList: sanitizedPasswordList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in passwordList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.changePassword = async (request, response) => {
    try {
        adminLogger.info('Entering changePassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, newPassword } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkUser = await UserModel.findByPk(userId);
        if (!checkUser) throw CustomErrorHandler.notFound("Not found!");

        const passwordData = await PasswordModel.findOne({ where: { userId } });
        if (!passwordData) throw CustomErrorHandler.notFound("Password Record Not Found!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(newPassword, passwordSalt);

        checkUser.password = passwordHash;
        await checkUser.save();

        const passwordList = [...passwordData.passwordList];

        passwordList[0] = { passwordType: "LOGIN", password: newPassword };
        passwordData.passwordList = passwordList;
        await passwordData.save();

        adminLogger.info('Exiting changePassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password Changed.",
            data: "",
        });
    } catch (e) {
        adminLogger.error('Error in changePassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

function findIndexByLoginAndType(passwordList, mt5Login, passwordType) {
    return passwordList.findIndex(
        item => String(item.mt5Login) === String(mt5Login) && item.passwordType === passwordType
    );
}

module.exports.updateMt5 = async (request, response) => {
    try {
        adminLogger.info('Entering updateMt5', { method: request.method || "", route: request.originalUrl || "" });
        const { user, mt5Login, PassMain, PassInvestor, Leverage, groupId } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const mt5Data = await Mt5Model.findOne({
            where: { Login: mt5Login }
        }); if (!mt5Data) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        let group = "";
        if (groupId) {
            const checkGroup = await GroupModel.findByPk(groupId);
            if (!checkGroup) throw CustomErrorHandler.notFound("Group Not Found!");

            const checkMt5Group = await Mt5GroupModel.findOne({
                where: { id: checkGroup.mt5Group }
            }); if (!checkMt5Group) throw CustomErrorHandler.notFound("Mt5 Group Name Not Found!");
            group = checkMt5Group.mt5GroupName;
        };

        if (Leverage) {
            const metaUserData = { login: parseInt(mt5Login), Leverage };
            const updatedData = await MetaControllers.updateUser(metaUserData);
            if (!updatedData) throw CustomErrorHandler.serverError("Failed to Update MT5 User!");
            if (Leverage) mt5Data.Leverage = Leverage;
            await mt5Data.save();
        }

        if (group) {
            const metaUserData = { login: parseInt(mt5Login), group };
            const updatedData = await MetaControllers.updateUser(metaUserData);
            if (!updatedData) throw CustomErrorHandler.serverError("Failed to Update MT5 User!");
            if (groupId) mt5Data.groupId = groupId;
            await mt5Data.save();
        }

        const passwordData = await PasswordModel.findOne({
            where: { userId: mt5Data.userId }
        });
        const passwordList = [...passwordData.passwordList];

        if (PassMain) {
            await MetaControllers.changePassword(mt5Login, "main", PassMain);
            const index = findIndexByLoginAndType(passwordList, mt5Login, "MT5-MAIN");
            passwordList[index] = { passwordType: "MT5-MAIN", password: PassMain, mt5Login };
        }

        if (PassInvestor) {
            await MetaControllers.changePassword(mt5Login, "investor", PassInvestor);
            const index = findIndexByLoginAndType(passwordList, mt5Login, "MT5-INVESTOR");
            passwordList[index] = { passwordType: "MT5-INVESTOR", password: PassInvestor, mt5Login };
        }
        passwordData.passwordList = passwordList;
        await passwordData.save();

        adminLogger.info('Exiting updateMt5: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Updated MT5 Account.",
            data: "",
        });
    } catch (e) {
        adminLogger.error('Error in updateMt5', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userDetails = async (request, response) => {
    try {
        adminLogger.info('Entering userDetails', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        // Fetch user details along with the referral (fromUser)
        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            },
            include: [
                {
                    model: UserModel, // Self-referencing association
                    as: "fromUser",
                    attributes: ["name", "email", "mobile", "referralCode"],
                }
            ]
        });

        if (!userData) {
            throw CustomErrorHandler.unAuthorized("Access Denied!");
        }

        adminLogger.info('Exiting userDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Data retrieved successfully.",
            data: userData,
        });
    } catch (e) {
        adminLogger.error('Error in userDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateUserProfile = async (request, response) => {
    try {
        adminLogger.info('Entering updateUserProfile', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, tradingMt5AcNo, compoundingMT5AcNo, country, walletAddress } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        })
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const isExist = await UserModel.findOne({
            where: {
                [Op.or]: [
                    email ? { email } : null,
                    mobile ? { mobile } : null
                ].filter(Boolean),
                id: { [Op.ne]: user.id } // Ensure it's not the current user's data
            }
        });
        if (isExist) throw CustomErrorHandler.alreadyExist(mobile ? "Mobile Already Exists!" : "Email Already Exists!");

        const updateData = {};
        if (name) updateData.name = name;
        if (email) {
            updateData.email = email;
            updateData.isEmailVerified = false;
        }
        if (mobile) {
            updateData.mobile = mobile;
            updateData.isMobileVerified = false;
        }
        if (tradingMt5AcNo) updateData.tradingMt5AcNo = tradingMt5AcNo;
        if (compoundingMT5AcNo) updateData.compoundingMT5AcNo = compoundingMT5AcNo;
        if (country) updateData.country = country;
        if (walletAddress) updateData.walletAddress = walletAddress;

        // Ensure there is something to update
        if (Object.keys(updateData).length === 0) throw CustomErrorHandler.wrongCredentials("Nothing to update!");

        // Perform the update
        await UserModel.update(updateData, {
            where: { id: user.id }
        });

        // Fetch updated user data
        const updatedUser = await UserModel.findOne({ where: { id: user.id } });

        adminLogger.info('Exiting updateUserProfile: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Update successfully.",
            data: updatedUser,
        });
    } catch (e) {
        adminLogger.error('Error in updateUserProfile', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Updating user details", e);
        handleErrorResponse(e, response);
    }
};

module.exports.createTransactionPassword = async (request, response) => {
    try {
        adminLogger.info('Entering createTransactionPassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, securityQuestion, answer, password, cnfPassword } = request.body;

        const userData = await UserModel.findByPk(user.id)
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (userData.isTrxPassCreated) {
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
        });

        adminLogger.info('Exiting createTransactionPassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Password Created.",
            data: userData,
        });
    } catch (e) {
        adminLogger.error('Error in createTransactionPassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Create Transaction password", e);
        handleErrorResponse(e, response);
    }
};

// use for future requirement
module.exports.changeTransactionPassword = async (request, response) => {
    try {
        adminLogger.info('Entering changeTransactionPassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, currPassword, newPassword } = request.body;

        const userData = await UserModel.findByPk(user.id)
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (!userData.isTrxPassCreated) {
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

        adminLogger.info('Exiting changeTransactionPassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Password Changed.",
            data: null,
        });
    } catch (e) {
        adminLogger.error('Error in changeTransactionPassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Changing Transaction password", e);
        handleErrorResponse(e, response);
    }
};

module.exports.addBankDetails = async (request, response) => {
    try {
        adminLogger.info('Entering addBankDetails', { method: request.method || "", route: request.originalUrl || "" });
        const { user, holderName, bankName, accountNo, ifscCode, branchName, accountType, panNumber } = request.body;

        const userData = await UserModel.findByPk(user.id)
        if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (userData.isBankAccAdded) {
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

        adminLogger.info('Exiting addBankDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details Added.",
            data: userData,
        });
    } catch (e) {
        adminLogger.error('Error in addBankDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while adding bank account", e);
        handleErrorResponse(e, response);
    }
};

module.exports.getBankDetails = async (request, response) => {
    try {
        adminLogger.info('Entering getBankDetails', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        // Validate user existence
        const userData = await UserModel.findByPk(user.id);
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Access Denied!");
        }

        const fetchBank = await BankModel.findOne({
            where: { userId: user.id }
        }); if (!fetchBank) throw CustomErrorHandler.notFound("Bank account not found!");

        adminLogger.info('Exiting getBankDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details.",
            data: fetchBank
        });
    } catch (e) {
        adminLogger.error('Error in getBankDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// User referral array list
module.exports.referralList = async (request, response) => {
    try {
        adminLogger.info('Entering referralList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { ibId } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userData = await UserModel.findOne({
            where: { id: ibId, [Op.or]: [{ isIb: true }, { isSubIb: true }] },
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Ib/SubIb Not Found!");

        const userList = [];
        await buildReferralTree(userData.id, 1, userList);

        // actionTracking(request, userData.id, "REFERRAL-LIST")
        adminLogger.info('Exiting referralList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Referral Level List.",
            data: { userList, totalTeam: userList.length }

        });
    } catch (e) {
        adminLogger.error('Error in referralList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

const buildReferralTree = async (userId, level = 1, userList = []) => {
    const user = await UserModel.findByPk(userId);

    if (!user) {
        return userList;
    }

    if (level > 1) {
        let referralUser = null;
        if (user.fromUser) {
            referralUser = await UserModel.findByPk(user.fromUser);
        }
        userList.push({
            name: user.name,
            id: user.id,
            userName: user.userName,
            isSubIb: user.isSubIb,
            date: user.createdAt,
            level: user.level, // Adjust the level to exclude level 1 users
            referralUser: referralUser ? { userName: referralUser.userName, email: referralUser.email } : null
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
        adminLogger.info('Entering getUserReferralTree', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { ibId } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const mainUserData = await UserModel.findOne({
            where: { id: ibId, isDeleted: false, [Op.or]: [{ isIb: true }, { isSubIb: true }] },
        }); if (!mainUserData) throw CustomErrorHandler.unAuthorized("Ib Not found!");

        const userReferralData = await UserModel.findAll({
            where: { id: ibId, isDeleted: false }
        }); if (!userReferralData) throw CustomErrorHandler.notFound("Referral Not found!");

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
                adminLogger.error('Error in getUserReferralTree', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
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

        // actionTracking(request, mainUserData.id, "REFERRAL-TREE-VIEW")

        adminLogger.info('Exiting getUserReferralTree: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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

// Get Transaction list
module.exports.transactionList = async (request, response) => {
    try {
        adminLogger.info('Entering transactionList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, status, transactionType, userId } = request.query;
        const { user } = request.body;

        console.log(user)

        const userData = await UserModel.findByPk(user.id);
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Access Denied!");
        }

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        // Build filter condition
        const whereCondition = { userId: user.id };

        if (status) {
            whereCondition.status = status;
        }

        if (transactionType) {
            whereCondition.transactionType = transactionType;
        };
        if (userId) whereCondition.userId = userId;

        const { count, rows: transactionList } = await TransactionModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        adminLogger.info('Exiting transactionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                transactionList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in transactionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankDeposit = async (request, response) => {
    try {
        adminLogger.info('Entering bankDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { amount, transactionReference, remark } = request.query;

        const userData = await UserModel.findByPk(user.id);
        if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkTransactionReference = await FiatDepositModel.findOne({
            where: { transactionReference: transactionReference }
        }); if (checkTransactionReference) throw CustomErrorHandler.alreadyExist("Transaction Reference already exists!")

        const newDeposit = await FiatDepositModel.create({
            userId: user.id,
            amount,
            transactionReference,
            remark,
            image: request.files["image"][0].filename
        })

        adminLogger.info('Exiting bankDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deposit Success, Wait for Approvel.",
            data: newDeposit
        });
    } catch (e) {
        adminLogger.error('Error in bankDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankDepositList = async (request, response) => {
    try {
        adminLogger.info('Entering bankDepositList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, userId } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        // Pagination options
        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

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

        const whereCondition = { isDeleted: false };
        if (userId) whereCondition.userId = userId;

        // Fetch deposit history
        const { count, rows: depositHistory } = await FiatDepositModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                    where: { isDeleted: false, ...searchCondition },
                }
            ],
            offset
        });

        // Map deposits to include image URL
        const depositHistoryWithImage = depositHistory.map(deposit => ({
            ...deposit.toJSON(),
            image: deposit.image ? `${request.protocol}://${request.get('host')}/public/bankDeposit/${deposit.image}` : null,
        }));

        adminLogger.info('Exiting bankDepositList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deposit list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page),
                depositHistory: depositHistoryWithImage
            }
        });
    } catch (e) {
        adminLogger.error('Error in bankDepositList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.actionTrackingList = async (request, response) => {
    try {
        adminLogger.info('Entering actionTrackingList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, userId } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        // Pagination options
        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const whereCondition = { isDeleted: false };
        if (userId) whereCondition.userId = userId;

        const { count, rows: actionHistory } = await TrackingModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                }
            ],
            offset
        });


        adminLogger.info('Exiting actionTrackingList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Action History list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page),
                depositHistory: actionHistory
            }
        });
    } catch (e) {
        adminLogger.error('Error in actionTrackingList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.sendEmail = async (request, response) => {
    try {
        adminLogger.info('Entering sendEmail', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userIds = [], isAllUsers = false, mailType, data, subject, mailContent } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const normalizedUserIds = Array.isArray(userIds)
            ? userIds.filter((id) => id !== null && id !== undefined && id !== "")
            : [userIds].filter((id) => id !== null && id !== undefined && id !== "");

        let finalUserIds = normalizedUserIds;
        if (isAllUsers === true) {
            const allUsers = await UserModel.findAll({
                where: { role: "USER", isDeleted: false },
                attributes: ["id"],
            });
            finalUserIds = allUsers.map((u) => u.id);
        }

        finalUserIds = [...new Set(finalUserIds)];

        if (finalUserIds.length == 0) throw CustomErrorHandler.wrongCredentials("UserIds not found!");

        const BATCH_SIZE = Math.max(1, Number(config.EMAIL_BATCH_SIZE || 20));
        const BATCH_DELAY_MS = Math.max(0, Number(config.EMAIL_BATCH_DELAY_MS || 500));
        const failedUsers = [];
        let sentCount = 0;

        for (let i = 0; i < finalUserIds.length; i += BATCH_SIZE) {
            const userIdBatch = finalUserIds.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.allSettled(
                userIdBatch.map(async (userId) => {
                    const userData = await UserModel.findByPk(userId);
                    if (!userData || !userData.email) return { skipped: true, userId };
                    if (!userData.isEmailVerified) return { skipped: true, userId, reason: 'unverified' };

                    const mailData = {};
                    if (mailType == "MT5CREATED") {
                        const passwordData = await PasswordModel.findOne({
                            where: { userId }
                        }); if (!passwordData) throw CustomErrorHandler.wrongCredentials("Failed to fetch password!");
                        const passwordList = [...passwordData.passwordList];
                        const mainPasswordIndex = findIndexByLoginAndType(passwordList, data.login, "MT5-MAIN");
                        const investorPasswordIndex = findIndexByLoginAndType(passwordList, data.login, "MT5-INVESTOR");
                        if (mainPasswordIndex < 0) throw CustomErrorHandler.notFound("Main Password not fund!");
                        if (investorPasswordIndex < 0) throw CustomErrorHandler.notFound("Investor Password not fund!");

                        mailData.name = userData.name;
                        mailData.login = data.login;
                        mailData.mainPassword = passwordList[mainPasswordIndex].password;
                        mailData.investorPassword = passwordList[investorPasswordIndex].password;

                    } else if (mailType == "DEPOSIT" || mailType == "WITHDRAW") {
                        mailData.name = userData.name;
                        mailData.userName = userData.userName;
                        mailData.amount = data.amount;

                    } else if (mailType == "LOGIN-PASSWROD-CHANGED") {
                        const passwordData = await PasswordModel.findOne({
                            where: { userId }
                        }); if (!passwordData) throw CustomErrorHandler.wrongCredentials("Failed to fetch password!");
                        const passwordList = [...passwordData.passwordList];

                        mailData.name = userData.name;
                        mailData.email = userData.email;
                        mailData.userName = userData.userName;
                        mailData.password = passwordList[0].password;

                    } else if (mailType == "META-RECENT-PASSWROD-CHANGED") {
                        const passwordData = await PasswordModel.findOne({
                            where: { userId }
                        }); if (!passwordData) throw CustomErrorHandler.wrongCredentials("Failed to fetch password!");
                        const passwordList = [...passwordData.passwordList];
                        const mainPasswordIndex = findIndexByLoginAndType(passwordList, data.login, "MT5-MAIN");
                        const investorPasswordIndex = findIndexByLoginAndType(passwordList, data.login, "MT5-INVESTOR");
                        if (mainPasswordIndex < 0) throw CustomErrorHandler.notFound("Main Password not fund!");
                        if (investorPasswordIndex < 0) throw CustomErrorHandler.notFound("Investor Password not fund!");

                        mailData.name = userData.name;
                        mailData.login = data.login;
                        mailData.mainPassword = passwordList[mainPasswordIndex].password;
                        mailData.investorPassword = passwordList[investorPasswordIndex].password;
                    }

                    const _mailType = mailType ? mailType : null;
                    const emailSent = await MailSender.sendMail(userData.email, _mailType, mailData, subject, mailContent);
                    if (!emailSent) throw CustomErrorHandler.serverError("Failed to send email!");

                    return { skipped: false, userId };
                })
            );

            for (const result of batchResults) {
                if (result.status === "fulfilled") {
                    if (!result.value?.skipped) sentCount += 1;
                } else {
                    failedUsers.push(result.reason?.message || "Unknown error");
                }
            }

            if (BATCH_DELAY_MS > 0 && i + BATCH_SIZE < finalUserIds.length) {
                await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }

        if (sentCount === 0) throw CustomErrorHandler.serverError("Failed to send email to all users!");

        adminLogger.info('Exiting sendEmail: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: failedUsers.length > 0 ? "Email sent partially." : "Email Send.",
            data: {
                totalUsers: finalUserIds.length,
                sentCount,
                failedCount: failedUsers.length,
            }
        });
    } catch (e) {
        adminLogger.error('Error in sendEmail', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
