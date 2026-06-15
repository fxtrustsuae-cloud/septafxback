const { Op } = require("sequelize");
const IbModel = require("../../models/ib.model");
const GroupModel = require("../../models/group.model");
const PlanNameModel = require("../../models/ibPlan.model");
const UserModel = require("../../models/users.model");
const ComissionGroupModel = require("../../models/ibComission.model");
const UserComissionGroupModel = require("../../models/userComission.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.ibList = async (request, response) => {
    try {
        marketingLogger.info('Entering ibList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, status } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        // Pagination options
        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const whereCondition = { };

        if (status) {
            whereCondition.status = status;
        }

        const { count, rows: transactionList } = await IbModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        marketingLogger.info('Exiting ibList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in ibList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// approve reject ib
module.exports.updateIb = async (request, response) => {
    try {
        marketingLogger.info('Entering updateIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ibId, status } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkIb = await IbModel.findByPk(ibId);
        if(!checkIb) throw CustomErrorHandler.notFound("Ib Id not found!");

        const checkIbUser = await UserModel.findOne({
            where: { id: checkIb.userId, isDeleted: false }
        }); if(!checkIbUser) throw CustomErrorHandler.notFound("User not foudn!");

        if(checkIbUser.isIb) throw CustomErrorHandler.alreadyExist("Already Ib!");
        
        checkIb.status = status;
        if(status === "APPROVED"){
            checkIbUser.isIb = true;
            await checkIbUser.save();
        }
        await checkIb.save();

        marketingLogger.info('Exiting updateIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Ib Request ${status}.`,
            data: checkIb
        });
    } catch (e) {
        marketingLogger.error('Error in updateIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addPlan = async (request, response) => {
    try {
        marketingLogger.info('Entering addPlan', { method: request.method || "", route: request.originalUrl || "" });
        const { user, planName } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkPlanName = await PlanNameModel.findOne({
            where: { planName, isDeleted: false }
        }); if(checkPlanName) throw CustomErrorHandler.alreadyExist("Plan Name already Exist!");

        const newPlan = await PlanNameModel.create({
            planName
        });

        marketingLogger.info('Exiting addPlan: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "New Plan Added.",
            data: newPlan
        });
    } catch (e) {
        marketingLogger.error('Error in addPlan', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.ibPlanList = async (request, response) => {
    try {
        marketingLogger.info('Entering ibPlanList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: "ADMIN", isDeleted: false },
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

        const whereCondition = {
            ...searchCondition,
        };

        const { count, rows: usersList } = await PlanNameModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        marketingLogger.info('Exiting ibPlanList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Ib Plan List.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        marketingLogger.error('Error in ibPlanList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addComissionGroup = async (request, response) => {
    try {
        marketingLogger.info('Entering addComissionGroup', { method: request.method || "", route: request.originalUrl || "" });
        // return;
        const { user, planId, groupId, level1Commission, level2Commission, level3Commission,
            level4Commission, level5Commission, level6Commission, level7Commission } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkPlan = await PlanNameModel.findByPk(planId);
        if (!checkPlan) throw CustomErrorHandler.notFound("Plan id Not found!");

        const checkGroup = await GroupModel.findByPk(groupId);
        if (!checkGroup) throw CustomErrorHandler.notFound("Group Not Found!");

        const newComissionGroup = await ComissionGroupModel.create({
            planId, 
            groupId, 
            level1Commission, 
            level2Commission, 
            level3Commission,
            level4Commission, 
            level5Commission, 
            level6Commission, 
            level7Commission
        })

        marketingLogger.info('Exiting addComissionGroup: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Comission Group Added.",
            data: newComissionGroup
        });
    } catch (e) {
        marketingLogger.error('Error in addComissionGroup', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.comissionGroupList = async (request, response) => {
    try {
        marketingLogger.info('Entering comissionGroupList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: "ADMIN", isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        // Search condition
        const searchCondition = search
            ? {
                  [Op.or]: [
                      { id: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        const whereCondition = {
            ...searchCondition,
        };

        const { count, rows: usersList } = await ComissionGroupModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        marketingLogger.info('Exiting comissionGroupList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Comission Group List.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        marketingLogger.error('Error in comissionGroupList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateComissionGroup = async (request, response) => {
    try {
        marketingLogger.info('Entering updateComissionGroup', { method: request.method || "", route: request.originalUrl || "" });
        const { user, comissionGroupId, planId, groupId, level1Commission, level2Commission, level3Commission,
            level4Commission, level5Commission, level6Commission, level7Commission } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkComGrp = await ComissionGroupModel.findByPk(comissionGroupId);
        if(!checkComGrp) throw CustomErrorHandler.notFound("Not Found!");

        let checkPlan
        if(planId){
            checkPlan = await PlanNameModel.findByPk(planId);
            if (!checkPlan) throw CustomErrorHandler.notFound("Plan id Not found!");
            checkComGrp.planId = planId;
        }

        let checkGroup
        if(checkGroup){
            checkGroup = await GroupModel.findByPk(groupId);
            if (!checkGroup) throw CustomErrorHandler.notFound("Group Not Found!");
            checkComGrp.groupId = groupId;
        }

        if(level1Commission) checkComGrp.level1Commission = level1Commission;
        if(level2Commission) checkComGrp.level2Commission = level2Commission;
        if(level3Commission) checkComGrp.level3Commission = level3Commission;
        if(level4Commission) checkComGrp.level4Commission = level4Commission;
        if(level5Commission) checkComGrp.level5Commission = level5Commission;
        if(level6Commission) checkComGrp.level6Commission = level6Commission;
        if(level7Commission) checkComGrp.level7Commission = level7Commission;

        await checkComGrp.save();

        marketingLogger.info('Exiting updateComissionGroup: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Updated Comission Group.",
            data: checkComGrp
        });
    } catch (e) {
        marketingLogger.error('Error in updateComissionGroup', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addUserComissionGroup = async (request, response) => {
    try {
        marketingLogger.info('Entering addUserComissionGroup', { method: request.method || "", route: request.originalUrl || "" });
        const { user, ibId, planId } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkPlan = await PlanNameModel.findByPk(planId);
        if (!checkPlan) throw CustomErrorHandler.notFound("Plan id Not found!");

        const checkIb = await UserModel.findOne({
            where: { id: ibId, isIb: true, isDeleted: false }
        }); if(!checkIb) throw CustomErrorHandler.notFound("Ib Not Found!");

        const newUserComission = await UserComissionGroupModel.create({
            ibId,
            planId
        });

        marketingLogger.info('Exiting addUserComissionGroup: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Comission Group Added.",
            data: newUserComission
        });
    } catch (e) {
        marketingLogger.error('Error in addUserComissionGroup', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.moveUserToIb = async (request, response) => {
    try {
        marketingLogger.info('Entering moveUserToIb', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, ibId } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: "ADMIN" }
        }); if (!userData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const checkClient = await PlanNameModel.findByPk(userId);
        if (!checkClient) throw CustomErrorHandler.notFound("User id Not found!");

        const checkIb = await UserModel.findOne({
            where: { id: ibId, isDeleted: false, isIb: true }
        }); if(!checkIb) throw CustomErrorHandler.notFound("Ib Not Found!");

        checkClient.fromUser = ibId;
        await checkClient.save();

        marketingLogger.info('Exiting moveUserToIb: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "User Transferred to IB.",
            data: ""
        });
    } catch (e) {
        marketingLogger.error('Error in moveUserToIb', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};