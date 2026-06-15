const AdminPermissionModel = require("../models/adminPermission.model");

const checkAdminPermission = (requiredPermission) => {
    return async (request, response, next) => {
        try {
            const { user } = request.body;

            // SUPER-ADMIN bypasses all permission checks
            if (user.role === "SUPER-ADMIN") {
                return next();
            }

            // ADMIN must have the specific permission enabled
            if (user.role === "ADMIN") {
                const permission = await AdminPermissionModel.findOne({
                    where: {
                        userId: user.id,
                        permission: requiredPermission,
                        isDeleted: false,
                    },
                });

                if (!permission) {
                    return response.status(403).json({
                        status: false,
                        message: "Permission, Access Denied!",
                        data: null,
                    });
                }

                return next();
            }

            // Any other role — deny
            return response.status(403).json({
                status: false,
                message: "Access Denied!",
                data: null,
            });
        } catch (error) {
            console.log(error.message);
            return response.status(500).json({
                status: false,
                message: "Server error, While checking admin permissions!",
                data: null,
            });
        }
    };
};

module.exports = checkAdminPermission;
