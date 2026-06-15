const config = require("../../config/config");
const { Op, fn, col, where } = require("sequelize");
const MailController = require("../../utils/mail");
const UserModel = require("../../models/users.model");
const GroupModel = require("../../models/group.model");
const TransactionModel = require("../../models/transaction.model");
const Mt5Model = require("../../models/mt5Account.model");
const MetaControllers = require("../../mt5Services/user");
const Mt5GroupModel = require("../../models/mt5Group.model");
const SymbolModel = require("../../models/symbol.model");
const PasswordModel = require("../../models/password.model");
const RequestedMt5AccModel = require("../../models/requestedMt5Accounts.model");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { actionTracking, generatePassword } = require("../../helpers/index");
const { createMt5AccountFromGroup } = require("../../helpers/mt5AccountCreation");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");

module.exports.groupList = async (request, response) => {
    try {
        userLogger.info('Entering groupList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, type, search } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                role: "USER",
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        // Search condition
        const searchCondition = search
            ? {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = {
            status: "ACTIVE",
            isDeleted: false, // Respect soft deletes
            ...searchCondition,
        };

        if (type) whereCondition.type = type;

        const { count, rows: groupList } = await GroupModel.findAndCountAll({
            where: whereCondition,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        userLogger.info('Exiting groupList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Group list.',
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page),
                groupList,
            },
        });
    } catch (e) {
        userLogger.error('Error in groupList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function symbolListByLoginId(loginId) {
    try {
        const mt5AccountData = await MetaControllers.getUser(loginId);
        console.log(mt5AccountData);
        if (!mt5AccountData || !mt5AccountData.answer || !mt5AccountData.answer.Group) {
            console.log(`[symbolListByLoginId] MT5 account data not found or missing group for login ${loginId}`);
            return [];
        }

        const targetGroup = mt5AccountData.answer.Group;

        // Fetch all active groups to perform robust case-insensitive and slash-normalized matching
        const allGroups = await Mt5GroupModel.findAll({
            where: { isDeleted: false }
        });

        const normalizePath = (p) => {
            return (p || "")
                .toLowerCase()
                .replace(/\\+/g, "/")
                .replace(/\/+/g, "/")
                .trim()
                .replace(/\/+$/, ""); // Strip trailing slashes!
        };

        const normalizedTarget = normalizePath(targetGroup);
        const mt5GroupData = allGroups.find(g => normalizePath(g.mt5GroupName) === normalizedTarget);

        if (!mt5GroupData) {
            console.log(`[symbolListByLoginId] MT5 group data not found in DB for group: ${targetGroup}. Available groups in DB:`, allGroups.map(g => g.mt5GroupName));
            return [];
        }

        const groupPaths = mt5GroupData.path || [];
        const isWildcardAll = groupPaths.includes('*');

        const allSymbols = await SymbolModel.findAll({
            where: { isDeleted: false }
        });

        // Smart fail-safe fallback: If DB is empty, bypass check to prevent complete system outage
        if (allSymbols.length === 0) {
            console.log(`[symbolListByLoginId] CRITICAL WARNING: The Symbols table is empty! Bypassing verification check.`);
            return []; 
        }

        let symbolsData;
        if (isWildcardAll) {
            symbolsData = allSymbols;
        } else {
            symbolsData = allSymbols.filter(sym => {
                const sPath = normalizePath(sym.path);
                return groupPaths.some(gPath => {
                    const gp = normalizePath(gPath);
                    if (gp === "*") return true;
                    if (sPath === gp) return true;
                    if (sPath.startsWith(gp + "/")) return true;

                    // MT5 Symbol Path Translation / Substitution Mapping
                    if (gp === "forex") {
                        return sPath.includes("forex") || sPath.includes("cfd-fx") || sPath.includes("fx");
                    }
                    if (gp === "metals") {
                        return sPath.includes("metals") || sPath.includes("gold") || sPath.includes("silver");
                    }
                    if (gp === "crypto") {
                        return sPath.includes("crypto");
                    }
                    if (gp === "energies" || gp === "spot oil") {
                        return sPath.includes("energies") || sPath.includes("oil") || sPath.includes("gas");
                    }
                    if (gp === "indices") {
                        return sPath.includes("indices") || sPath.includes("index");
                    }
                    if (gp === "cfd-equities(usd)") {
                        return sPath.includes("cfd-equities") || sPath.includes("equities") || sPath.includes("shares") || sPath.includes("stocks");
                    }
                    if (gp === "vip") {
                        return sPath.includes("vip");
                    }

                    return false;
                });
            });
        }

        const symbolList = symbolsData.map(item => item.symbol);
        return symbolList;
    } catch (e) {
        console.log("Error while Fetching symbolList", e.message);
        return [];
    }
}

module.exports.mt5AccountById = async (request, response) => {
    try {
        userLogger.info('Entering mt5AccountById', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { id } = request.params;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const accountData = await Mt5Model.findOne({
            where: { userId: userData.id, id, isDeleted: false },
            include: [
                {
                    model: GroupModel,
                    as: "group",
                    attributes: ["name"] // Adjust based on your Groups table fields
                }
            ],
        }); if (!accountData) throw CustomErrorHandler.notFound("Not Found!");

        const symbolList = await symbolListByLoginId(accountData.Login);
        actionTracking(request, userData.id, "MT5-ACCOUNT-BY-ID");

        userLogger.info('Exiting mt5AccountById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Mt5 Account Details.',
            data: accountData,
            symbolList: symbolList ? symbolList : []
        });
    } catch (e) {
        userLogger.error('Error in mt5AccountById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.mt5AccountList = async (request, response) => {
    try {
        userLogger.info('Entering mt5AccountList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, search, type } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                role: "USER",
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        // Search condition
        const searchCondition = search
            ? {
                [Op.or]: [
                    { Login: { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = {
            isDeleted: false, // Respect soft deletes
            userId: userData.id,
            ...searchCondition,
        };

        if (type) whereCondition.accountType = type;

        const { count, rows: mt5AccountList } = await Mt5Model.findAndCountAll({
            where: whereCondition,
            order: [['createdAt', 'DESC']],
            limit,
            include: [
                {
                    model: GroupModel,
                    as: "group",
                    attributes: ["name", "leverage"] // Adjust based on your Groups table fields
                }
            ],
            offset,
        });

        actionTracking(request, userData.id, "META-ACCOUNT-LIST");

        userLogger.info('Exiting mt5AccountList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Mt5 Account list.',
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page),
                mt5AccountList,
            },
        });
    } catch (e) {
        userLogger.error('Error in mt5AccountList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addMt5Account = async (request, response) => {
    try {
        userLogger.info('Entering addMt5Account', { method: request.method || "", route: request.originalUrl || "" });
        const { user, groupId, Leverage, PassMain } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notFound("Access Denied!");

        if (!userData.isEmailVerified) {
            throw CustomErrorHandler.notAllowed("Pending Profile Complition!");
        }

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
        if (checkGroup.status != "ACTIVE") throw CustomErrorHandler.notAllowed("Group InActive!");
        if (checkGroup.leverage < Leverage) throw CustomErrorHandler.wrongCredentials("Group Laverage Limit exceeds!")
        const existingMt5AccountCount = await Mt5Model.count({
            where: {
                userId: userData.id,
                isDeleted: false,
            },
        });

        if (existingMt5AccountCount >= 1) {
            const requestedAccount = await RequestedMt5AccModel.create({
                userId: userData.id,
                accountType: checkGroup.type,
                groupId: checkGroup.id,
                groupName: checkGroup.name || checkGroup.mt5GroupData?.mt5GroupName || "",
                Leverage: String(Leverage),
                Name: userData.name || "",
                Country: userData.country || "",
                Address: userData.address || "",
                Phone: userData.mobile || "",
                Email: userData.email || "",
                passMain: PassMain,
            });

            actionTracking(request, userData.id, "REQUESTED-META-ACCOUNT", `Request ID: ${requestedAccount.id}`);

            userLogger.info('Exiting addMt5Account: MT5 request queued for admin approval', { method: request.method || "", route: request.originalUrl || "" });
            return response.json({
                status: true,
                message: "MT5 account request sent to admin for approval.",
                requiresApproval: true,
                data: requestedAccount,
            });
        }

        const PassInvestor = generatePassword();
        const { newAccount } = await createMt5AccountFromGroup({
            userData,
            groupData: checkGroup,
            leverage: Leverage,
            passMain: PassMain,
            passInvestor: PassInvestor,
        });

        MailController.sendMt5WelcomeEmail(userData.email, userData.name, newAccount.Login, PassMain, PassInvestor)

        actionTracking(request, userData.id, "CREATED-META-ACCOUNT", ``);

        userLogger.info('Exiting addMt5Account: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 User added.",
            requiresApproval: false,
            data: newAccount,
        });
    } catch (e) {
        userLogger.error('Error in addMt5Account', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.requestedMt5AccountList = async (request, response) => {
    try {
        userLogger.info('Entering requestedMt5AccountList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, search, type } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                role: "USER",
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        // Search condition
        const searchCondition = search
            ? {
                [Op.or]: [
                    { Login: { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = {
            isDeleted: false, // Respect soft deletes
            userId: userData.id,
            ...searchCondition,
        };

        if (type) whereCondition.accountType = type;

        const { count, rows: requestedMt5AccountList } = await RequestedMt5AccModel.findAndCountAll({
            where: whereCondition,
            order: [['createdAt', 'DESC']],
            limit,
            include: [
                {
                    model: GroupModel,
                    as: "group",
                    attributes: ["name", "leverage"] // Adjust based on your Groups table fields
                }
            ],
            offset,
        });

        actionTracking(request, userData.id, "REQUESTED-META-ACCOUNT-LIST");

        userLogger.info('Exiting requestedMt5AccountList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Requested Mt5 Account list.',
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page),
                requestedMt5AccountList,
            },
        });
    } catch (e) {
        userLogger.error('Error in requestedMt5AccountList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// only for demo account add balance
module.exports.demoAddBalance = async (request, response) => {
    try {
        userLogger.info('Entering demoAddBalance', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, amount } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notFound("Access Denied!");

        // Use String(login) to prevent PostgreSQL operator does not exist (character varying = integer) type error
        const demoMt5Data = await Mt5Model.findOne({
            where: {
                userId: userData.id,
                Login: String(login),
                accountType: "DEMO"
            }
        }); if (!demoMt5Data) throw CustomErrorHandler.serverError("Demo MT5 Account Not Found!");

        // Establish a 6-second gateway timeout race to prevent the API request from hanging indefinitely if MT5 server is offline
        const depositPromise = TradeRequestControllers.depositWithdraw(demoMt5Data.Login, 2, amount, "Deposited For Demo");
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("MT5 WebAPI Gateway Response Timeout")), 6000)
        );

        const data = await Promise.race([depositPromise, timeoutPromise]);
        if (!data) throw CustomErrorHandler.serverError("Failed to deposit Demo Balance!");

        // 1. Immediately update local database cache via mathematical addition (lightning fast)
        try {
            demoMt5Data.Balance = parseFloat(demoMt5Data.Balance || 0) + parseFloat(amount);
            await demoMt5Data.save();
        } catch (dbErr) {
            userLogger.error('Failed to update local db balance cache synchronously', { error: dbErr.message || dbErr });
        }

        // 2. Asynchronously trigger live balance sync in the background to revalidate the cache
        MetaControllers.checkUserBalance(demoMt5Data.Login, 1).then(async (balanceInfo) => {
            if (balanceInfo && balanceInfo.answer) {
                const liveBalance = balanceInfo.answer.balance !== undefined ? balanceInfo.answer.balance : balanceInfo.answer.Balance;
                if (liveBalance !== undefined) {
                    await Mt5Model.update(
                        { Balance: parseFloat(liveBalance) },
                        { where: { Login: String(login), userId: userData.id } }
                    );
                }
            }
        }).catch((error) => {
            userLogger.error('Background balance sync failed after demoAddBalance', { error: error.message || error });
        });

        actionTracking(request, userData.id, "DEMO-BALANCE-ADDED", `Login: ${login}`);

        userLogger.info('Exiting demoAddBalance: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Demo Balance added.",
            data,
        });
    } catch (e) {
        userLogger.error('Error in demoAddBalance', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Update Mt5
module.exports.updateMt5User = async (request, response) => {
    try {
        userLogger.info('Entering updateMt5User', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, groupId, Leverage, Email, Phone, Country, City, State, ZipCode, Address } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: { userId: user.id, Login: login, isDeleted: false }
        }); if (!metaUser) throw CustomErrorHandler.unAuthorized("Mt5 Account Not Found!");

        let group = "";
        if (groupId) {
            const checkGroup = await GroupModel.findByPk(groupId);
            if (!checkGroup) throw CustomErrorHandler.notFound("Group Not Found!");

            const checkMt5Group = await Mt5GroupModel.findOne({
                where: { id: checkGroup.mt5Group }
            }); if (!checkMt5Group) throw CustomErrorHandler.notFound("Mt5 Group Name Not Found!");
            group = checkMt5Group.mt5GroupName;
        };

        const metaUserData = {
            login: Number(login),
            name: userData.name
        };

        if (group) metaUserData.group = group;
        if (Leverage !== undefined) metaUserData.Leverage = Number(Leverage);
        if (Email) metaUserData.Email = Email;
        if (Phone) metaUserData.Phone = Phone;
        if (Country) metaUserData.Country = Country;
        if (City) metaUserData.City = City;
        if (State) metaUserData.State = State;
        if (ZipCode) metaUserData.ZipCode = ZipCode;
        if (Address) metaUserData.Address = Address;

        const updatedData = await MetaControllers.updateUser(metaUserData);
        if (!updatedData) throw CustomErrorHandler.serverError("Failed to Update User!");

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
            PhonePassword: updatedData.answer.PhonePassword || "",
            Leverage: updatedData.answer.Leverage || Leverage || "",
        }, {
            where: {
                Login: login
            }
        });

        actionTracking(request, userData.id, "UPDATED-META-ACCOUNT", `Login: ${login}`);
        userLogger.info('Exiting updateMt5User: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Updated MT5 Account.",
            data: updatedData,
        });
    } catch (e) {
        userLogger.error('Error in updateMt5User', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateMt5DefaultSymbol = async (request, response) => {
    try {
        userLogger.info('Entering updateMt5DefaultSymbol', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, defaultSymbol } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkMetaUser = await Mt5Model.findOne({
            where: { userId: user.id, Login: login, isDeleted: false }
        }); if (!checkMetaUser) throw CustomErrorHandler.unAuthorized("Mt5 Account Not Found!");

        checkMetaUser.defaultSymbol = defaultSymbol;
        await checkMetaUser.save();

        actionTracking(request, userData.id, "UPDATED-META-ACCOUNT-DEFAULT-PAIR", `Login: ${login}`);

        userLogger.info('Exiting updateMt5DefaultSymbol: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Updated MT5 Symbol.",
            data: checkMetaUser,
        });
    } catch (e) {
        userLogger.error('Error in updateMt5DefaultSymbol', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

function findIndexByLoginAndType(passwordList, mt5Login, passwordType) {
    return passwordList.findIndex(
        item => item.mt5Login === mt5Login && item.passwordType === passwordType
    );
}
// Update Mt5 password
module.exports.updateMt5Password = async (request, response) => {
    try {
        userLogger.info('Entering updateMt5Password', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, PassMain, PassInvestor } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const mt5Data = await Mt5Model.findOne({
            where: { Login: login, userId: userData.id }
        }); if (!mt5Data) throw CustomErrorHandler.notFound("MT5 Account Not Found!");

        const passwordData = await PasswordModel.findOne({
            where: { userId: mt5Data.userId }
        });
        const passwordList = [...passwordData.passwordList];

        if (PassMain) {
            await MetaControllers.changePassword(login, "main", PassMain);
            const index = findIndexByLoginAndType(passwordList, login, "MT5-MAIN");
            passwordList[index] = { passwordType: "MT5-MAIN", password: PassMain, mt5Login: login };
        }

        if (PassInvestor) {
            await MetaControllers.changePassword(login, "investor", PassInvestor);
            const index = findIndexByLoginAndType(passwordList, login, "MT5-INVESTOR");
            passwordList[index] = { passwordType: "MT5-INVESTOR", password: PassInvestor, mt5Login: login };
        }
        passwordData.passwordList = passwordList;
        await passwordData.save();

        userLogger.info('Exiting updateMt5Password: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password changed.",
            data: "",
        });
    } catch (e) {
        userLogger.error('Error in updateMt5Password', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.deleteUser = async (request, response) => {
    try {
        userLogger.info('Entering deleteUser', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                role: "USER",
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: {
                userId: user.id,
                Login: login,
                isDeleted: false
            }
        });
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const deletedUser = await MetaControllers.deleteUser(login);
        if (!deletedUser) throw CustomErrorHandler.serverError("Failed to Delete User!");

        metaUser.isDeleted = true;
        await metaUser.save();

        actionTracking(request, userData.id, "DELETED-META-ACCOUNT", `Login: ${login}`);
        userLogger.info('Exiting deleteUser: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `User Deleted with login ${login}`,
            data: "",
        });
    } catch (e) {
        userLogger.error('Error in deleteUser', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.changePassword = async (request, response) => {
    try {
        userLogger.info('Entering changePassword', { method: request.method || "", route: request.originalUrl || "" });
        const { user, login, type, newPassword } = request.body;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const metaUser = await Mt5Model.findOne({
            where: {
                userId: user.id,
                Login: login,
                isDeleted: false
            }
        });
        if (!metaUser) throw CustomErrorHandler.unAuthorized("Not found!");

        const mtUserData = await MetaControllers.changePassword(login, type, newPassword);
        if (!mtUserData) throw CustomErrorHandler.serverError(`Failed to change ${type} Password!`);

        actionTracking(request, userData.id, "CHANGED-META-ACCOUNT-PASSWORD", `Login: ${login}`);
        userLogger.info('Exiting changePassword: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Password Changed.",
            data: mtUserData,
        });
    } catch (e) {
        userLogger.error('Error in changePassword', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.tradeStatus = async (request, response) => {
    try {
        userLogger.info('Entering tradeStatus', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const tradeStatus = await MetaControllers.getTradeStatus(login);
        if (!tradeStatus) throw CustomErrorHandler.serverError(`Failed to Fetch Trade Status!`);

        userLogger.info('Exiting tradeStatus: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Trade Status.",
            data: tradeStatus,
        });
    } catch (e) {
        userLogger.error('Error in tradeStatus', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.checkBalance = async (request, response) => {
    try {
        userLogger.info('Entering checkBalance', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { login, flag } = request.query;

        const userData = await UserModel.findOne({
            where: {
                id: user.id,
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const demoMt5Data = await Mt5Model.findOne({
            where: {
                Login: login,
                userId: userData.id
            }
        });

        const checkBalancePromise = MetaControllers.checkUserBalance(login, flag);
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000));

        const result = await Promise.race([checkBalancePromise, timeoutPromise]);

        if (result === 'TIMEOUT') {
            userLogger.warn('checkBalance: MT5 Gateway response timed out. Serving cached balance to prevent UI blocking.', { login });
            
            const metaBalance = {
                status: true,
                answer: {
                    balance: demoMt5Data ? parseFloat(demoMt5Data.Balance || 0) : 0,
                    credit: demoMt5Data ? parseFloat(demoMt5Data.Credit || 0) : 0,
                    equity: demoMt5Data ? parseFloat(demoMt5Data.Balance || 0) : 0,
                    margin: 0,
                    margin_free: demoMt5Data ? parseFloat(demoMt5Data.Balance || 0) : 0,
                    margin_level: 0
                }
            };

            // Return cached balance immediately
            response.json({
                status: true,
                message: "Mt5 balance (cached).",
                data: metaBalance,
            });

            // Update in background when ready
            checkBalancePromise.then(async (liveBalanceData) => {
                if (liveBalanceData && liveBalanceData.answer) {
                    const liveBalance = liveBalanceData.answer.balance !== undefined ? liveBalanceData.answer.balance : liveBalanceData.answer.Balance;
                    if (liveBalance !== undefined) {
                        await Mt5Model.update(
                            { Balance: parseFloat(liveBalance) },
                            { where: { Login: login, userId: userData.id } }
                        );
                    }
                }
            }).catch((err) => {
                userLogger.error('checkBalance background sync error', { error: err.message || err });
            });

        } else {
            const metaBalance = result;
            if (!metaBalance) throw CustomErrorHandler.serverError(`Failed to Fetch Balance!`);

            // Self-healing synchronization: update cached balance in Mt5Accounts table
            try {
                const liveBalance = metaBalance && metaBalance.answer && (metaBalance.answer.balance !== undefined ? metaBalance.answer.balance : metaBalance.answer.Balance);
                if (liveBalance !== undefined) {
                    await Mt5Model.update(
                        { Balance: parseFloat(liveBalance) },
                        { where: { Login: login, userId: userData.id } }
                    );
                }
            } catch (syncErr) {
                userLogger.error('Failed to sync live balance to Mt5Accounts', { error: syncErr.message || syncErr });
            }

            userLogger.info('Exiting checkBalance: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
            return response.json({
                status: true,
                message: "Mt5 balance.",
                data: metaBalance,
            });
        }
    } catch (e) {
        userLogger.error('Error in checkBalance', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
