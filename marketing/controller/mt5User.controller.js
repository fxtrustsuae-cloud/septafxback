const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const GroupModel = require("../../models/group.model");
const Mt5Model = require("../../models/mt5Account.model");
const Mt5GroupModel = require("../../models/mt5Group.model");
const PasswordModel = require("../../models/password.model");
const TransactionModel = require("../../models/transaction.model");
const MetaControllers = require("../../mt5Services/user");
const { actionTracking } = require("../../helpers/index");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.importMt5toUser = async (request, response) => {
    try {
        marketingLogger.info('Entering importMt5toUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, groupId, login, PassMain, PassInvestor } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if(!adminData) throw CustomErrorHandler.notFound("Access Denied!");

        // Checking userData;
        const userData = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        }); if(!adminData) throw CustomErrorHandler.notFound("User Not Found!");

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
        });
        if (!checkGroup) throw CustomErrorHandler.notFound("Group not found!");
        if(checkGroup.status != "ACTIVE") throw CustomErrorHandler.notAllowed("Group InActive!");
        
        const newUserData = await MetaControllers.getUser(login);
        if(!newUserData) throw CustomErrorHandler.serverError("Failed to Import MT5 User!");
        
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
        }

        await Mt5Model.create({
            userId: userData.id,
            Login: newUserData.answer.Login,
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

        actionTracking(request, userData.id, "IMPORTED-META-ACCOUNT", `Login: ${newUserData.answer.Login}`);

        marketingLogger.info('Exiting importMt5toUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 User added.",
            data: newUserData.answer,
        });
    } catch (e) {
        marketingLogger.error('Error in importMt5toUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addUser = async (request, response) => {
    try {
        marketingLogger.info('Entering addUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, login=0, name, group, Leverage, PassMain, PassInvestor, Email, Phone, Country, City,
            State, ZipCode, Address, PhonePassword } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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

        marketingLogger.info('Exiting addUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User added.",
            data: newUserData.answer,
        });
    } catch (e) {
        marketingLogger.error('Error in addUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateUser = async (request, response) => {
    try {
        marketingLogger.info('Entering updateUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, name, group, Leverage, PassMain, PassInvestor, Email, Phone, Country, City,
            State, ZipCode, Address, PhonePassword } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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

        marketingLogger.info('Exiting updateUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Update.",
            data: updatedData,
        });
    } catch (e) {
        marketingLogger.error('Error in updateUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.deleteUser = async (request, response) => {
    try {
        marketingLogger.info('Entering deleteUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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

        marketingLogger.info('Exiting deleteUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `User Deleted with login ${login}`,
            data: "",
        });
    } catch (e) {
        marketingLogger.error('Error in deleteUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getUser = async (request, response) => {
    try {
        marketingLogger.info('Entering getUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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

        marketingLogger.info('Exiting getUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta User Data.",
            data: mtUserData,
        });
    } catch (e) {
        marketingLogger.error('Error in getUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.changePassword = async (request, response) => {
    try {
        marketingLogger.info('Entering changePassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, type, newPassword } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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

        marketingLogger.info('Exiting changePassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password Changed.",
            data: mtUserData,
        });
    } catch (e) {
        marketingLogger.error('Error in changePassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.tradeStatus = async (request, response) => {
    try {
        marketingLogger.info('Entering tradeStatus', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const tradeStatus = await MetaControllers.getTradeStatus(login);
        if(!tradeStatus) throw CustomErrorHandler.serverError(`Failed to Fetch Trade Status!`);

        marketingLogger.info('Exiting tradeStatus: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: tradeStatus,
        });
    } catch (e) {
        marketingLogger.error('Error in tradeStatus', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.checkBalance = async (request, response) => {
    try {
        marketingLogger.info('Entering checkBalance', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, flag } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        });if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const tradeStatus = await MetaControllers.checkUserBalance(login, flag);
        if(!tradeStatus) throw CustomErrorHandler.serverError(`Failed to Fetch Trade Status!`);

        marketingLogger.info('Exiting checkBalance: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: tradeStatus,
        });
    } catch (e) {
        marketingLogger.error('Error in checkBalance', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.metaDeposit = async (request, response) => {
    try {
        marketingLogger.info('Entering metaDeposit', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, amount } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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
        
        marketingLogger.info('Exiting metaDeposit: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta Account Deposited.",
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
        const { user, login, amount } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
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

        marketingLogger.info('Exiting metaWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Meta Account Withdrawal.",
            data: newTransaction,
        });
    } catch (e) {
        marketingLogger.error('Error in metaWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};