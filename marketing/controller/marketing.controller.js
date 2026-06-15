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
const { marketingLogger } = require("../../utils/logger");

module.exports.addMarketingMember = async (request, response) => {
    try {
        marketingLogger.info('Entering addMarketingMember', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, password } = request.body;

        const adminData = await MarketingModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkEmail = await MarketingModel.findOne({ 
            where: { email: email.toLowerCase().trim() } 
        }); if(checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");

        const checkMobile = await MarketingModel.findOne({
            where: { mobile: mobile.trim() }
        }); if (checkMobile) throw CustomErrorHandler.alreadyExist("Your Mobile Is Already Registered!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(password, passwordSalt);
        const userName = await createMarketingUserName();
        const newMemeber = await MarketingModel.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            mobile: mobile.trim(),
            password: passwordHash,
            role: "MARKETING",
            fromManager: adminData.id,
            userName,
        });
        
        await seedPermissions("MARKETING", newMemeber.id)

        marketingLogger.info('Exiting addMarketingMember: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Marketing Member added.",
            data: newMemeber,
        });
    } catch (e) {
        marketingLogger.error('Error in addMarketingMember', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.marketingMemberList = async (request, response) => {
    try {
        marketingLogger.info('Entering marketingMemberList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const marketingData = await MarketingModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false },
        }); if (!marketingData) throw CustomErrorHandler.notAllowed("Access Denied!");

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
            role: "MARKETING",
            fromManager: marketingData.id
        };

        const { count, rows: usersList } = await MarketingModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: MarketingModel,
                    as: 'manager',
                    attributes: ['name', 'email'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
            limit,
            offset,
        });

        marketingLogger.info('Exiting marketingMemberList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in marketingMemberList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.marketingMemberById = async (request, response) => {
    try {
        marketingLogger.info('Entering marketingMemberById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await MarketingModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const memberData = await MarketingModel.findOne({
            where: { id, role: "MARKETING", fromManager: adminData.id },
            include: [
                {
                    model: MarketingModel,
                    as: 'manager',
                    attributes: ['name', 'email'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
        }); if(!memberData) throw CustomErrorHandler.notFound("Not Found!");
            
        marketingLogger.info('Exiting marketingMemberById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Marketing member Data.",
            data: memberData,
        });
    } catch (e) {
        marketingLogger.error('Error in marketingMemberById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateMarketingMember = async (request, response) => {
    try {
        marketingLogger.info('Entering updateMarketingMember', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingId, name, email, password, mobile } = request.body;

        const adminData = await MarketingModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkEmail = await MarketingModel.findOne({ 
            where: { email: email.toLowerCase().trim(), id: { [Op.ne]: marketingId } } 
        }); if(checkEmail) throw CustomErrorHandler.alreadyExist("Email Is Already Registered!");

        const checkMobile = await MarketingModel.findOne({
            where: { mobile: mobile.trim(), id: { [Op.ne]: marketingId } }
        }); if (checkMobile) throw CustomErrorHandler.alreadyExist("Mobile Is Already Registered!");

        // const checkMarketingMember = await MarketingModel.findByPk(marketingId);
        const checkMarketingMember = await MarketingModel.findOne({
            where: { id: marketingId, fromManager: adminData.id }
        }); if(!checkMarketingMember) throw CustomErrorHandler.notFound("Not Found!");

        if(password){
            const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
            const passwordHash = await bcrypt.hash(password, passwordSalt);
            checkMarketingMember.password = passwordHash;
        }
        if(name) checkMarketingMember.name = name;
        if(email) checkMarketingMember.email = email.toLowerCase().trim();
        if(mobile) checkMarketingMember.mobile = mobile.trim();

        await checkMarketingMember.save();

        marketingLogger.info('Exiting updateMarketingMember: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Updated marketing Member.",
            data: checkMarketingMember,
        });
    } catch (e) {
        marketingLogger.error('Error in updateMarketingMember', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.incentiveList = async (request, response) => {
    try {
        marketingLogger.info('Entering incentiveList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search, id } = request.query;
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

        marketingLogger.info('Exiting incentiveList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        marketingLogger.error('Error in incentiveList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.incentiveById = async (request, response) => {
    try {
        marketingLogger.info('Entering incentiveById', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: "ADMIN", isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const incentiveData = await IncentiveModel.findByPk(id);

        marketingLogger.info('Exiting incentiveById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Incentive Data.",
            data: incentiveData,
        });
    } catch (e) {
        marketingLogger.error('Error in incentiveById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadList = async (request, response) => {
    try {
        marketingLogger.info('Entering leadList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const marketingData = await MarketingModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!marketingData) throw CustomErrorHandler.notAllowed("Access Denied!");

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
        if(marketingData.role == "MARKETING") whereCondition.assignTo = marketingData.id;

        // return;
        const { count, rows: leadList } = await LeadModel.findAndCountAll({
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

        marketingLogger.info('Exiting leadList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                leadList,
            },
        });
    } catch (e) {
        marketingLogger.error('Error in leadList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadById = async (request, response) => {
    try {
        marketingLogger.info('Entering leadById', { method: request.method || "", route: request.originalUrl || "" });
        const {id } = request.params;
        const { user } = request.body;

        // Check if admin
        const marketingData = await MarketingModel.findOne({
            where: { id: user.id, isDeleted: false },
        }); if (!marketingData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const where = { id };
        if(marketingData.role == "MARKETING") where.assignTo = marketingData.id;
        const leadData = await LeadModel.findOne({
            where: { ...where },
            include: [
                {
                    model: MarketingModel,
                    as: 'sales',
                    attributes: ['name', 'email'], // Only fetch name, email, mobile
                    where: { isDeleted: false }, // Respect soft deletes in User
                    required: false
                },
            ],
        });

        marketingLogger.info('Exiting leadById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead Data.",
            data: leadData,
        });
    } catch (e) {
        marketingLogger.error('Error in leadById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addLead = async (request, response) => {
    try {
        marketingLogger.info('Entering addLead', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, country, status, source, description } = request.body;

        // Check if admin
        const adminData = await MarketingModel.findOne({
            where: { id: user.id, isDeleted: false },
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
        
        marketingLogger.info('Exiting addLead: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead added.",
            data: leadData,
        });
    } catch (e) {
        marketingLogger.error('Error in addLead', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Lead Upload 
module.exports.bulkUpload = async (request, response) => {
    try {
        marketingLogger.info('Entering bulkUpload', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await MarketingModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const csvFile = request.files?.csv?.[0]?.filename;
        if (!csvFile) throw CustomErrorHandler.notFound("CSV file not found!");

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

        marketingLogger.info('Exiting bulkUpload: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lead list uploaded.",
            inserted: uniqueLeads.length,
            skipped: skippedLeads.length,
            insertedLeads: uniqueLeads,
        });
    } catch (e) {
        marketingLogger.error('Error in bulkUpload', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadAssignTo = async (request, response) => {
    try {
        marketingLogger.info('Entering leadAssignTo', { method: request.method || "", route: request.originalUrl || "" });
        const { user, marketingMemberId, leadId } = request.body;

        const adminData = await MarketingModel.findOne({
            where: { id: user.id, role: "MANAGER", isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checkMarketingMember = await MarketingModel.findOne({
            where: { id: marketingMemberId, role: "MARKETING", isDeleted: false }
        }); if (!checkMarketingMember) throw CustomErrorHandler.notFound("MarketingMember Not Found or Deleted!");

        const checkLead = await LeadModel.findOne({
            where: { id: leadId, isDeleted: false }
        }); if (!checkLead) throw CustomErrorHandler.notFound("Lead Not Found or Deleted!");

        checkLead.assignTo = checkMarketingMember.id;
        await checkLead.save();

        marketingLogger.info('Exiting leadAssignTo: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Lead assing to ${checkMarketingMember.name}.`,
            data: checkLead,
        });
    } catch (e) {
        marketingLogger.error('Error in leadAssignTo', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.leadUpdate = async (request, response) => {
    try {
        marketingLogger.info('Entering leadUpdate', { method: request.method || "", route: request.originalUrl || "" });
        const { user, leadId, name, mobile, reminder, email, country, source, status, note, isDeleted } = request.body;

        const adminData = await MarketingModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const checekLead = await LeadModel.findByPk(leadId); 
        if(!checekLead) throw CustomErrorHandler.notFound("Lead not found!");

        if(name) checekLead.name = name;
        if(mobile) checekLead.mobile = mobile;
        if(email) checekLead.email = email;
        if(country) checekLead.country = country;
        if(source) checekLead.source = source;
        if(status) checekLead.status = status;
        if(reminder) checekLead.reminder = reminder;
        if(isDeleted) checekLead.isDeleted = isDeleted;
        
        if(note) {
            const  noteList = [...checekLead.note];
            noteList.push(
                { time: new Date(), note, reminder: reminder }
            )
            checekLead.note = noteList;
        };
        
        await checekLead.save();

        marketingLogger.info('Exiting leadUpdate: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Lead updated.",
            data: checekLead,
        });
    } catch (e) {
        marketingLogger.error('Error in leadUpdate', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getPermission = async (request, response) => {
    try {
        marketingLogger.info('Entering getPermission', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        let { userId = 0 } = request.query;

        const userData = await MarketingModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        if (userData.role === "MARKETING") userId = userData.id;

        if (userData.role === "MANAGER") {
            if (!userId || userId <= 0) userId = userData.id;
        }

        const permissions = await PermissionModel.findAll({
            where: { userId },
        });

        const permissionMap = {};
        for (const p of permissions) {
            permissionMap[p.permission] = !p.isDeleted;
        }

        marketingLogger.info('Exiting getPermission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Permissions retrieved successfully.",
            data: permissionMap,
            permissionList: permissions
        });
    } catch (e) {
        marketingLogger.error('Error in getPermission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updatePermission = async (request, response) => {
    try {
        marketingLogger.info('Entering updatePermission', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, ...permissions } = request.body;

        // Check if admin is valid
        const adminData = await MarketingModel.findOne({
            where: { id: user.id, isDeleted: false, role: "MANAGER" },
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

        marketingLogger.info('Exiting updatePermission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Permissions updated successfully.",
            data: permissions,
        });
    } catch (e) {
        marketingLogger.error('Error in updatePermission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};