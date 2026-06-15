const { Op, fn, col, where } = require("sequelize");
const config = require("../../config/config");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const GroupModel = require("../../models/group.model");
const Mt5Model = require("../../models/mt5Account.model");
const Mt5GroupModel = require("../../models/mt5Group.model");
const PasswordModel = require("../../models/password.model");
const TransactionModel = require("../../models/transaction.model");
const RequestMt5Model = require("../../models/requestedMt5Accounts.model");
const MetaControllers = require("../../mt5Services/user");
const MailSender = require("../../utils/mail");
const { actionTracking, generatePassword } = require("../../helpers/index");
const { createMt5AccountFromGroup } = require("../../helpers/mt5AccountCreation");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.moveMt5User = async (request, response) => {
    try {
        adminLogger.info('Entering moveMt5User', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, login } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if(!adminData) throw CustomErrorHandler.notFound("Access Denied!");

        // Checking userData;
        const userData = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!adminData) throw CustomErrorHandler.notFound("User Not Found!");

        const checkMt5Account = await Mt5Model.findOne({
            where: { Login: login }
        }); if(!checkMt5Account) throw CustomErrorHandler.notFound("Mt5 Account not found!"); 

        const newUserData = await MetaControllers.getUser(login);
        if(!newUserData) throw CustomErrorHandler.serverError("Failed to Import MT5 User!");

        const checkPassword = await PasswordModel.findOne({
            where: { userId: checkMt5Account.userId }
        }); if(!checkPassword) CustomErrorHandler.wrongCredentials("Failed to fetch password!");

        const passwordList = [...checkPassword.passwordList];
        const mainIndex = findIndexByLoginAndType(passwordList, login, "MT5-MAIN");
        const investorIndex = findIndexByLoginAndType(passwordList, login, "MT5-INVESTOR");

        // passwordList[index] = passwordList[passwordList.length -1];
        // passwordList.pop();
        // checkPassword.passwordList = passwordList;
        // await checkPassword.save();  

        let passwordEntry = await PasswordModel.findOne({ where: { userId: userData.id } });
        const updatedList = [...passwordEntry.passwordList];
        updatedList.push(
            { passwordType: "MT5-MAIN", password: passwordList[mainIndex].password, mt5Login: login },
            { passwordType: "MT5-INVESTOR", password: passwordList[investorIndex].password, mt5Login: login }
        );
        passwordEntry.passwordList = updatedList;
        await passwordEntry.save();

        checkMt5Account.userId = userData.id;
        await checkMt5Account.save()
        
        actionTracking(request, userData.id, "MT5-USER-CHANGED", `Login: ${newUserData.answer.Login}`);

        adminLogger.info('Exiting moveMt5User: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 Account user changed.",
            data: newUserData.answer,
        });
    } catch (e) {
        adminLogger.error('Error in moveMt5User', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.importMt5toUser = async (request, response) => {
    try {
        adminLogger.info('Entering importMt5toUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, login, groupId, PassMain, PassInvestor } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if(!adminData) throw CustomErrorHandler.notFound("Access Denied!");

        // Checking userData;
        const userData = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!adminData) throw CustomErrorHandler.notFound("User Not Found!");

        const checkMt5Account = await Mt5Model.findOne({
            where: { Login: login }
        }); if(checkMt5Account) throw CustomErrorHandler.notFound("Login Already Exists!");

        const checkGroup = await GroupModel.findByPk(groupId);
        if(!checkGroup) throw CustomErrorHandler.notFound("Group Not Found!");

        const newUserData = await MetaControllers.getUser(login);
        if(!newUserData) throw CustomErrorHandler.serverError("Failed to Fetch MT5 User!");

        const checkPassword = await PasswordModel.findOne({
            where: { userId: userData.id }
        }); if(!checkPassword) CustomErrorHandler.wrongCredentials("Failed to fetch password!");

        let passwordEntry = await PasswordModel.findOne({ where: { userId: userData.id } });
        const updatedList = [...passwordEntry.passwordList];
        updatedList.push(
            { passwordType: "MT5-MAIN", password: PassMain, mt5Login: login },
            { passwordType: "MT5-INVESTOR", password: PassInvestor, mt5Login: login }
        );
        passwordEntry.passwordList = updatedList;
        await passwordEntry.save();

        await Mt5Model.create({
            userId: userData.id,
            Login: newUserData.answer.Login,
            groupId: checkGroup.id,
            accountType: checkGroup.type,
            CertSerialNumber: newUserData.answer.CertSerialNumber || "0",
            Rights: newUserData.answer.Rights || "",
            MQID: newUserData.answer.MQID || "0",
            createdAt: new Date(Number(newUserData.answer.Registration) * 1000).toISOString(),
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

        actionTracking(request, userData.id, "MT5-USER-IMPORTED", `Login: ${newUserData.answer.Login}`);

        adminLogger.info('Exiting importMt5toUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 User Imported.",
            data: newUserData.answer,
        });
    } catch (e) {
        adminLogger.error('Error in importMt5toUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addUser = async (request, response) => {
    try {
        adminLogger.info('Entering addUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, login=0, name, group, Leverage, PassMain, PassInvestor, Email, Phone, Country, City,
            State, ZipCode, Address, PhonePassword } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        });if(!checkUser) throw CustomErrorHandler.notFound("Not found or Deleted!");

        const metaUserData = {
            login: parseInt(login),
            name,
            group,
            Leverage: parseInt(Leverage),
            PassMain,
            PassInvestor,
            Email: Email,
            Phone: Phone,
            Country: Country,
            City: City || "",
            State: State || "",
            ZipCode: ZipCode || "",
            Address: Address || "",
            PhonePassword: PhonePassword || "",
        };

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
        if(!newUserData) throw CustomErrorHandler.serverError("Failed to Create New User!");
        
        await Mt5Model.create({
            userId: userId,
            Login: newUserData.answer.Login || login.toString(),
            Group: newUserData.answer.Group || group,
            CertSerialNumber: newUserData.answer.CertSerialNumber || "0",
            Rights: newUserData.answer.Rights || "",
            MQID: newUserData.answer.MQID || "0",
            Registration: newUserData.answer.Registration || "",
            LastAccess: newUserData.answer.LastAccess || "",
            LastPassChange: newUserData.answer.LastPassChange || "",
            LastIP: newUserData.answer.LastIP || "",
            Name: newUserData.answer.Name || name || "",
            FirstName: newUserData.answer.FirstName || "",
            LastName: newUserData.answer.LastName || "",
            MiddleName: newUserData.answer.MiddleName || "",
            Company: newUserData.answer.Company || "",
            Account: newUserData.answer.Account || "",
            Country: newUserData.answer.Country || Country || "",
            Language: newUserData.answer.Language || "0",
            ClientID: newUserData.answer.ClientID || "0",
            City: newUserData.answer.City || City || "",
            State: newUserData.answer.State || State || "",
            ZipCode: newUserData.answer.ZipCode || ZipCode || "",
            Address: newUserData.answer.Address || Address || "",
            Phone: newUserData.answer.Phone || Phone || "",
            Email: newUserData.answer.Email || Email || "",
            ID: newUserData.answer.ID || "",
            Status: newUserData.answer.Status || "",
            Comment: newUserData.answer.Comment || "",
            Color: newUserData.answer.Color || "",
            PhonePassword: newUserData.answer.PhonePassword || PhonePassword || "",
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

        adminLogger.info('Exiting addUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User added.",
            data: newUserData.answer,
        });
    } catch (e) {
        adminLogger.error('Error in addUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateUser = async (request, response) => {
    try {
        adminLogger.info('Entering updateUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, name, group, Leverage, PassMain, PassInvestor, Email, Phone, Country, City,
            State, ZipCode, Address, PhonePassword } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("MT5 Account Not found!");

        const metaUserData = {
            login: parseInt(login),
            name,
            group,
            Leverage: parseInt(Leverage),
            PassMain,
            PassInvestor,
            Email,
            Phone,
            Country,
            City,
            State,
            ZipCode,
            Address,
            PhonePassword,
        };

        const updatedData = await MetaControllers.updateUser(metaUserData);
        if(!updatedData) throw CustomErrorHandler.serverError("Failed to Update User!");

        await Mt5Model.update({
            Group: updatedData.answer.Group || group,
            Name: updatedData.answer.Name || name || "",
            Country: updatedData.answer.Country || Country || "",
            City: updatedData.answer.City || City || "",
            State: updatedData.answer.State || State || "",
            ZipCode: updatedData.answer.ZipCode || ZipCode || "",
            Address: updatedData.answer.Address || Address || "",
            Phone: updatedData.answer.Phone || Phone || "",
            Email: updatedData.answer.Email || Email || "",
            PhonePassword: updatedData.answer.PhonePassword || PhonePassword || "",
            Leverage: updatedData.answer.Leverage || Leverage || "",
        }, {
            where: {
                Login: login
            }
        });

        adminLogger.info('Exiting updateUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Update.",
            data: updatedData,
        });
    } catch (e) {
        adminLogger.error('Error in updateUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.deleteUser = async (request, response) => {
    try {
        adminLogger.info('Entering deleteUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const deletedUser = await MetaControllers.deleteUser(login);
        if(!deletedUser) throw CustomErrorHandler.serverError("Failed to Delete User!");

        metaUser.isDeleted = true;
        await metaUser.save();

        adminLogger.info('Exiting deleteUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `User Deleted with login ${login}`,
            data: "",
        });
    } catch (e) {
        adminLogger.error('Error in deleteUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getUser = async (request, response) => {
    try {
        adminLogger.info('Entering getUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const mtUserData = await MetaControllers.getUser(login);
        if(!mtUserData) throw CustomErrorHandler.serverError("Failed to Fetch User data!");

        metaUser.isDeleted = true;
        await metaUser.save();

        adminLogger.info('Exiting getUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta User Data.",
            data: mtUserData,
        });
    } catch (e) {
        adminLogger.error('Error in getUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.changePassword = async (request, response) => {
    try {
        adminLogger.info('Entering changePassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, type, newPassword } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const mtUserData = await MetaControllers.changePassword(login, type, newPassword);
        if(!mtUserData) throw CustomErrorHandler.serverError(`Failed to change ${type} Password!`);

        adminLogger.info('Exiting changePassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password Changed.",
            data: mtUserData,
        });
    } catch (e) {
        adminLogger.error('Error in changePassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.tradeStatus = async (request, response) => {
    try {
        adminLogger.info('Entering tradeStatus', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const tradeStatus = await MetaControllers.getTradeStatus(login);
        if(!tradeStatus) throw CustomErrorHandler.serverError(`Failed to Fetch Trade Status!`);

        adminLogger.info('Exiting tradeStatus: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: tradeStatus,
        });
    } catch (e) {
        adminLogger.error('Error in tradeStatus', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.checkBalance = async (request, response) => {
    try {
        adminLogger.info('Entering checkBalance', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, flag } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const tradeStatus = await MetaControllers.checkUserBalance(login, flag);
        if(!tradeStatus) throw CustomErrorHandler.serverError(`Failed to Fetch Trade Status!`);

        adminLogger.info('Exiting checkBalance: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: tradeStatus,
        });
    } catch (e) {
        adminLogger.error('Error in checkBalance', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaDeposit = async (request, response) => {
    try {
        adminLogger.info('Entering metaDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, amount } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const assetData = await AssetModel.findOne({
            where: { userId: user.id, isDeleted: false }
        }); if (!assetData) throw CustomErrorHandler.serverError("Internal Server error!");
        
        if(assetData.mainBalance < amount){
            throw CustomErrorHandler.unAuthorized("Insufficient Balance!");
        };

        const newDeposit = await TradeRequestControllers.depositWithdraw(login, 2, amount, "DEPOSIT");
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Deposit Failed!`);

        const newTransaction = await TransactionModel.create({
            userId: userData.id,
            transactionType: "META-DEPOSIT",
            amount,
            level: userData.level,
            description: `Meta account deposit for login ${login}.`,
        });

        assetData.mainBalance -= amount;
        await assetData.save();
        
        adminLogger.info('Exiting metaDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta Account Deposited.",
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
        const { user, login, amount } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { 
                userId: user.id, 
                Login: login, 
                isDeleted: false 
            }
        }); 
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const assetData = await AssetModel.findOne({
            where: { userId: user.id, isDeleted: false }
        }); if (!assetData) throw CustomErrorHandler.serverError("Internal Server error!");
        
        if(assetData.mainBalance < amount){
            throw CustomErrorHandler.unAuthorized("Insufficient Balance!");
        };

        const newDeposit = await TradeRequestControllers.depositWithdraw(login, 2, -amount, "WITHDRAW");
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Withdraw Failed!`);

        const newTransaction = await TransactionModel.create({
            userId: userData.id,
            transactionType: "META-WITHDRAW",
            amount,
            level: userData.level,
            description: `Meta account Withdraw for login ${login}.`,
        });

        assetData.mainBalance += Number(amount);
        await assetData.save();

        adminLogger.info('Exiting metaWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta Account Withdrawal.",
            data: newTransaction,
        });
    } catch (e) {
        adminLogger.error('Error in metaWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.requestedMt5List = async (request, response) => {
    try {
        adminLogger.info('Entering requestedMt5List', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, userId, accountType, status, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = { };
        if (accountType) where.accountType = accountType;
        if (status) where.status = status;
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

        const { count, rows: requestedMt5List } = await RequestMt5Model.findAndCountAll({
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
                },
                {
                    model: GroupModel,
                    as: "group",
                    attributes: ["name", "leverage"] // Adjust based on your Groups table fields
                }
            ],
            offset,
        });

        adminLogger.info('Exiting requestedMt5List: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Requested Mt5 list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                requestedMt5List,
            },
        });
    } catch (e) {
        adminLogger.error('Error in requestedMt5List', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.approveRejectRequestedMt5 = async (request, response) => {
    try {
        adminLogger.info('Entering approveRejectRequestedMt5', { method: request.method || "", route: request.originalUrl || "" });
        const { user, mt5RequestedId, status } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkRequestedMt5 = await RequestMt5Model.findByPk(mt5RequestedId);
        if(!checkRequestedMt5) throw CustomErrorHandler.notFound("Requested Mt5 not found!");
        if(checkRequestedMt5.status != "PENDING") throw CustomErrorHandler.alreadyExist("Already action taken!");

        if(status == "APPROVED") {
            const userData = await UserModel.findOne({
                where: { id: checkRequestedMt5.userId, isDeleted: false }
            });if(!userData) throw CustomErrorHandler.notFound("Not found or Deleted!");
    
            const PassInvestor = generatePassword();
            const checkGroup = await GroupModel.findOne({
                where: {
                    id: checkRequestedMt5.groupId,
                },
                include: [
                    {
                        model: Mt5GroupModel,
                        as: "mt5GroupData",
                        attributes: ["mt5GroupName"],
                    },
                ],
            }); if (!checkGroup) throw CustomErrorHandler.notFound("Group not found!");
            if (checkGroup.status != "ACTIVE") throw CustomErrorHandler.notAllowed("Group InActive!");
            if(checkGroup.leverage < checkRequestedMt5.Leverage) throw CustomErrorHandler.wrongCredentials("Group Laverage Limit exceeds!")

            const { newAccount } = await createMt5AccountFromGroup({
                userData,
                groupData: checkGroup,
                leverage: checkRequestedMt5.Leverage,
                passMain: checkRequestedMt5.passMain,
                passInvestor: PassInvestor,
            });
            checkRequestedMt5.status = "APPROVED";
            checkRequestedMt5.approvedBy = adminData.id;

            MailSender.sendMt5WelcomeEmail(userData.email, userData.name, newAccount.Login, checkRequestedMt5.passMain, PassInvestor)
            
        } else {
            checkRequestedMt5.status = "REJECTED";
            checkRequestedMt5.approvedBy = adminData.id;
        }
        
        await checkRequestedMt5.save();

        adminLogger.info('Exiting approveRejectRequestedMt5: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: status == "APPROVED" ? "Approved Mt5 Request." : "Rejected Mt5 Request.",
            data: "",
        });
    } catch (e) {
        adminLogger.error('Error in approveRejectRequestedMt5', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
