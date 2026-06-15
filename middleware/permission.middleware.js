const PermissionModel = require("../models/permission.model");

const checkPermission = (requiredPermission) => {
  return async (request, response, next) => {
    try {
      const { user } = request.body;

      const permission = await PermissionModel.findOne({
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

      next();
    } catch (error) {
      console.log(error.message);
      return response.status(500).json({
        status: false,
        message: "Server error, While checking permissions!",
        data: null,
      });
    }
  };
};

module.exports = checkPermission;