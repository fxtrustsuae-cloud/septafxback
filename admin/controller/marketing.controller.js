const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { Readable } = require("stream");
const config = require("../../config/config");
const LeadModel = require("../../models/lead.model");
const UserModel = require("../../models/users.model");
const { seedPermissions, createMarketingUserName } = require("../../helpers/index");
const IncentiveModel = require("../../models/incentive.model");
const MarketingModel = require("../../models/marketingUser.model");
const PermissionModel = require("../../models/permission.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.addMarketingMember = async (request, response) => {
    try {
        adminLogger.info('Entering addMarketingMember', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, managerId, role, password } = request.body;
        // return;
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkEmail = await MarketingModel.findOne({ 
            where: { email: email.toLowerCase().trim() } 
        }); if(checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");

        const checkMobile = await MarketingModel.findOne({
            where: { mobile: mobile.trim() }
        }); if (checkMobile) throw CustomErrorHandler.alreadyExist("Your Mobile Is Already Registered!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(password, passwordSalt);

        if(role == "MARKETING") {
            if(!managerId) throw CustomErrorHandler.wrongCredentials("Manager id Required!");
            const checkManager = await MarketingModel.findOne({
                where: { id: managerId, role: "MANAGER" }
            }); if(!checkManager) throw CustomErrorHandler.notFound("Manager Not Found!")
        }
        const userName = await createMarketingUserName();

        const newMemeber = await MarketingModel.create({
            fromManager: managerId,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            mobile: mobile.trim(),
            password: passwordHash,
            role,
            userName
        });

        await seedPermissions(role, newMemeber.id)

        adminLogger.info('Exiting addMarketingMember: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: `${role} added.`,
            data: newMemeber,
        });
    } catch (e) {
        adminLogger.error('Error in addMarketingMember', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.marketingMemberList = async (request, response) => {
    try {
        adminLogger.info('Entering marketingMemberList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, role } = request.query;
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
                  ],
              }
            : {};

        const whereCondition = {
            ...searchCondition,
        };
        if(role) whereCondition.role = role;

        const { count, rows: usersList } = await MarketingModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: MarketingModel,
                    as: 'manager',
                    attributes: ['name', 'email'],
                    where: { isDeleted: false },
                    required: false
                },
            ],
            limit,
            offset,
        });

        adminLogger.info('Exiting marketingMemberList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Marketing member list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in marketingMemberList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.marketingMemberById = async (request, response) => {
    try {
        adminLogger.info('Entering marketingMemberById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const memberData = await MarketingModel.findByPk(id, {
            include: [
                {
                    model: MarketingModel,
                    as: 'manager',
                    attributes: ['name', 'email'],
                    where: { isDeleted: false },
                    required: false
                },
            ],
        });
            
        adminLogger.info('Exiting marketingMemberById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Marketing member Data.",
            data: memberData,
        });
    } catch (e) {
        adminLogger.error('Error in marketingMemberById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateMarketingMember = async (request, response) => {
    try {
        adminLogger.info('Entering updateMarketingMember', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingId, name, email, password, mobile, incentive, netDeposit, role, isDeleted } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        if(email) {
            const checkEmail = await MarketingModel.findOne({ 
                where: { email: email.toLowerCase().trim(), id: { [Op.ne]: marketingId } } 
            }); if(checkEmail) throw CustomErrorHandler.alreadyExist("Email Is Already Registered!");
        };
        if(mobile) {
            const checkMobile = await MarketingModel.findOne({
                where: { mobile: mobile.trim(), id: { [Op.ne]: marketingId } }
            }); if (checkMobile) throw CustomErrorHandler.alreadyExist("Mobile Is Already Registered!");
        };

        const checkMarketingMember = await MarketingModel.findByPk(marketingId);
        if(!checkMarketingMember) throw CustomErrorHandler.notFound("Marketing member Not Found!");

        if(password){
            const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
            const passwordHash = await bcrypt.hash(password, passwordSalt);
            checkMarketingMember.password = passwordHash;
        };
        
        if(name) checkMarketingMember.name = name;
        if(email) checkMarketingMember.email = email.toLowerCase().trim();
        if(mobile) checkMarketingMember.mobile = mobile.trim();
        if(incentive) checkMarketingMember.incentive = incentive;
        if(netDeposit) checkMarketingMember.netDeposit = netDeposit;
        if(role) checkMarketingMember.role = role;
        if(isDeleted) checkMarketingMember.isDeleted = isDeleted;

        await checkMarketingMember.save();

        adminLogger.info('Exiting updateMarketingMember: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Updated marketing Member.",
            data: checkMarketingMember,
        });
    } catch (e) {
        adminLogger.error('Error in updateMarketingMember', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.assignManager = async (request, response) => {
    try {
        adminLogger.info('Entering assignManager', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingId, managerId } = request.body;
    
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkManager = await MarketingModel.findOne({ 
            where: { id: managerId, role: "MANAGER" } 
        }); if(!checkManager) throw CustomErrorHandler.alreadyExist("Manager Not Found!");

        const checkMarketing = await MarketingModel.findOne({
            where: { id: marketingId, role: "MARKETING" }
        }); if (!checkMarketing) throw CustomErrorHandler.alreadyExist("Marketing Not Found!");

        checkMarketing.fromManager = checkManager.id;
        await checkMarketing.save();

        adminLogger.info('Exiting assignManager: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Assigned manager.",
            data: checkMarketing,
        });
    } catch (e) {
        adminLogger.error('Error in assignManager', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.incentiveList = async (request, response) => {
    try {
        adminLogger.info('Entering incentiveList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, id } = request.query;
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
                  ],
              }
            : {};

        const whereCondition = {
            ...searchCondition,
        };
        if(id){
            whereCondition.id = id;
        }

        const { count, rows: usersList } = await IncentiveModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        adminLogger.info('Exiting incentiveList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Incentive list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in incentiveList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.incentiveById = async (request, response) => {
    try {
        adminLogger.info('Entering incentiveById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const incentiveData = await IncentiveModel.findByPk(id);

        adminLogger.info('Exiting incentiveById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Incentive Data.",
            data: incentiveData,
        });
    } catch (e) {
        adminLogger.error('Error in incentiveById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadList = async (request, response) => {
    try {
        adminLogger.info('Entering leadList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, id } = request.query;
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
                      { mobile: { [Op.iLike]: `%${search}%` } },
                      { email: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        const whereCondition = {
            ...searchCondition,
        };

        // return;
        const { count, rows: usersList } = await LeadModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: MarketingModel,
                    as: 'sales',
                    attributes: ['name', 'email'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
            limit,
            offset,
        });

        adminLogger.info('Exiting leadList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in leadList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadById = async (request, response) => {
    try {
        adminLogger.info('Entering leadById', { method: request.method || "", route: request.originalUrl || "" });
        const {id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
            
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const leadData = await LeadModel.findByPk(id,
            {   
                include: [
                    {
                        model: MarketingModel,
                        as: 'sales',
                        attributes: ['name', 'email'], // Only fetch name, email, mobile
                        where: { isDeleted: false }, // Respect soft deletes in User
                        required: false
                    },
            
                ]
            }
        );

        adminLogger.info('Exiting leadById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead Data.",
            data: leadData,
        });
    } catch (e) {
        adminLogger.error('Error in leadById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addLead = async (request, response) => {
    try {
        adminLogger.info('Entering addLead', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, country, status, source, description } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkEmail = await LeadModel.findOne({
            where: { email }
        }); if(checkEmail) throw CustomErrorHandler.notFound("Email Already exists!");

        const checkMobile = await LeadModel.findOne({
            where: { mobile }
        }); if(checkMobile) throw CustomErrorHandler.notFound("Mobile Already exists!");

        const leadData = await LeadModel.create({
            name, 
            email, 
            mobile, 
            country: country.toUpperCase(), 
            status, 
            source, 
            description
        });
        
        adminLogger.info('Exiting addLead: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead added.",
            data: leadData,
        });
    } catch (e) {
        adminLogger.error('Error in addLead', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Lead Upload 
module.exports.bulkUpload = async (request, response) => {
    try {
        adminLogger.info('Entering bulkUpload', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const csvFile = request.files?.csv?.[0]?.filename;
        if (!csvFile) throw CustomErrorHandler.badRequest("CSV file not found!");

        const filePath = path.join(__dirname, "../../public/csv", csvFile);

        const raw = fs.readFileSync(filePath, "utf8");

        const cleaned = raw
            .split("\n")
            .map(line => line.trim().replace(/^"|"$/g, ""))
            .join("\n");

        const leads = [];

        await new Promise((resolve, reject) => {
            Readable.from([cleaned])
                .pipe(csv())
                .on("data", (row) => {
                    const { name, email, mobile, country, status, source, description } = row;
                    if (!name || !email || !mobile || !status) return;

                    leads.push({
                        name: name.trim(),
                        email: email.trim(),
                        mobile: mobile.trim(),
                        country: country?.trim() || "",
                        status: status.trim(),
                        source: source?.trim() || null,
                        description: description?.trim() || "",
                    });
                })
                .on("end", resolve)
                .on("error", reject);
        });

        fs.unlink(filePath, (err) => {
            if (err) console.error("Failed to delete uploaded CSV:", err);
        });

        if (leads.length === 0) {
            throw CustomErrorHandler.notFound("No valid leads found in CSV.");
        }

        // Check duplicates in DB
        const existingLeads = await LeadModel.findAll({
            where: {
                [Op.or]: [
                    { email: leads.map(l => l.email) },
                    { mobile: leads.map(l => l.mobile) }
                ]
            },
            attributes: ["email", "mobile"]
        });

        const existingEmails = new Set(existingLeads.map(l => l.email));
        const existingMobiles = new Set(existingLeads.map(l => l.mobile));

        const uniqueLeads = [];
        const skippedLeads = [];

        for (const lead of leads) {
            if (existingEmails.has(lead.email) || existingMobiles.has(lead.mobile)) {
                skippedLeads.push(lead);
            } else {
                uniqueLeads.push(lead);
            }
        }

        if (uniqueLeads.length === 0) {
            throw CustomErrorHandler.notAllowed("All leads are duplicates. Nothing to insert.");
        }

        await LeadModel.bulkCreate(uniqueLeads, { validate: true });

        adminLogger.info('Exiting bulkUpload: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead list uploaded.",
            inserted: uniqueLeads.length,
            skipped: skippedLeads.length,
            insertedLeads: uniqueLeads,
        });
    } catch (e) {
        adminLogger.error('Error in bulkUpload', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadAssignTo = async (request, response) => {
    try {
        adminLogger.info('Entering leadAssignTo', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingMemberId, leadId } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkMarketingMember = await MarketingModel.findOne({
            where: { id: marketingMemberId, isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        const checkLead = await LeadModel.findOne({
            where: { id: leadId, isDeleted: false }
        }); if (!checkLead) throw CustomErrorHandler.notFound("Lead Not Found or Deleted!");

        checkLead.assignTo = checkMarketingMember.id;
        await checkLead.save();

        adminLogger.info('Exiting leadAssignTo: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Lead assing to ${checkMarketingMember.name}.`,
            data: checkLead,
        });
    } catch (e) {
        adminLogger.error('Error in leadAssignTo', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadUpdate = async (request, response) => {
    try {
        adminLogger.info('Entering leadUpdate', { method: request.method || "", route: request.originalUrl || "" });
        const { user, leadId, name, mobile, email, country, source, status, description, isDeleted } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checekLead = await LeadModel.findByPk(leadId); 
        if(!checekLead) throw CustomErrorHandler.notFound("Lead not found!");

        if(name) checekLead.name = name;
        if(mobile) checekLead.mobile = mobile;
        if(email) checekLead.email = email;
        if(country) checekLead.country = country;
        if(source) checekLead.source = source;
        if(status) checekLead.status = status;
        if(description) checekLead.description = description;
        if(isDeleted) checekLead.isDeleted = isDeleted;

        await checekLead.save();

        adminLogger.info('Exiting leadUpdate: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Lead updated.",
            data: checekLead,
        });
    } catch (e) {
        adminLogger.error('Error in leadUpdate', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getPermission = async (request, response) => {
    try {
        adminLogger.info('Entering getPermission', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { userId } = request.query;

        const userData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const targetUser = await MarketingModel.findOne({
            where: { id: userId, isDeleted: false },
        });
        if (!targetUser) throw CustomErrorHandler.wrongCredentials("Marketing Member Not Found!");

        const permissions = await PermissionModel.findAll({
            where: { userId },
        });

        const permissionMap = {};
        for (const p of permissions) {
            permissionMap[p.permission] = !p.isDeleted;
        }

        adminLogger.info('Exiting getPermission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Permissions retrieved successfully.",
            data: permissionMap,
            permissionList: permissions
        });
    } catch (e) {
        adminLogger.error('Error in getPermission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updatePermission = async (request, response) => {
    try {
        adminLogger.info('Entering updatePermission', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, ...permissions } = request.body;

        // Check if admin is valid
        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } },
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        // Check if target user exists
        const checkUser = await MarketingModel.findOne({
            where: { id: userId, isDeleted: false },
        });
        if (!checkUser) throw CustomErrorHandler.notFound("Marketing Member not found!");

        // Process each permission (keys expected in kebab-case)
        for (const [permissionKey, value] of Object.entries(permissions)) {
            if (typeof value === "boolean") {
                const existingPermission = await PermissionModel.findOne({
                    where: { userId, permission: permissionKey },
                });

                if (existingPermission) {
                    existingPermission.isDeleted = !value; // false = enabled
                    await existingPermission.save();
                } else {
                    await PermissionModel.create({
                        userId,
                        permission: permissionKey,
                        isDeleted: !value,
                    });
                }
            }
        }

        adminLogger.info('Exiting updatePermission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Permissions updated successfully.",
            data: permissions,
        });
    } catch (e) {
        adminLogger.error('Error in updatePermission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.userAssignTo = async (request, response) => {
    try {
        adminLogger.info('Entering userAssignTo', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingMemberId, userIds } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkMarketingMember = await MarketingModel.findOne({
            where: { id: marketingMemberId, isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        // 3️⃣ Validate userIds array
        if (!Array.isArray(userIds) || userIds.length === 0) {
            throw CustomErrorHandler.badRequest("userIds must be a non-empty array");
        }
    
        // 4️⃣ Fetch only valid users (skip invalid automatically)
        const validUsers = await UserModel.findAll({
            where: {
                id: userIds,
                isDeleted: false,
            },
            attributes: ["id"],
        });
    
        if (validUsers.length === 0) throw CustomErrorHandler.notFound("No valid users found to assign");

        const validUserIds = validUsers.map(e => e.id);
    
        // 5️⃣ Bulk update only valid users
        const [updatedCount] = await UserModel.update(
            { assingToManager: checkMarketingMember.id },
            {
                where: {
                    id: validUserIds,
                },
            }
        );
    
        adminLogger.info('Exiting userAssignTo: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `${updatedCount} users assigned to ${checkMarketingMember.name}.`,
            skippedUsers: userIds.length - validUserIds.length,
            assignedUserIds: validUserIds,
        });
    } catch (e) {
        adminLogger.error('Error in userAssignTo', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.marketingUserAssingList = async (request, response) => {
    try {
        adminLogger.info('Entering marketingUserAssingList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { marketingMemberId, page = 1, sizePerPage = 10, search, fromDate, toDate, userId } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");
        
        const checkMarketingMember = await MarketingModel.findOne({
            where: { id: marketingMemberId, isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        let where = { assingToManager: checkMarketingMember.id };
        if (userId) where.id = userId;

        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { mobile: { [Op.iLike]: `%${search}%` } },
                { userName: { [Op.iLike]: `%${search}%` } }
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

        const { count, rows: usersList } = await UserModel.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        adminLogger.info('Exiting marketingUserAssingList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Marketing Assigned User List.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                usersList,
            },
        });
    } catch (e) {
        adminLogger.error('Error in marketingUserAssingList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
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
        adminLogger.info('Entering ibAssignTo', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingMemberId, ibId } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkMarketingMember = await MarketingModel.findOne({
            where: { id: marketingMemberId, isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        const userList = [];
        await ibReferralList(ibId, 1, userList);
        
        if(userList.length > 0) {
            for(const userId of userList){
                const checkUser = await UserModel.findByPk(userId);
                if (!checkUser) throw CustomErrorHandler.notFound("User Not Found!");
        
                checkUser.assingToManager = checkMarketingMember.id;
                await checkUser.save();
            }
        }

        const checkUser = await UserModel.findByPk(ibId);
        if (!checkUser) throw CustomErrorHandler.notFound("User Not Found!");

        checkUser.assingToManager = checkMarketingMember.id;
        await checkUser.save();

        adminLogger.info('Exiting ibAssignTo: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Ib Assigned to ${checkMarketingMember.name}.`,
            data: "",
        });
    } catch (e) {
        adminLogger.error('Error in ibAssignTo', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
