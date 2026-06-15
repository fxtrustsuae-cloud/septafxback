const bcrypt = require("bcrypt");
const UserModel = require("../../models/users.model");
const AdminPermissionModel = require("../../models/adminPermission.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { seedAdminPermissions } = require("../../helpers/index");
const { adminLogger } = require("../../utils/logger");

// POST /admin/admin-permission/create-admin — Super Admin creates a new Admin account
module.exports.createAdmin = async (request, response) => {
    try {
        adminLogger.info('Entering createAdmin', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, email, mobile, userName, password, country, countryCode } = request.body;

        const superAdmin = await UserModel.findOne({
            where: { id: user.id, role: "SUPER-ADMIN", isDeleted: false },
        });
        if (!superAdmin) throw CustomErrorHandler.notAllowed("Access Denied! Only Super Admin allowed.");

        const emailExists = await UserModel.findOne({ where: { email, isDeleted: false } });
        if (emailExists) throw CustomErrorHandler.alreadyExist("Email already in use!");

        const userNameExists = await UserModel.findOne({ where: { userName, isDeleted: false } });
        if (userNameExists) throw CustomErrorHandler.alreadyExist("Username already taken!");

        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await UserModel.create({
            name,
            email,
            mobile,
            userName,
            country: country || "INDIA",
            countryCode: countryCode || "+91",
            password: hashedPassword,
            role: "ADMIN",
            isDeleted: false,
        });

        await seedAdminPermissions(newAdmin.id);

        const adminData = newAdmin.toJSON();
        delete adminData.password;

        adminLogger.info('Exiting createAdmin: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Admin created successfully.",
            data: adminData,
        });
    } catch (e) {
        adminLogger.error('Error in createAdmin', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// GET /admin/admin-permission/list?userId=5
module.exports.getAdminPermission = async (request, response) => {
    try {
        adminLogger.info('Entering getAdminPermission', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { userId } = request.query;

        // Only SUPER-ADMIN can view other admin's permissions
        const superAdmin = await UserModel.findOne({
            where: { id: user.id, role: "SUPER-ADMIN", isDeleted: false },
        });
        if (!superAdmin) throw CustomErrorHandler.notAllowed("Access Denied! Only Super Admin allowed.");

        // Target admin must exist
        const targetAdmin = await UserModel.findOne({
            where: { id: userId, role: "ADMIN", isDeleted: false },
        });
        if (!targetAdmin) throw CustomErrorHandler.notFound("Admin Not Found!");

        const permissions = await AdminPermissionModel.findAll({
            where: { userId },
        });

        const permissionMap = {};
        for (const p of permissions) {
            permissionMap[p.permission] = !p.isDeleted;
        }

        adminLogger.info('Exiting getAdminPermission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Admin permissions retrieved successfully.",
            data: permissionMap,
            permissionList: permissions,
        });
    } catch (e) {
        adminLogger.error('Error in getAdminPermission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// POST /admin/admin-permission/update
module.exports.updateAdminPermission = async (request, response) => {
    try {
        adminLogger.info('Entering updateAdminPermission', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId, ...permissions } = request.body;

        // Only SUPER-ADMIN can update
        const superAdmin = await UserModel.findOne({
            where: { id: user.id, role: "SUPER-ADMIN", isDeleted: false },
        });
        if (!superAdmin) throw CustomErrorHandler.notAllowed("Access Denied! Only Super Admin allowed.");

        // Target admin must exist
        const targetAdmin = await UserModel.findOne({
            where: { id: userId, role: "ADMIN", isDeleted: false },
        });
        if (!targetAdmin) throw CustomErrorHandler.notFound("Admin Not Found!");

        for (const [permissionKey, value] of Object.entries(permissions)) {
            if (typeof value === "boolean") {
                const existingPermission = await AdminPermissionModel.findOne({
                    where: { userId, permission: permissionKey },
                });

                if (existingPermission) {
                    existingPermission.isDeleted = !value;
                    await existingPermission.save();
                } else {
                    await AdminPermissionModel.create({
                        userId,
                        permission: permissionKey,
                        isDeleted: !value,
                    });
                }
            }
        }

        adminLogger.info('Exiting updateAdminPermission: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Admin permissions updated successfully.",
            data: permissions,
        });
    } catch (e) {
        adminLogger.error('Error in updateAdminPermission', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// GET /admin/admin-permission/admin-list
module.exports.adminList = async (request, response) => {
    try {
        adminLogger.info('Entering adminList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const superAdmin = await UserModel.findOne({
            where: { id: user.id, role: "SUPER-ADMIN", isDeleted: false },
        });
        if (!superAdmin) throw CustomErrorHandler.notAllowed("Access Denied! Only Super Admin allowed.");

        const admins = await UserModel.findAll({
            where: { role: "ADMIN", isDeleted: false },
            attributes: ["id", "userName", "name", "email", "mobile", "createdAt"],
        });

        adminLogger.info('Exiting adminList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Admin list retrieved successfully.",
            data: admins,
        });
    } catch (e) {
        adminLogger.error('Error in adminList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// POST /admin/admin-permission/seed — seed permissions for an existing admin (one-time use)
module.exports.seedPermissionsForAdmin = async (request, response) => {
    try {
        adminLogger.info('Entering seedPermissionsForAdmin', { method: request.method || "", route: request.originalUrl || "" });
        const { user, userId } = request.body;

        const superAdmin = await UserModel.findOne({
            where: { id: user.id, role: "SUPER-ADMIN", isDeleted: false },
        });
        if (!superAdmin) throw CustomErrorHandler.notAllowed("Access Denied! Only Super Admin allowed.");

        const targetAdmin = await UserModel.findOne({
            where: { id: userId, role: "ADMIN", isDeleted: false },
        });
        if (!targetAdmin) throw CustomErrorHandler.notFound("Admin Not Found!");

        // Check if permissions already seeded
        const existing = await AdminPermissionModel.findOne({
            where: { userId },
        });
        if (existing) throw CustomErrorHandler.alreadyExist("Permissions already seeded for this admin!");

        await seedAdminPermissions(userId);

        adminLogger.info('Exiting seedPermissionsForAdmin: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Permissions seeded successfully for admin.",
            data: null,
        });
    } catch (e) {
        adminLogger.error('Error in seedPermissionsForAdmin', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
