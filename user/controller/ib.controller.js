const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const GroupModel = require("../../models/group.model");
const AssetModel = require("../../models/asset.model");
const { actionTracking } = require("../../helpers/index");
const UserDetailsModel = require("../../models/userDetails.model");
const PlanNameModel = require("../../models/ibComissionPlan.model");
const Mt5AccountModel = require("../../models/mt5Account.model");
const TransactionModel = require("../../models/transaction.model");
const IbComissionPlanNameModel = require("../../models/ibComissionPlanName.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");

module.exports.setIbDetails = async(userJsonData) => {
    try {
        userLogger.info('Entering setIbDetails', { method: request.method || "", route: request.originalUrl || "" });
        await UserDetailsModel.create({
            userId: userJsonData.userId,
            firstName: userJsonData.firstName,
            lastName: userJsonData.lastName,
            primaryEmail: userJsonData.primaryEmail,
            ccountryName: userJsonData.ccountryName,
            email: userJsonData.email,
            secondryEmail: userJsonData.secondryEmail,
            countryCode: userJsonData.countryCode,
            mobile: userJsonData.mobile,
            gender: userJsonData.gender,
            assingTo: userJsonData.assingTo,
            dob: userJsonData.dob,
            walletId: userJsonData.walletId,
            nationality: userJsonData.nationality,
            leadSource: userJsonData.leadSource,
            ftd: userJsonData.ftd,
            kycStatus: userJsonData.kycStatus,
            isConvertedFromLead: userJsonData.isConvertedFromLead,
            loginVerified: userJsonData.loginVerified,
            createdTime: userJsonData.createdTime,
            modifiedTime: userJsonData.modifiedTime,
            source: userJsonData.source,
            isAgree: userJsonData.isAgree,
            referenceId: userJsonData.referenceId,
            whereDidYouFindUs: userJsonData.whereDidYouFindUs,
            withdrawAllowed: userJsonData.withdrawAllowed,
            lastLoginIp: userJsonData.lastLoginIp,
            kycFormEdit: userJsonData.kycFormEdit,
            plainPassword: userJsonData.plainPassword,
            entity: userJsonData.entity,
            ibName: userJsonData.ibName,
            yearsOfExp: userJsonData.yearsOfExp,
            noOfExistingClient: userJsonData.noOfExistingClient,
            averageVolumePerMonth: userJsonData.averageVolumePerMonth,
            ibStatus: userJsonData.ibStatus,
            rejectedReason: userJsonData.rejectedReason,
            childProfile: userJsonData.childProfile,
            parentAffliateCode: userJsonData.parentAffliateCode,
            ibLevel: userJsonData.ibLevel,
            ibHierarchy: userJsonData.ibHierarchy,
            parentProfile: userJsonData.parentProfile,
            ibNode: userJsonData.ibNode,
            distributMaxComission: userJsonData.distributMaxComission,
            maxIbCommAmtPerLot: userJsonData.maxIbCommAmtPerLot,
            preferableAssignedUserId: userJsonData.preferableAssignedUserId,
            comissionPercentage: userJsonData.comissionPercentage,
            portalUser: userJsonData.portalUser,
            language: userJsonData.language,
            timeZone: userJsonData.timeZone,
            timeFormate: userJsonData.timeFormate,
            dateFormate: userJsonData.dateFormate,
            isSetPreference: userJsonData.isSetPreference,
            maillingStreet: userJsonData.maillingStreet,
            maillingCity: userJsonData.maillingCity,
            maillingState: userJsonData.maillingState,
            maillingZip: userJsonData.maillingZip,
            maillingPoBox: userJsonData.maillingPoBox,
            maillingCountry: userJsonData.maillingCountry,
            profileImage: userJsonData.profileImage,
        })
    } catch (e) {
        userLogger.error('Error in setIbDetails', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        console.log("Error While Storing Ib Details", e.message);
        return false
    }
}

// Ib comisison List
module.exports.getIbComission = async (request, response) => {
    try {
        userLogger.info('Entering getIbComission', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, search, planId } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        // Search condition
        const searchCondition = search
            ? {
                  [Op.or]: [
                      { planName: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        const whereCondition = {
            ...searchCondition,
            ibId: userData.id
        };
        if(planId) whereCondition.id = planId;

        const { count, rows: ibPlanList } = await PlanNameModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: UserModel,
                    as: "ib",
                    attributes: ["name", "email", "userName"] // Adjust fields as needed
                },
                {
                    model: GroupModel,
                    as: "group",
                    attributes: ["name", "type"]
                }
            ],
            limit,
            offset,
        });

        userLogger.info('Exiting getIbComission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Comission Plan List.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                ibPlanList,
            },
        });
    } catch (e) {
        userLogger.error('Error in getIbComission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.makeSubIb = async (request, response) => {
    try {
        userLogger.info('Entering makeSubIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, isSubIb } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, isIb: true }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkUser = await UserModel.findByPk(userId); 
        if (!checkUser) throw CustomErrorHandler.wrongCredentials("User not Found!");

        checkUser.isSubIb = isSubIb;
        await checkUser.save();
        
        userLogger.info('Exiting makeSubIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Updated.",
            data: checkUser
        });
    } catch (e) {
        userLogger.error('Error in makeSubIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

const buildReferralTree = async (userId, level = 1, userList = []) => {
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
        await buildReferralTree(referral.id, level + 1, userList);
    }
    
    return userList;
};

module.exports.teamTrxReport = async (request, response) => {
    try {
        userLogger.info('Entering teamTrxReport', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, transactionType, fromDate, toDate, search } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] },
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userList = [];
        await buildReferralTree(userData.id, 1, userList);
        if(userList.length == 0) throw CustomErrorHandler.notFound("Transaction List not found!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        const whereCondition = { userId: { [Op.in]: userList } };
        
        if (transactionType) { 
            whereCondition.transactionType = transactionType 
        } else { 
            whereCondition.transactionType= { [Op.in]: ["WALLET-DEPOSIT", "WALLET-WITHDRAW"] } 
        }

        if (fromDate && toDate) {
            whereCondition.createdAt = { [Op.between]: [new Date(fromDate), new Date(toDate)] };
        } else if (fromDate) {
            whereCondition.createdAt = { [Op.gte]: new Date(fromDate) };
        } else if (toDate) {
            whereCondition.createdAt = { [Op.lte]: new Date(toDate) };
        }

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
 
        const { count, rows: trxList } = await TransactionModel.findAndCountAll({
            where: { ...whereCondition },
            order: [["createdAt", "DESC"]],
            limit,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"], // Adjust fields as needed
                    where: searchCondition
                }
            ],
            offset,
        });

        const [totalDeposit, totalWithdraw] = await Promise.all([
            TransactionModel.sum("amount", { where: { ...whereCondition, transactionType: "WALLET-DEPOSIT" } }),
            TransactionModel.sum("amount", { where: { ...whereCondition, transactionType: "WALLET-WITHDRAW" } }),
        ]);

        userLogger.info('Exiting teamTrxReport: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Transaction List.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                totalDeposit: totalDeposit || 0,
                totalWithdraw: totalWithdraw || 0,
                trxList
            }
        });
    } catch (e) {
        userLogger.error('Error in teamTrxReport', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ibWithdraw = async (request, response) => {
    try {
        userLogger.info('Entering ibWithdraw', { method: request.method || "", route: request.originalUrl || "" });
        const { user, amount } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: "USER", isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const assetData = await AssetModel.findOne({
            where: { userId: userData.id }
        }); if(!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!");

        const availableAmount = assetData.totalIBIncome - assetData.totalIBWithdrawl;
        console.log(availableAmount, assetData.totalIBIncome, assetData.totalIBWithdrawl)

        if(availableAmount < amount){
            throw CustomErrorHandler.wrongCredentials("Low Available Balance!");
        }

        const newWithdraw = await TransactionModel.create({
            userId: userData.id,
            amount: amount,
            transactionType: "IB-WITHDRAW",
            remark: "Transferred to main Balance",
            // paymentMethods: "CRYPTO", 
            // referrenceNo: data.tx_id
        });

        assetData.totalIBWithdrawl += Number(amount);
        assetData.mainBalance += Number(amount);
        await assetData.save();

        actionTracking(request, userData.id, "IB-BANK-WITHDRAW");
        userLogger.info('Exiting ibWithdraw: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${amount} Transferred to Main balance.`,
            data: newWithdraw
        });
    } catch (e) {
        userLogger.error('Error in ibWithdraw', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ibKycReport = async (request, response) => {
    try {
        userLogger.info('Entering ibKycReport', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { search } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] },
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userList = [];
        await buildReferralTree(userData.id, 1, userList);

        if(userList.length == 0) throw CustomErrorHandler.notFound("Referral list not Found!");

        let where = {};
        where.id = { [Op.in]: userList };

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
        
        const requiredFields = [ "profileImage", "userName", "name", "country", "isIb", "isSubIb", "isKycVerified" ];

        const completedKycList  = await UserModel.findAll({
            attributes: requiredFields,
            where: { ...where, isKycVerified: true, ...searchCondition },
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: UserModel,
                    as: 'parent',
                    attributes: ['name', 'userName', 'email', 'isIb', 'isSubIb'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
        });

        const pendingKycList  = await UserModel.findAll({
            attributes: requiredFields,
            where: { ...where, isKycVerified: false, ...searchCondition },
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: UserModel,
                    as: 'parent',
                    attributes: ['name', 'userName', 'email', 'isIb', 'isSubIb'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
        });

        userLogger.info('Exiting ibKycReport: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Kyc report.",
            data: {
                totalCompletedKyc: completedKycList.length,
                totalPendingKyc: pendingKycList.length,
                completedKycList,
                pendingKycList
            }
        });
    } catch (e) {
        userLogger.error('Error in ibKycReport', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function metaDepositedAccount(userIds = []) {
    try {
        let where = {};

        if (userIds.length > 0) where.userId = { [Op.in]: userIds };

        const { count, rows: mt5Accounts } = await Mt5AccountModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
        }); if(!count) return {  liveAccounts: 0, activeTraders: 0 };

        const mt5Logins = mt5Accounts.map(acc => acc.Login);

        const { counts, rows: activeTraders } = await TransactionModel.findAndCountAll({
            where: { 
                mt5Login: { [Op.in]: mt5Logins },
                transactionType: { [Op.in]: ["DEPOSIT", "CLIENT-DEPOSIT"] }
            },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"],
                },
            ],
            // group: ["Transaction.mt5Login", "user.id"],
        })

        return { liveAccounts: mt5Accounts, activeTraders };
    } catch (e) {
        console.log(e.message);
        return false;
    }
};

// Meta account
module.exports.liveAccount = async (request, response) => {
    try {
        userLogger.info('Entering liveAccount', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] },
        }); if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userList = [];
        await buildReferralTree(userData.id, 1, userList);

        const data = await metaDepositedAccount(userList);
        
        userLogger.info('Exiting liveAccount: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Live Accounts.",
            data
        });
    } catch (e) {
        userLogger.error('Error in liveAccount', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function firstTimeDeposit(page = 1, sizePerPage = 10, userIds = []) {
    try {
        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        if (userIds.length === 0) {
            return false;
        }

        let where = {
            userId: { [Op.in]: userIds },
            totalDeposit: { [Op.gt]: 0 } // Fetch only if mainBalance > 0
        };

        const { count, rows: assetList } = await AssetModel.findAndCountAll({
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

        return {
            totalRecords: count,
            totalPages: Math.ceil(count / sizePerPage),
            currentPage: page,
            assetList,
        };
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

module.exports.ftdRefReport = async (request, response) => {
    try {
        userLogger.info('Entering ftdRefReport', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        let { page, sizePerPage } = request.query;

        page = parseInt(page) || 1;
        sizePerPage = parseInt(sizePerPage) || 10;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, [Op.or]: [ { isIb: true }, { isSubIb: true } ] },
        });if (!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const userList = [];
        await buildReferralTree(userData.id, 1, userList);
        
        const data = await firstTimeDeposit(page, sizePerPage, userList);
        data.totalUser = userList.length;

        userLogger.info('Exiting ftdRefReport: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "FTD Report.",
            data
        });
    } catch (e) {
        userLogger.error('Error in ftdRefReport', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};