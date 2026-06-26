const { Op } = require("sequelize");
const sequelize = require("../../config/db.config");
const ibPlanConfig = require("../../config/ibPlan.json")
const IbModel = require("../../models/ib.model");
const GroupModel = require("../../models/group.model");
const UserModel = require("../../models/users.model");
const AssetModel = require("../../models/asset.model");
const { buildReferralTree } = require("./user.controller");
const Mt5OrderModel = require("../../models/mt5order.model");
const Mt5AccountModel = require("../../models/mt5Account.model");
const TransactionModel = require("../../models/transaction.model");
const subIbComissionModel = require("../../models/subIbComission.model");
const IbComissionPlanModel = require("../../models/ibComissionPlan.model");
const IbcomissionTrxModel = require("../../models/ibComissionTransaction.model");
const IbComissionPlanNameModel = require("../../models/ibComissionPlanName.model");
const { orderTracking } = require("../../user/controller/orders.controller");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.ibList = async (request, response) => {
    try {
        adminLogger.info('Entering ibList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, status, userId } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        // Pagination options
        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const whereCondition = { };

        if (status) whereCondition.status = status;
        if (userId) whereCondition.userId = userId;

        const { count, rows: transactionList } = await IbModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        adminLogger.info('Exiting ibList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                transactionList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in ibList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Create Ib Comission Plan Name
module.exports.addIbComissionPlan = async (request, response) => {
    try {
        adminLogger.info('Entering addIbComissionPlan', { method: request.method || "", route: request.originalUrl || "" });
        const { user, planName } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkPlanName = await IbComissionPlanNameModel.findOne({
            where: { planName }
        }); if(checkPlanName) throw CustomErrorHandler.notFound("Plan Name already exists!")

        const newPlan = await IbComissionPlanNameModel.create({ planName });

        adminLogger.info('Exiting addIbComissionPlan: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib Comission Plan added.",
            data: newPlan,
        });
    } catch (e) {
        adminLogger.error('Error in addIbComissionPlan', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.IbComissionPlanNameList = async (request, response) => {
    try {
        adminLogger.info('Entering IbComissionPlanNameList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page, sizePerPage, search, id } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
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

        const whereCondition = { ...searchCondition };
        if(id) whereCondition.id = id;

        const { count, rows: ibComissionNameList } = await IbComissionPlanNameModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        adminLogger.info('Exiting IbComissionPlanNameList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib Comission Name List.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                ibComissionNameList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in IbComissionPlanNameList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function checkMasterIb(userId) {
    try {
        const userData = await UserModel.findByPk(userId);

        // Case 1: user not found
        if (!userData) return false;

        // Case 2: no sponsor
        if (!userData.fromUser) return false;

        // Get sponsor user
        const sponsorUser = await UserModel.findByPk(userData.fromUser);

        if (!sponsorUser) return false;

        // Case 3: sponsor is an IB
        if (sponsorUser.isIb) return {
            status: true,
            userName: sponsorUser.userName
        };

        // Case 4: recursively check sponsor's sponsor
        return await checkMasterIb(sponsorUser.id);

    } catch (e) {
        console.log("Error while finding master IB:", e);
        return true;
    }
}

// approve reject ib
module.exports.updateIb = async (request, response) => {
    try {
        adminLogger.info('Entering updateIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ibId, status, force = "true" } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkIb = await IbModel.findByPk(ibId);
        if(!checkIb) throw CustomErrorHandler.notFound("Ib Id not found!");

        const checkIbUser = await UserModel.findOne({
            where: { id: checkIb.userId, isDeleted: false }
        }); if(!checkIbUser) throw CustomErrorHandler.notFound("User not foudn!");

        if(checkIbUser.isIb) throw CustomErrorHandler.alreadyExist("Already Ib!");
        
        checkIb.status = status;
        if(status === "APPROVED"){
            const masterIb = await checkMasterIb(checkIbUser.fromUser);

            if(masterIb && force == "false") throw CustomErrorHandler.alreadyExist(`${masterIb.userName} Master ib Found!`);
            checkIbUser.isIb = true;
            checkIbUser.level = 0;
            if(force == "true") checkIbUser.fromUser = null;
            
            await checkIbUser.save();
        }
        await checkIb.save();

        adminLogger.info('Exiting updateIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Ib Request ${status}.`,
            data: checkIb
        });
    } catch (e) {
        adminLogger.error('Error in updateIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Set ib Comission Plan
module.exports.addPlan = async (request, response) => {
    try {
        adminLogger.info('Entering addPlan', { method: request.method || "", route: request.originalUrl || "" });
        const { user, planId, ibId, cfdMetals, cfdFx, ibComission, symbolExtension, planType, groupId } = request.body;

        if(cfdFx == "false" && cfdMetals == "false") throw CustomErrorHandler.notAllowed("Both can't be false");

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkIb = await UserModel.findOne({
            where: { id: ibId, isDeleted: false, isIb: true }
        }); if (!checkIb) throw CustomErrorHandler.wrongCredentials("Ib not Found!");

        const checkPlan = await IbComissionPlanNameModel.findByPk(planId); // Plan Name
        if(!checkPlan) throw CustomErrorHandler.notFound("Plan not Found!");

        const checkComissionPlan = await IbComissionPlanModel.findOne({
            where: { planId, symbolExtension, groupId, ibId }
        }); if(checkComissionPlan) throw CustomErrorHandler.alreadyExist("Plan already exists!");

        const planData = { planId, symbolExtension, groupId, ibId, ibComission, planType };

        if(cfdFx == "true") planData.cfdFx = ibPlanConfig.cfdFx;
        if(cfdMetals == "true") planData.cfdMetals = ibPlanConfig.cfdMetals;

        const newPlan = await IbComissionPlanModel.create(planData);

        adminLogger.info('Exiting addPlan: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "New Plan Added.",
            data: newPlan
        });
    } catch (e) {
        adminLogger.error('Error in addPlan', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updatePlan = async (request, response) => {
    try {
        adminLogger.info('Entering updatePlan', { method: request.method || "", route: request.originalUrl || "" });
        const { user, planId, symbolExtension, cfdMetals, cfdFx, ibComission, isDeleted, planType, groupId } = request.body;

        if(cfdFx == "false" && cfdMetals == "false") {
            throw CustomErrorHandler.notAllowed("Both can't be false");
        }

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkIbPlan = await IbComissionPlanModel.findByPk(planId); 
        if(!checkIbPlan) throw CustomErrorHandler.alreadyExist("Plan Not Found!");

        // prepare update data
        const planData = {
            ibComission,
            isDeleted,
            symbolExtension,
            planType,
            groupId,
            cfdFx: cfdFx === "true" ? ibPlanConfig.cfdFx : [],
            cfdMetals: cfdMetals === "true" ? ibPlanConfig.cfdMetals : []
        };

        // update
        const updatedPlan = await checkIbPlan.update(planData);

        adminLogger.info('Exiting updatePlan: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Plan updated.",
            data: updatedPlan
        });
    } catch (e) {
        adminLogger.error('Error in updatePlan', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ibPlanList = async (request, response) => {
    try {
        adminLogger.info('Entering ibPlanList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, ibId, planId, planType, groupId, search } = request.query;
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
                      { planName: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        const whereCondition = { };

        if(ibId) whereCondition.ibId = ibId;
        if(planId) whereCondition.id = planId;
        if(groupId) whereCondition.groupId = groupId;

        const { count, rows: ibPlanList } = await IbComissionPlanModel.findAndCountAll({
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
                },
                {
                    model: IbComissionPlanNameModel,
                    as: "plan",
                    attributes: ["planName"],
                    where: searchCondition
                }
            ],
            limit,
            offset,
        });

        adminLogger.info('Exiting ibPlanList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib Plan List.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                ibPlanList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in ibPlanList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function updateDescendantLevels(parentId, parentLevel) {
    const children = await UserModel.findAll({
        where: { fromUser: parentId, isDeleted: false }
    });
    for (const child of children) {
        child.level = parentLevel + 1;
        await child.save();
        await updateDescendantLevels(child.id, child.level);
    }
}

module.exports.moveUserToIb = async (request, response) => {
    try {
        adminLogger.info('Entering moveUserToIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, ibId } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkIb = await UserModel.findOne({
            where: { id: ibId, isDeleted: false, [Op.or]: [{ isIb: true }, { isSubIb: true }] }
        }); if(!checkIb) throw CustomErrorHandler.notFound("Ib/SubIb Not Found!");
        
        if (userId === ibId) throw CustomErrorHandler.notAllowed("User and IB cannot be the same!");

        const checkClient = await UserModel.findByPk(userId);
        if (!checkClient) throw CustomErrorHandler.notFound("User Not found!");

        checkClient.fromUser = ibId;
        checkClient.level = Number(checkIb.level) + 1;
        await checkClient.save();

        await updateDescendantLevels(checkClient.id, checkClient.level);

        adminLogger.info('Exiting moveUserToIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Assigned to IB/SubId.",
            data: ""
        });
    } catch (e) {
        adminLogger.error('Error in moveUserToIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.removeUserFromIb = async (request, response) => {
    try {
        adminLogger.info('Entering removeUserFromIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkUser = await UserModel.findByPk(userId);
        if (!checkUser) throw CustomErrorHandler.notFound("User Not found!");
        if (!checkUser.fromUser) throw CustomErrorHandler.notFound("Parent-Ib not Found! or already removed!");

        checkUser.fromUser = null;
        checkUser.isSubIb = false;
        await checkUser.save();

        adminLogger.info('Exiting removeUserFromIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Removed from IB.",
            data: ""
        });
    } catch (e) {
        adminLogger.error('Error in removeUserFromIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Ib comission trx List
module.exports.ibComissionList = async (request, response) => {
    try {
        adminLogger.info('Entering ibComissionList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, ibId, fromDate, toDate, search, searchWithLogin } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = { };
        if(ibId) {
            const checkIb = await UserModel.findOne({
                where: { id: ibId, [Op.or]: [ { isIb: true }, { isSubIb: true } ] }
            }); if(!checkIb) throw CustomErrorHandler.notAllowed("Must be ib or subId!");
            where.userId = ibId;
        }
        if(searchWithLogin) where.loginId = searchWithLogin;

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
            where: { ...where },
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

        const totalComission = comissionTrxList.reduce(
            (sum, row) => sum + Number(row.comissionAmount || 0),
            0
        );

        const totalLot = comissionTrxList.reduce((sum, row) => {
            const rawVolume = Number(row.volume || 0);
            const lotVolume = Number.isFinite(rawVolume) ? rawVolume / 10000 : 0;
            return sum + lotVolume;
        }, 0);

        adminLogger.info('Exiting ibComissionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib Comission trxlist.",
            data: {
                totalComission: totalComission || 0,
                totalLot: totalLot || 0,
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                comissionTrxList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in ibComissionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.setSubIbComission = async (request, response) => {
    try {
        adminLogger.info('Entering setSubIbComission', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ibPlanId, subIbId, amount } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkPlan = await IbComissionPlanModel.findByPk(ibPlanId);
        if(!checkPlan) throw CustomErrorHandler.notFound("Plan not Found!");

        const checkSubIb = await UserModel.findOne({
            where: { id: subIbId, isDeleted: false, isSubIb: true }
        }); if (!checkSubIb) throw CustomErrorHandler.wrongCredentials("Sub-Ib not Found!");  

        const checkAlreadyExists = await subIbComissionModel.findOne({
            where: { ibPlanId, subIbId }
        }); if(checkAlreadyExists) throw CustomErrorHandler.alreadyExist("Sub-ib comission already exists!");

        const planData = { ibPlanId, subIbId, groupId: checkPlan.groupId, comission: amount, ibId: checkPlan.ibId };

        const newPlan = await subIbComissionModel.create(planData);

        adminLogger.info('Exiting setSubIbComission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Plan set for subIb.",
            data: newPlan
        });
    } catch (e) {
        adminLogger.error('Error in setSubIbComission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateSubIbComission = async (request, response) => {
    try {
        adminLogger.info('Entering updateSubIbComission', { method: request.method || "", route: request.originalUrl || "" });
        const { user, comissionId, amount } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkComission = await subIbComissionModel.findByPk(comissionId);
        if(!checkComission) throw CustomErrorHandler.notFound("Comission not found!");

        checkComission.comission = Number(amount);
        await checkComission.save();

        adminLogger.info('Exiting updateSubIbComission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Comission updated.",
            data: checkComission
        });
    } catch (e) {
        adminLogger.error('Error in updateSubIbComission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.subIbComissionList = async (request, response) => {
    try {
        adminLogger.info('Entering subIbComissionList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { planId } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const planData = await IbComissionPlanModel.findByPk(planId);
        if(!planData) throw CustomErrorHandler.notFound("Plan not found!");

        const userList = [];
        await buildReferralTree(planData.ibId, 1, userList);

        subIbComission = []
        for(const users of userList){
            if(users.isSubIb){
                const subIbData = await subIbComissionModel.findOne({
                    where: { ibPlanId: planId, subIbId: users.id }
                });
                users.comissionDetaild = subIbData ? subIbData : null;
                subIbComission.push(users)
            }
        }

        adminLogger.info('Exiting subIbComissionList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "SubIb list.",
            data: subIbComission
        });
    } catch (e) {
        adminLogger.error('Error in subIbComissionList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ibReport = async (request, response) => {
    try {
        adminLogger.info('Entering ibReport', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { ibId, page = 1, sizePerPage = 10, transactionType, fromDate, toDate } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const ibUser = await UserModel.findOne({
            where: { id: ibId, isDeleted: false },
            attributes: ["id", "name", "email", "userName", "mobile", "country", "isIb", "isSubIb", "isKycVerified", "createdAt"]
        }); if (!ibUser) throw CustomErrorHandler.notFound("IB not found!");

        // Get all downstream team members
        const teamList = [];
        await buildReferralTree(ibUser.id, 1, teamList);
        const teamUserIds = [...new Set(
            teamList
                .map((member) => {
                    const rawId = typeof member === "object" && member !== null ? member.id : member;
                    const normalizedId = Number(rawId);
                    return Number.isInteger(normalizedId) ? normalizedId : null;
                })
                .filter((id) => id !== null)
        )];

        const currentPage = Number(page);
        const limit = parseInt(sizePerPage);
        const offset = (currentPage - 1) * limit;

        const whereCondition = teamUserIds.length > 0
            ? { userId: { [Op.in]: teamUserIds } }
            : { userId: { [Op.in]: [-1] } };

        if (transactionType) whereCondition.transactionType = transactionType;

        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            whereCondition.createdAt = {
                [Op.between]: [startDate, endDate],
            };
        } else if (fromDate) {
            const startDate = new Date(fromDate);
            startDate.setHours(0, 0, 0, 0);
            whereCondition.createdAt = { [Op.gte]: startDate };
        } else if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            whereCondition.createdAt = { [Op.lte]: endDate };
        }

        const totalWhereCondition = teamUserIds.length > 0
            ? { userId: { [Op.in]: teamUserIds } }
            : { userId: { [Op.in]: [-1] } };

        if (whereCondition.createdAt) totalWhereCondition.createdAt = whereCondition.createdAt;

        const [totalDeposit, totalWithdraw, { count, rows: trxList }] = await Promise.all([
            TransactionModel.sum("amount", {
                where: { ...totalWhereCondition, transactionType: "WALLET-DEPOSIT" }
            }),
            TransactionModel.sum("amount", {
                where: { ...totalWhereCondition, transactionType: "WALLET-WITHDRAW" }
            }),
            TransactionModel.findAndCountAll({
                where: whereCondition,
                order: [["createdAt", "DESC"]],
                include: [
                    { model: UserModel, as: "user", attributes: ["id", "name", "email", "userName"] },
                ],
                limit,
                offset,
            }),
        ]);

        adminLogger.info('Exiting ibReport: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "IB Report.",
            data: {
                ibUser,
                totalDeposit: totalDeposit || 0,
                totalWithdraw: totalWithdraw || 0,
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage,
                trxList,
            }
        });
    } catch (e) {
        adminLogger.error('Error in ibReport', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function distributeComissionHelper(userId, ibPlanId, order, remainingAmount, comissionPlanDetails, fromUser, ibId, distributedAmount = 0, dbTransaction = null) {
    try {
        console.log(`[DEBUG] distributeComissionHelper: userId=${userId}, ibPlanId=${ibPlanId}, remainingAmount=${remainingAmount}, fromUser=${fromUser}, ibId=${ibId}, distributedAmount=${distributedAmount}`);
        const queryOptions = dbTransaction ? { transaction: dbTransaction } : {};
        const checkUser = await UserModel.findOne({
            where: { id: userId, isDeleted: false, isComissionAllowed: false },
            ...queryOptions
        });
        if (!checkUser) {
            console.log(`[DEBUG] Sponsor user ID=${userId} not found, deleted, or isComissionAllowed !== false. Stopping tree recursion.`);
            return remainingAmount;
        }
        console.log(`[DEBUG] Found sponsor user ID=${userId}: email=${checkUser.email}, isSubIb=${checkUser.isSubIb}, fromUser=${checkUser.fromUser}`);

        const comissionData = await subIbComissionModel.findOne({
            where: { ibId, ibPlanId, subIbId: userId, isDeleted: false },
            ...queryOptions
        });

        let newDistributedAmount = distributedAmount;

        if (checkUser.isSubIb && comissionData) {
            const lot = Number(order.Volume) / 10000;
            let comissionAmount = comissionData.comission * lot;
            console.log(`[DEBUG] User ID=${userId} is a Sub-IB. Sub-IB Commission rate=${comissionData.comission}, rawComission=${comissionAmount}, alreadyDistributed=${distributedAmount}`);
            comissionAmount -= distributedAmount;
            console.log(`[DEBUG] Final sub-IB commission calculation: ${comissionData.comission * lot} - ${distributedAmount} = ${comissionAmount}`);

            if (comissionAmount <= 0) {
                console.log(`[DEBUG] Commission amount <= 0. Skipping payout for User ID=${userId}.`);
                return remainingAmount;
            }
            if (remainingAmount < comissionAmount) {
                console.log(`[DEBUG] Remaining amount (${remainingAmount}) is less than sub-IB commission (${comissionAmount}). Skipping payout.`);
                return remainingAmount;
            }

            console.log(`[DEBUG] Paying sub-IB User ID=${userId} commission of ${comissionAmount}`);
            await IbcomissionTrxModel.create({
                userId,
                fromUser,
                loginId: order.Login,
                orderId: order.id,
                symbol: order.Symbol,
                price: order.Price,
                volume: order.Volume,
                comissionAmount,
                ibId,
                type: (order.Action == 0 || order.Action == "0" || order.type == 0) ? "BUY" : "SELL",
            }, queryOptions);

            const assetData = await AssetModel.findOne({
                where: { userId, isDeleted: false },
                ...queryOptions
            });
            if (!assetData) {
                throw new Error(`Asset wallet not found for sub-IB User ID=${userId}`);
            }
            assetData.totalIBIncome = Number(assetData.totalIBIncome || 0) + Number(comissionAmount);
            await assetData.save(queryOptions);
            console.log(`[DEBUG] Updated Asset Model for sub-IB User ID=${userId}: new totalIBIncome=${assetData.totalIBIncome}`);

            remainingAmount -= comissionAmount;
            newDistributedAmount += comissionAmount;
        } else {
            console.log(`[DEBUG] User ID=${userId} is NOT a Sub-IB or has no sub-IB plan in SubIbComissions.`);
        }

        if (checkUser.fromUser) {
            console.log(`[DEBUG] Recursing up to parent sponsor ID=${checkUser.fromUser}`);
            return await distributeComissionHelper(checkUser.fromUser, ibPlanId, order, remainingAmount, comissionPlanDetails, fromUser, ibId, newDistributedAmount, dbTransaction);
        }

        console.log(`[DEBUG] Reached root of sponsor tree for User ID=${userId}. Returning remaining commission amount: ${remainingAmount}`);
        return remainingAmount;
    } catch (e) {
        console.log("Error in distributeComissionHelper:", e);
        return false;
    }
}

module.exports.trackMt5Orders = async (request, response) => {
    try {
        adminLogger.info('Entering trackMt5Orders', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ibId, fromDate, toDate } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Access Denied!");
        }

        const trackingResult = await orderTracking({ ibId, fromDate, toDate });

        adminLogger.info('Exiting trackMt5Orders: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "IB order tracking completed successfully.",
            data: trackingResult
        });
    } catch (e) {
        adminLogger.error('Error in trackMt5Orders', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.manualDistributeCommission = async (request, response) => {
    try {
        adminLogger.info('Entering manualDistributeCommission', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ibId, fromDate, toDate } = request.body;
        console.log(`[DEBUG] manualDistributeCommission entered: ibId=${ibId}, fromDate=${fromDate}, toDate=${toDate}`);

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        });
        if (!userData) {
            console.log(`[DEBUG] Authorization failed. Access Denied.`);
            throw CustomErrorHandler.wrongCredentials("Access Denied!");
        }
        console.log(`[DEBUG] Admin authenticated: email=${userData.email}`);

        // 1. Fetch active target IBs
        const ibWhere = { isIb: true, isDeleted: false };
        if (ibId) {
            ibWhere.id = ibId;
        }
        const ibList = await UserModel.findAll({ where: ibWhere });
        console.log(`[DEBUG] Found ${ibList.length} IBs to process.`);
        if (ibList.length === 0) {
            return response.json({
                status: true,
                message: "No active IBs found matching the criteria.",
                data: { processedOrdersCount: 0 }
            });
        }

        // 2. Build date filter condition for Mt5OrderModel
        const dateCondition = {};
        if (fromDate && toDate) {
            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            dateCondition[Op.between] = [start, end];
        } else if (fromDate) {
            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
            dateCondition[Op.gte] = start;
        } else if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            dateCondition[Op.lte] = end;
        }
        console.log(`[DEBUG] Date conditions resolved: ${JSON.stringify(dateCondition)}`);

        let totalProcessed = 0;
        let totalRecovered = 0;
        let totalSkipped = 0;
        let totalAlreadyPaid = 0;

        for (const ib of ibList) {
            console.log(`\n[DEBUG] Processing IB: ID=${ib.id}, email=${ib.email}`);
            // Fetch IB Plan groups/symbols
            const ibComGrpList = await IbComissionPlanModel.findAll({
                where: { ibId: ib.id, isDeleted: false }
            });
            console.log(`[DEBUG] IB ID=${ib.id} has ${ibComGrpList.length} commission plans.`);
            if (ibComGrpList.length === 0) {
                console.log(`[DEBUG] Skipping IB ID=${ib.id} (no active plans).`);
                continue;
            }

            let symbols = [];
            ibComGrpList.forEach(group => {
                const metals = Array.isArray(group.cfdMetals) ? group.cfdMetals : [];
                const fx = Array.isArray(group.cfdFx) ? group.cfdFx : [];
                const allSymbols = [...metals, ...fx];
            
                allSymbols.forEach(sym => {
                    if (group.symbolExtension) {
                        symbols.push(`${sym}${group.symbolExtension}`);
                    } else {
                        symbols.push(sym);
                    }
                });
            });
            console.log(`[DEBUG] Resolved target symbol matching list: ${JSON.stringify(symbols)}`);

            // Find payable orders in the timeframe matching the symbol list for this IB.
            // Also recover rows that were incorrectly flagged distributed without any commission transaction.
            const baseOrderWhere = {
                ibId: ib.id,
                isDeleted: false,
                Symbol: { [Op.in]: symbols }
            };
            if (Object.keys(dateCondition).length > 0) {
                baseOrderWhere.createdAt = dateCondition;
            }
            console.log(`[DEBUG] mt5Order base query criteria: ${JSON.stringify(baseOrderWhere)}`);

            const undistributedOrders = await Mt5OrderModel.findAll({
                where: {
                    ...baseOrderWhere,
                    isComissionDistributed: false
                }
            });

            const markedDistributedOrders = await Mt5OrderModel.findAll({
                where: {
                    ...baseOrderWhere,
                    isComissionDistributed: true
                }
            });

            let recoverableOrders = [];
            if (markedDistributedOrders.length > 0) {
                const markedOrderIds = markedDistributedOrders.map(order => order.id);
                const paidOrderRows = await IbcomissionTrxModel.findAll({
                    where: {
                        ibId: ib.id,
                        orderId: { [Op.in]: markedOrderIds },
                        isDeleted: false
                    },
                    attributes: ["orderId"],
                    raw: true
                });
                const paidOrderIds = new Set(paidOrderRows.map(row => Number(row.orderId)));
                recoverableOrders = markedDistributedOrders.filter(order => !paidOrderIds.has(Number(order.id)));
            }

            totalRecovered += recoverableOrders.length;
            const orderList = [...undistributedOrders, ...recoverableOrders];

            console.log(`[DEBUG] Found ${undistributedOrders.length} pending undistributed orders and ${recoverableOrders.length} recoverable orphaned orders for IB ID=${ib.id}`);
            if (orderList.length === 0) continue;

            for (const order of orderList) {
                console.log(`\n[DEBUG] --> Processing Order ID=${order.id}, PositionID=${order.PositionID}, Symbol=${order.Symbol}, Volume=${order.Volume}, extension="${order.extension}", userId=${order.userId}`);

                try {
                    const result = await sequelize.transaction(async (dbTransaction) => {
                        const currentOrder = await Mt5OrderModel.findByPk(order.id, { transaction: dbTransaction });
                        if (!currentOrder || currentOrder.isDeleted) {
                            return { processed: false, reason: "order_missing" };
                        }

                        const existingTrxCount = await IbcomissionTrxModel.count({
                            where: { ibId: ib.id, orderId: currentOrder.id, isDeleted: false },
                            transaction: dbTransaction
                        });
                        if (existingTrxCount > 0) {
                            if (!currentOrder.isComissionDistributed) {
                                await currentOrder.update({ isComissionDistributed: true }, { transaction: dbTransaction });
                            }
                            return { processed: false, reason: "already_paid" };
                        }

                        const lot = Number(currentOrder.Volume) / 10000;
                        const comissionData = await IbComissionPlanModel.findOne({
                            where: { ibId: ib.id, symbolExtension: currentOrder.extension, isDeleted: false },
                            transaction: dbTransaction
                        });
                        if (!comissionData) {
                            if (currentOrder.isComissionDistributed) {
                                await currentOrder.update({ isComissionDistributed: false }, { transaction: dbTransaction });
                            }
                            return { processed: false, reason: `no plan for extension "${currentOrder.extension}"` };
                        }

                        const comissionAmount = Number(comissionData.ibComission || 0) * lot;
                        console.log(`[DEBUG] Found plan ID=${comissionData.id}, ibComission rate=${comissionData.ibComission}. Total base commission to distribute=${comissionAmount}`);
                        if (!Number.isFinite(comissionAmount) || comissionAmount <= 0) {
                            if (currentOrder.isComissionDistributed) {
                                await currentOrder.update({ isComissionDistributed: false }, { transaction: dbTransaction });
                            }
                            return { processed: false, reason: "commission amount is zero or invalid" };
                        }

                        const orderUser = await UserModel.findByPk(currentOrder.userId, { transaction: dbTransaction });
                        if (!orderUser) {
                            if (currentOrder.isComissionDistributed) {
                                await currentOrder.update({ isComissionDistributed: false }, { transaction: dbTransaction });
                            }
                            return { processed: false, reason: `order user ${currentOrder.userId} not found` };
                        }
                        if (!orderUser.fromUser) {
                            if (currentOrder.isComissionDistributed) {
                                await currentOrder.update({ isComissionDistributed: false }, { transaction: dbTransaction });
                            }
                            return { processed: false, reason: "order user has no referrer parent sponsor" };
                        }
                        console.log(`[DEBUG] Order user ID=${currentOrder.userId} referred by Sponsor ID=${orderUser.fromUser}`);

                        console.log(`[DEBUG] Calling distributeComissionHelper recursively starting at Sponsor ID=${orderUser.fromUser}`);
                        const remainingAmount = await distributeComissionHelper(
                            orderUser.fromUser,
                            comissionData.id,
                            currentOrder,
                            comissionAmount,
                            comissionData,
                            currentOrder.userId,
                            ib.id,
                            0,
                            dbTransaction
                        );

                        console.log(`[DEBUG] distributeComissionHelper returned remainingAmount=${remainingAmount}`);
                        if (remainingAmount === false) {
                            throw new Error("sub-IB commission distribution failed");
                        }

                        if (Number(remainingAmount) > 0) {
                            console.log(`[DEBUG] Crediting remaining commission ${remainingAmount} to master IB ID=${ib.id}`);
                            const assetData = await AssetModel.findOne({
                                where: { userId: ib.id, isDeleted: false },
                                transaction: dbTransaction
                            });
                            if (!assetData) {
                                throw new Error(`Asset wallet not found for master IB ID=${ib.id}`);
                            }

                            assetData.totalIBIncome = Number(assetData.totalIBIncome || 0) + Number(remainingAmount);
                            await assetData.save({ transaction: dbTransaction });
                            console.log(`[DEBUG] Updated Asset Model for master IB ID=${ib.id}: new totalIBIncome=${assetData.totalIBIncome}`);

                            await IbcomissionTrxModel.create({
                                userId: ib.id,
                                fromUser: currentOrder.userId,
                                loginId: currentOrder.Login,
                                orderId: currentOrder.id,
                                symbol: currentOrder.Symbol,
                                price: currentOrder.Price,
                                volume: currentOrder.Volume,
                                comissionAmount: remainingAmount,
                                ibId: ib.id,
                                type: (currentOrder.Action == 0 || currentOrder.Action == "0" || currentOrder.type == 0) ? "BUY" : "SELL",
                            }, { transaction: dbTransaction });
                        }

                        const createdTrxCount = await IbcomissionTrxModel.count({
                            where: { ibId: ib.id, orderId: currentOrder.id, isDeleted: false },
                            transaction: dbTransaction
                        });
                        if (createdTrxCount <= 0) {
                            if (currentOrder.isComissionDistributed) {
                                await currentOrder.update({ isComissionDistributed: false }, { transaction: dbTransaction });
                            }
                            return { processed: false, reason: "no commission transaction was created" };
                        }

                        await currentOrder.update({ isComissionDistributed: true }, { transaction: dbTransaction });
                        console.log(`[DEBUG] Order ID=${currentOrder.id} flagged as distributed (isComissionDistributed = true).`);
                        return { processed: true };
                    });

                    if (result.processed) {
                        totalProcessed++;
                    } else if (result.reason === "already_paid") {
                        totalAlreadyPaid++;
                        console.log(`[DEBUG] [SKIP] Order ID=${order.id} already has commission transactions.`);
                    } else {
                        totalSkipped++;
                        console.log(`[DEBUG] [SKIP] Order ID=${order.id}: ${result.reason}`);
                    }
                } catch (orderError) {
                    totalSkipped++;
                    console.log(`[DEBUG] [SKIP] Order ID=${order.id} failed during distribution: ${orderError.message}`);

                    const transactionCount = await IbcomissionTrxModel.count({
                        where: { ibId: ib.id, orderId: order.id, isDeleted: false }
                    });
                    if (transactionCount === 0 && order.isComissionDistributed) {
                        await order.update({ isComissionDistributed: false });
                        console.log(`[DEBUG] Order ID=${order.id} restored to undistributed because no commission transaction exists.`);
                    }
                }
            }
        }

        console.log(`\n[DEBUG] manualDistributeCommission finished: totalProcessed=${totalProcessed}, totalRecovered=${totalRecovered}, totalAlreadyPaid=${totalAlreadyPaid}, totalSkipped=${totalSkipped} orders.`);
        adminLogger.info('Exiting manualDistributeCommission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Manual IB commission distribution completed successfully.`,
            data: {
                processedOrdersCount: totalProcessed,
                recoveredOrdersCount: totalRecovered,
                alreadyPaidOrdersCount: totalAlreadyPaid,
                skippedOrdersCount: totalSkipped
            }
        });
    } catch (e) {
        adminLogger.error('Error in manualDistributeCommission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.mt5OrderList = async (request, response) => {
    try {
        adminLogger.info('Entering mt5OrderList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, ibId, userId, isComissionDistributed, search, fromDate, toDate } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const limit = parseInt(sizePerPage, 10);
        const offset = (parseInt(page, 10) - 1) * limit;

        const where = { isDeleted: false };

        if (ibId) where.ibId = ibId;
        if (userId) where.userId = userId;
        if (isComissionDistributed !== undefined) {
            where.isComissionDistributed = isComissionDistributed === "true" || isComissionDistributed === true;
        }

        if (search) {
            where[Op.or] = [
                { Symbol: { [Op.iLike]: `%${search}%` } },
                { PositionID: { [Op.iLike]: `%${search}%` } },
                { Login: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (fromDate && toDate) {
            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            where.createdAt = { [Op.between]: [start, end] };
        } else if (fromDate) {
            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
            where.createdAt = { [Op.gte]: start };
        } else if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            where.createdAt = { [Op.lte]: end };
        }

        const { count, rows: orderList } = await Mt5OrderModel.findAndCountAll({
            where,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "name", "email", "userName"]
                },
                {
                    model: UserModel,
                    as: "ib",
                    attributes: ["id", "name", "email", "userName"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        adminLogger.info('Exiting mt5OrderList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 order list fetched successfully.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page, 10),
                orderList
            }
        });
    } catch (e) {
        adminLogger.error('Error in mt5OrderList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
