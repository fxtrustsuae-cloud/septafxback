const bcrypt = require("bcrypt");
const { Op, fn, col, where } = require("sequelize");
const config = require("../../config/config");
const { createUserName, generatePassword } = require("../../helpers/index");
const MailSender = require("../../utils/mail");
const { BankDetails: BankModel, Documents: DocumentModel } = require("../../models/kyc.model");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const IbModel = require("../../models/ib.model");
const PasswordModel = require("../../models/password.model");
const TrackingModel = require("../../models/tracking.model");
const Mt5Model  = require("../../models/mt5Account.model");
const TransactionModel = require("../../models/transaction.model");
const FiatDepositModel = require("../../models/depositWithdraw.model");      
const MarketingMemberModel = require("../../models/marketingUser.model");
const Mt5GroupModel = require("../../models/mt5Group.model");
const GroupModel = require("../../models/group.model");
const MetaControllers = require("../../mt5Services/user");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.addUser = async (request, response) => {
    try {
        marketingLogger.info('Entering addUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, password, country, countryCode, mobile, dob, gender, address } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkEmail = await UserModel.findOne({ 
            where: { email: email.toLowerCase().trim() } 
        }); if(checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");

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
            assingToManager: adminData.id,
            password: passwordHash,
            dob, gender, address
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

        marketingLogger.info('Exiting addUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "User added.",
            data: newUsers,
        });
    } catch (e) {
        marketingLogger.error('Error in addUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateUser = async (request, response) => {
    try {
        marketingLogger.info('Entering updateUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, name, email, password, country, mobile, isDeleted } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkUser = await UserModel.findByPk(userId);
        if(!checkUser) throw CustomErrorHandler.notFound("User id not found");

        if(email){
            const checkEmail = await UserModel.findOne({ 
                where: { email: email.toLowerCase().trim(), id: { [Op.ne]: userId } } 
            });
            if(checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");
            checkUser.email = email.toLowerCase().trim();
        }

        if(mobile){
            const checkMobile = await UserModel.findOne({
                where: { mobile: mobile.trim(), id: { [Op.ne]: userId } }
            });
            if (checkMobile) throw CustomErrorHandler.alreadyExist("Your Mobile Is Already Registered!");
            checkUser.mobile = mobile;
        }

        if(name) checkUser.name = name.trim();
        if(country) checkUser.country = country.trim().toUpperCase();

        if(password){
            const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
            const passwordHash = await bcrypt.hash(password, passwordSalt);

            checkUser.password = passwordHash;

            let passwordData = await PasswordModel.findOne({ where: { userId } });

            let passwordList = [...passwordData.passwordList];
            passwordList[0] = { passwordType: "LOGIN", password };
            passwordData.passwordList = passwordList;
            await passwordData.save();
        };

        if(isDeleted) checkUser.isDeleted = isDeleted;

        await checkUser.save();

        marketingLogger.info('Exiting updateUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "User Updated.",
            data: checkUser,
        });
    } catch (e) {
        marketingLogger.error('Error in updateUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userList = async (request, response) => {
    try {
        marketingLogger.info('Entering userList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, isIb, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
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
                  ],
              }
            : {};

        let isManager = false;
        let marketingIds = [];
        if(adminData.role === "MANAGER") {
            isManager = true;
            const marketingList = await MarketingMemberModel.findAll({
                where: { fromManager: adminData.id, isDeleted: false },
                attributes: ['id']
            }); if(marketingList.length === 0) throw CustomErrorHandler.notFound("Marketing Member Not Found!"); 
            marketingIds = marketingList.map(market => market.id);
        }

        const whereCondition = {
            role: "USER",
            assingToManager: isManager ? { [Op.in]: marketingIds } : adminData.id,
            ...searchCondition,
        };

        if(isIb) {
            whereCondition[Op.or] = [
                { isIb: true },
                { isSubIb: true }
            ]
        }

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
            ],
            limit,
            offset,
        });

        marketingLogger.info('Exiting userList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in userList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userById = async (request, response) => {
    try {
        marketingLogger.info('Entering userById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const userData = await UserModel.findOne({
            where: { role: { [Op.ne]: "ADMIN" }, id, assingToManager: adminData.id },
            include: [
                {
                    model: MarketingMemberModel,
                    as: 'sales',
                    attributes: ['name', 'email'],
                    where: { isDeleted: false },
                    required: false
                },
                {
                    model: UserModel,
                    as: 'parent',
                    attributes: ['name', 'userName', 'email', 'isIb', 'isSubIb'],
                    where: { isDeleted: false }, 
                    required: false
                },
            ],
        });

        const assetData = await AssetModel.findOne({
            where: { userId: id }
        })

        marketingLogger.info('Exiting userById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Details.",
            data: {userData, assetData}
        });
    } catch (e) {
        marketingLogger.error('Error in userById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addMT5User = async (request, response) => {
    try {
        marketingLogger.info('Entering addMT5User', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, groupId, Leverage, PassMain } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userData = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        });if(!userData) throw CustomErrorHandler.notFound("Not found or Deleted!");

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
        if(checkGroup.status != "ACTIVE") throw CustomErrorHandler.wrongCredentials("Group is InActive!")
        if(checkGroup.type != "DEMO") throw CustomErrorHandler.wrongCredentials("Real accout not allowed!")
        if(checkGroup.leverage < Leverage) throw CustomErrorHandler.wrongCredentials("Group Laverage Limit exceeds!")
        
        const group = checkGroup.mt5GroupData.mt5GroupName;
        
        let login = 0;
        if(checkGroup.type == "REAL"){
            const mt5Account = await Mt5Model.findOne({
                where: { 
                    accountType: "REAL",
                    [Op.and]: [
                        where(fn("LENGTH", col("Login")), { [Op.gte]: Number(config.REAL_SERIES) }) // ✅ inside where
                    ],
                },
                order: [["createdAt", "DESC"]],
            }); login = Number(mt5Account.Login)+1;
        } else {
            const mt5Account = await Mt5Model.findOne({
                where: { 
                    accountType: "DEMO",
                    [Op.and]: [
                        where(fn("LENGTH", col("Login")), { [Op.gte]: Number(config.DEMO_SERIES) }) // ✅ inside where
                    ], 
                },
                order: [["createdAt", "DESC"]],
            }); login = Number(mt5Account.Login)+1;
        }

        const metaUserData = {
            login: parseInt(login),
            name: userData.name,
            group,
            Leverage: parseInt(Leverage),
            PassMain,
            PassInvestor,
            Email: userData.email,
            Phone: userData.mobile? userData.mobile : "",
            Country: userData.country? userData.country : "",
            City: "",
            State: "",
            ZipCode: "",
            Address: "",
            PhonePassword: "",
        };
        console.log("Create mt5 Account Payload:", metaUserData)
        let newUserData = await MetaControllers.addUser(metaUserData);
        
        // Fallback to auto-allocate if custom login creation fails
        if (!newUserData || newUserData._mt5Error) {
            console.log("[MT5] Custom login creation failed. Retrying with auto-allocate (Login: 0)...");
            metaUserData.login = 0;
            const result = await MetaControllers.addUser(metaUserData);
            if (result && !result._mt5Error) {
                newUserData = result;
            } else {
                newUserData = null;
            }
        }
        if(!newUserData) throw CustomErrorHandler.serverError("Failed to Create MT5 User!");
        
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
            City: newUserData.answer.City  || "",
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

        marketingLogger.info('Exiting addMT5User: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 User added.",
            data: newAccount,
        });
    } catch (e) {
        marketingLogger.error('Error in addMT5User', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.mt5UserList = async (request, response) => {
    try {
        marketingLogger.info('Entering mt5UserList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search , userId, type } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if(userId){
            const checkUser = await UserModel.findOne({
                where: { id: userId, isDeleted: false, assingToManager: adminData.id, }
            });if (!checkUser) throw CustomErrorHandler.unAuthorized("Access Denied!");
        }; if(!userId) throw CustomErrorHandler.wrongCredentials("userId required!");
        
        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        // Search condition
        const searchCondition = search
            ? {
                  [Op.or]: [
                      { Login: { [Op.iLike]: `%${search}%` } },
                      { Group: { [Op.iLike]: `%${search}%` } },
                      { MQID: { [Op.iLike]: `%${search}%` } },
                      { Name: { [Op.iLike]: `%${search}%` } },
                      { Country: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        const whereCondition = {
            ...searchCondition,
        };
        whereCondition.userId = userId;
        if(type) whereCondition.accountType = type;

        const { count, rows: usersList } = await Mt5Model.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"] // Adjust fields as needed
                },
                {
                    model: GroupModel,
                    as: "group",
                    attributes: ["name"] // Adjust based on your Groups table fields
                }
            ],
            offset,
        });

        marketingLogger.info('Exiting mt5UserList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in mt5UserList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.mt5UserById = async (request, response) => {
    try {
        marketingLogger.info('Entering mt5UserById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
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

        marketingLogger.info('Exiting mt5UserById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Mt5 User Details.",
            data: userData,
        });
    } catch (e) {
        marketingLogger.error('Error in mt5UserById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addBank = async (request, response) => {
    try {
        marketingLogger.info('Entering addBank', { method: request.method || "", route: request.originalUrl || "" });
        const { userId, holderName, accountNo, ifscCode, ibanNo, bankName, bankAddress, country } = request.query;
        const { user } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, role: "USER", isDeleted: false }
        }); if(!checkUser) throw CustomErrorHandler.notFound("User Not found or Deleted!");

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
            image: request.files["image"][0].filename
        });
        
        marketingLogger.info('Exiting addBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Bank added.",
            data: newBank,
        });
    } catch (e) {
        marketingLogger.error('Error in addBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankList = async (request, response) => {
    try {
        marketingLogger.info('Entering bankList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, status, userId } = request.query;
        const { user } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        // Search condition
        const searchCondition = search
            ? {
                  [Op.or]: [
                      { userId: { [Op.iLike]: `%${search}%` } },
                      { holderName: { [Op.iLike]: `%${search}%` } },
                      { bankName: { [Op.iLike]: `%${search}%` } },
                      { accountNo: { [Op.iLike]: `%${search}%` } },
                      { ibanNo: { [Op.iLike]: `%${search}%` } },
                      { ifscCode: { [Op.iLike]: `%${search}%` } },
                      { bankAddress: { [Op.iLike]: `%${search}%` } },
                      { country: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        const whereCondition = { ...searchCondition };
        if(userId) whereCondition.userId = userId;

        const { count, rows } = await BankModel.findAndCountAll({
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

        marketingLogger.info('Exiting bankList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in bankList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankById = async (request, response) => {
    try {
        marketingLogger.info('Entering bankById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
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

        const host = `${request.protocol}://${request.get("host")}`;
        bank.image = `${host}/public/bankDetails/${bank.image}`;
                   
        marketingLogger.info('Exiting bankById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details.",
            data: bank,  
        });
    } catch (e) {
        marketingLogger.error('Error in bankById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.approveBank = async (request, response) => {
    try {
        marketingLogger.info('Entering approveBank', { method: request.method || "", route: request.originalUrl || "" });
        const { user, bankId, status} = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        });if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");
    
        const checkBank = await BankModel.findOne({
            where: { id: bankId, isDeleted: false },
        });if (!checkBank) throw CustomErrorHandler.notFound("Bank Details not found!");

        const checkUser = await UserModel.findByPk(checkBank.userId);
        if(!checkUser) throw CustomErrorHandler.notFound("User Not found!");

        const updateData = {
            status,
            // approvedBy: adminData.id,
        };

        await checkBank.update(updateData);

        checkUser.isBankVerified = status === "APPROVED";
        await checkUser.save();
    
        marketingLogger.info('Exiting approveBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Bank ${status.toLowerCase()} successfully.`,
            data: checkBank,
        });
    } catch (e) {
        marketingLogger.error('Error in approveBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
      handleErrorResponse(e, response);
    }
};

module.exports.uploadDocument = async (request, response) => {
    try {
        marketingLogger.info('Entering uploadDocument', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { userId } = request.query;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");
        const poi = request.files.poi ? request.files.poi[0].filename : null;
        const poa = request.files.poa ? request.files.poa[0].filename : null;

        const checkKycDoc = await DocumentModel.findOne({
            where: { userId: userId, isDeleted: false },
        }); 
        if(checkKycDoc && checkKycDoc.status === "PENDING"){
            throw CustomErrorHandler.alreadyExist("Wait for admin approval!")
        } 
        if(checkKycDoc && checkKycDoc.status === "APPROVED"){
            throw CustomErrorHandler.alreadyExist("Kyc Verified!")
        };
        // return
        let document;
        if (checkKycDoc && checkKycDoc.status === "REJECTED") {
            const updateData = {};
            if (poi && (checkKycDoc.poi === null || poi)) updateData.poi = poi;
            if (poa && (checkKycDoc.poa === null || poa)) updateData.poa = poa;
            if (Object.keys(updateData).length > 0) {
                updateData.status = "APPROVED";
                updateData.approvedBy = user.id;
                document = await checkKycDoc.update(updateData);
            } else {
                throw new Error("No new documents provided for update.");
            }
        } else {
            // Create new record
            document = await DocumentModel.create({
                userId: userId,
                poi,
                poa,
                status: "APPROVED",
                // approvedBy: user.id,
            });
        }

        marketingLogger.info('Exiting uploadDocument: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Document Uploaded.",
            data: document,
        });
    } catch (e) {
        marketingLogger.error('Error in uploadDocument', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.documentList = async (request, response) => {
    try {
        marketingLogger.info('Entering documentList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, userId } = request.query;
        const { user } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        });if (!adminData) throw new Error("Access Denied! Admin access required.");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        const searchCondition = search
            ? {
                userId: { [Op.eq]: parseInt(search, 10) }, // Assuming userId is a number
            }
            : {};
    
        const whereCondition = { ...searchCondition, isDeleted: false };
        if(userId) whereCondition.userId = userId;
    
        const { count, rows } = await DocumentModel.findAndCountAll({
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
            offset,
        });
    
        const host = `${request.protocol}://${request.get("host")}`;
    
        const documentsList = rows.map((doc) => {
            return {
                ...doc.toJSON(),
                poi: doc.poi ? `${host}/documents/${doc.poi}` : null,
                poa: doc.poa ? `${host}/documents/${doc.poa}` : null,
            };
        });
    
        marketingLogger.info('Exiting documentList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in documentList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
      handleErrorResponse(e, response);
    }
};

module.exports.approveKyc = async (request, response) => {
    try {
        marketingLogger.info('Entering approveKyc', { method: request.method || "", route: request.originalUrl || "" });
        const { user, documentId, status, poi, poa } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        });if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const document = await DocumentModel.findOne({
            where: { id: documentId, isDeleted: false },
        });if (!document) throw CustomErrorHandler.notFound("Document not found!");

        const checkUser = await UserModel.findByPk(document.userId);
        if(!checkUser) throw CustomErrorHandler.notFound("User Not found!");

        const updateData = {
            status,
            // approvedBy: adminData.id,
        };

        if (status === "REJECTED") {
            if (poi == 1) updateData.poi = null;
            if (poa == 1) updateData.poa = null;
        }

        await document.update(updateData);

        checkUser.isKycVerified = status === "APPROVED";
        await checkUser.save();
    
        marketingLogger.info('Exiting approveKyc: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Document ${status.toLowerCase()} successfully.`,
            data: document,
        });
    } catch (e) {
        marketingLogger.error('Error in approveKyc', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
      handleErrorResponse(e, response);
    }
};

module.exports.passwordList = async (request, response) => {
    try {
        marketingLogger.info('Entering passwordList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, userId } = request.query;
        const { user } = request.body;
        
        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        if(!userId) throw CustomErrorHandler.wrongCredentials("UserId not Found!");

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");
        
        const checkUser = await UserModel.findOne({
            where: { id: userId, role: "USER", isDeleted: false, assingToManager: adminData.id }
        }); if(!checkUser) throw CustomErrorHandler.notFound("Access Denied, User not assinged to you!");

        const { count, rows } = await PasswordModel.findAndCountAll({
            where: { isDeleted: false, userId: userId },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: [ 'id', 'name', 'email', 'mobile', 'userName'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        const passwordList = rows.map((row) => {
            const plainRow = row.toJSON();
            const filteredPasswordList = (plainRow.passwordList || []).filter(
                item => item.passwordType == "MT5-INVESTOR"
            );
            return {
                ...plainRow,
                passwordList: filteredPasswordList
            };
        });
        
        marketingLogger.info('Exiting passwordList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                passwordList,
            },
        });
    } catch (e) {
        marketingLogger.error('Error in passwordList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.changePassword = async (request, response) => {
    try {
        marketingLogger.info('Entering changePassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, newPassword } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkUser = await UserModel.findByPk(userId);
        if (!checkUser) throw CustomErrorHandler.notFound("Not found!");

        const passwordData = await PasswordModel.findOne({ where: { userId } });
        if(!passwordData) throw CustomErrorHandler.notFound("Password Record Not Found!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(newPassword, passwordSalt);

        checkUser.password = passwordHash;
        await checkUser.save();

        const passwordList = [...passwordData.passwordList];

        passwordList[0] = { passwordType: "LOGIN", password: newPassword };
        passwordData.passwordList = passwordList;
        await passwordData.save();
       
        marketingLogger.info('Exiting changePassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password Changed.",
            data: "",
        });
    } catch (e) {
        marketingLogger.error('Error in changePassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

function findIndexByLoginAndType(passwordList, mt5Login, passwordType) {
    return passwordList.findIndex(
      item => item.mt5Login === mt5Login && item.passwordType === passwordType
    );
}

module.exports.updateMt5 = async (request, response) => {
    try {
        marketingLogger.info('Entering updateMt5', { method: request.method || "", route: request.originalUrl || "" });
        const { user, mt5Login, PassMain, PassInvestor, Leverage, group } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const mt5Data = await Mt5Model.findOne({
            where: { Login: mt5Login }
        }); if(!mt5Data) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        if(group){
            const checkGroup = await Mt5GroupModel.findOne({
                where: { mt5GroupName: group }
            }); if(!checkGroup) throw CustomErrorHandler.notFound("Group Name Not Exists!");
        };

        const metaUserData = {
            login: parseInt(mt5Login),
            PassMain,
            PassInvestor,
            Leverage,
            group
        };
        const updatedData = await MetaControllers.updateUser(metaUserData);
        if(!updatedData) throw CustomErrorHandler.serverError("Failed to Update MT5 User!");

        if(Leverage){
            mt5Data.Leverage = Leverage;
        }

        const passwordData = await PasswordModel.findOne({
            where: { userId: mt5Data.userId }
        });
        const passwordList = [...passwordData.passwordList];

        if (PassMain) {
            const index = findIndexByLoginAndType(passwordList, mt5Login, "MT5-MAIN");
            passwordList[index] = { passwordType: "MT5-MAIN", password: PassMain, mt5Login };
        }

        if (PassInvestor) {
            const index = findIndexByLoginAndType(passwordList, mt5Login, "MT5-INVESTOR");
            passwordList[index] = { passwordType: "MT5-INVESTOR", password: PassInvestor, mt5Login };
        }
        passwordData.passwordList = passwordList;
        await passwordData.save();

        if(group){
            mt5Data.Group = group;
        };

        await mt5Data.save();

        marketingLogger.info('Exiting updateMt5: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Updated MT5 Account.",
            data: updatedData,
        });
    } catch (e) {
        marketingLogger.error('Error in updateMt5', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userDetails = async (request, response) => {
    try {
        marketingLogger.info('Entering userDetails', { method: request.method || "", route: request.originalUrl || "" });
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

        marketingLogger.info('Exiting userDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Data retrieved successfully.",
            data: userData,
        });
    } catch (e) {
        marketingLogger.error('Error in userDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateUserProfile = async (request, response) => {
    try {
        marketingLogger.info('Entering updateUserProfile', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, tradingMt5AcNo, compoundingMT5AcNo, country, walletAddress } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        })
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        const isExist = await UserModel.findOne({
            where: {
                [Op.or]: [
                    email ? { email } : null,
                    mobile ? { mobile } : null
                ].filter(Boolean),
                id: { [Op.ne]: user.id } // Ensure it's not the current user's data
            }
        });
        if(isExist) throw CustomErrorHandler.alreadyExist(mobile? "Mobile Already Exists!": "Email Already Exists!");

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

        marketingLogger.info('Exiting updateUserProfile: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Update successfully.",
            data: updatedUser,
        });
    } catch (e) {
        marketingLogger.error('Error in updateUserProfile', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Updating user details", e);
        handleErrorResponse(e, response);
    }
};

module.exports.createTransactionPassword = async (request, response) => {
    try {
        marketingLogger.info('Entering createTransactionPassword', { method: request.method || "", route: request.originalUrl || "" });
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

        marketingLogger.info('Exiting createTransactionPassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Password Created.",
            data: userData,
        });
    } catch (e) {
        marketingLogger.error('Error in createTransactionPassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Create Transaction password", e);
        handleErrorResponse(e, response);
    }
};

// use for future requirement
module.exports.changeTransactionPassword = async (request, response) => {
    try {
        marketingLogger.info('Entering changeTransactionPassword', { method: request.method || "", route: request.originalUrl || "" });
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

        marketingLogger.info('Exiting changeTransactionPassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Transaction Password Changed.",
            data: null,
        });
    } catch (e) {
        marketingLogger.error('Error in changeTransactionPassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while Changing Transaction password", e);
        handleErrorResponse(e, response);
    }
};

module.exports.addBankDetails = async (request, response) => {
    try {
        marketingLogger.info('Entering addBankDetails', { method: request.method || "", route: request.originalUrl || "" });
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

        marketingLogger.info('Exiting addBankDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details Added.",
            data: userData,
        });
    } catch (e) {
        marketingLogger.error('Error in addBankDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error while adding bank account", e);
        handleErrorResponse(e, response);
    }
};

module.exports.getBankDetails = async (request, response) => {
    try {
        marketingLogger.info('Entering getBankDetails', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        // Validate user existence
        const userData = await MarketingMemberModel.findByPk(user.id);
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Access Denied!");
        }

        const fetchBank = await BankModel.findOne({
            where: { userId: user.id }
        });
        if(!fetchBank) throw CustomErrorHandler.notFound("Bank account not found!")

        marketingLogger.info('Exiting getBankDetails: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Bank Details.",
            data: fetchBank
        });
    } catch (e) {
        marketingLogger.error('Error in getBankDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// User referral array list
module.exports.referralList = async (request, response) => {
    try {
        marketingLogger.info('Entering referralList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { userId } = request.query;

        const userData = await MarketingMemberModel.findByPk(user.id);
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        const checkUser = await UserModel.findOne({
            where: { id: userId, assingToManager: userData.id,}
        }); if(!checkUser) throw CustomErrorHandler.wrongCredentials("User not Found!");

        const userList = [];
        await buildReferralTree(userId, 1, userList);

        marketingLogger.info('Exiting referralList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Referral List.",
            data: userList
        });
    } catch (e) {
        marketingLogger.error('Error in referralList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

const buildReferralTree = async (userId, level = 1, userList = []) => {
    const user = await UserModel.findByPk(userId);
    console.log(user)
    if (!user) {
      return userList;
    }
    
    if (level > 1) {
      userList.push({
        name: user.name,
        userName: user.userName,
        email: user.email,
        // rank: user.rank,
        // positionSide: user.positionSide,
        date: user.createdAt,
        level: level - 1 // Adjust the level to exclude level 1 users
      });
    }
    
    const referrals = await UserModel.findAll({ 
        where: {fromUser: userId }
    });
    
    for (const referral of referrals) {
      await buildReferralTree(referral.id, level + 1, userList);
    }
    
    return userList;
};

// Get Transaction list
module.exports.transactionList = async (request, response) => {
    try {
        marketingLogger.info('Entering transactionList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, status, transactionType, userId } = request.query;
        const { user } = request.body;

        const userData = await MarketingMemberModel.findByPk(user.id);
        if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, assingToManager: userData.id,}
        }); if(!checkUser) throw CustomErrorHandler.wrongCredentials("User not Found!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        // Build filter condition
        const whereCondition = { userId: user.id };
        if (status) whereCondition.status = status;
        if (transactionType) whereCondition.transactionType = transactionType;
        if(userId) whereCondition.userId = userId;

        const { count, rows: transactionList } = await TransactionModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
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
                transactionList,
            },
        });
    } catch (e) {
        marketingLogger.error('Error in transactionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankDeposit = async (request, response) => {
    try {
        marketingLogger.info('Entering bankDeposit', { method: request.method || "", route: request.originalUrl || "" });
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

        marketingLogger.info('Exiting bankDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Deposit Success, Wait for Approvel.",
            data: newDeposit
        });
    } catch (e) {
        marketingLogger.error('Error in bankDeposit', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.bankDepositList = async (request, response) => {
    try {
        marketingLogger.info('Entering bankDepositList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, userId } = request.query;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if(adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        // Pagination options
        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const whereCondition = { isDeleted: false };
        if(userId) whereCondition.userId = userId;

        // Fetch deposit history
        const { count, rows: depositHistory } = await FiatDepositModel.findAndCountAll({
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

        // Map deposits to include image URL
        const depositHistoryWithImage = depositHistory.map(deposit => ({
            ...deposit.toJSON(),
            image: deposit.image ? `${request.protocol}://${request.get('host')}/public/bankDeposit/${deposit.image}` : null,
        }));

        marketingLogger.info('Exiting bankDepositList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in bankDepositList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.actionTrackingList = async (request, response) => {
    try {
        marketingLogger.info('Entering actionTrackingList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, userId } = request.query;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if(adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        // Pagination options
        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const whereCondition = { isDeleted: false };
        if(userId) whereCondition.userId = userId;

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


        marketingLogger.info('Exiting actionTrackingList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in actionTrackingList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userAssignTo = async (request, response) => {
    try {
        marketingLogger.info('Entering userAssignTo', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingMemberId, userId } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkMarketingMember = await MarketingMemberModel.findOne({
            where: { id: marketingMemberId, isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        const checkUser = await UserModel.findByPk(userId);
        if (!checkUser) throw CustomErrorHandler.notFound("User Not Found!");

        checkUser.assingToManager = checkMarketingMember.id;
        await checkUser.save();

        marketingLogger.info('Exiting userAssignTo: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `User assing to ${checkMarketingMember.name}.`,
            data: checkUser,
        });
    } catch (e) {
        marketingLogger.error('Error in userAssignTo', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

const ibReferralList = async (userId, level = 1, userList = []) => {
    const user = await UserModel.findByPk(userId);

    if (!user) {
        return userList;
    }
    
    if (level > 1) {
        userList.push(user.id);
    }
    
    const referrals = await UserModel.findAll({ 
        where: { fromUser: userId }
    });
    
    for (const referral of referrals) {
        await ibReferralList(referral.id, level + 1, userList);
    }
    
    return userList;
};

module.exports.ibAssignTo = async (request, response) => {
    try {
        marketingLogger.info('Entering ibAssignTo', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingMemberId, ibId } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkMarketingMember = await MarketingMemberModel.findOne({
            where: { id: marketingMemberId, isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        const userList = [];
        await ibReferralList(ibId, 1, userList);
        if(userList.length == 0) throw CustomErrorHandler.notFound("Referral List not found!");

        for(const userId of userList){
            const checkUser = await UserModel.findByPk(userId);
            if (!checkUser) throw CustomErrorHandler.notFound("User Not Found!");
    
            checkUser.assingToManager = checkMarketingMember.id;
            await checkUser.save();
        }

        marketingLogger.info('Exiting ibAssignTo: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Ib Assigned to ${checkMarketingMember.name}.`,
            data: "",
        });
    } catch (e) {
        marketingLogger.error('Error in ibAssignTo', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
