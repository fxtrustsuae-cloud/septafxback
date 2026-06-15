const express = require("express");
const router = express.Router();

const adminPermissionValidator = require("../validator/adminPermission.validator");
const adminPermissionController = require("../controller/adminPermission.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");

// Super Admin: Create a new Admin
router.post("/create-admin", adminPermissionValidator.createAdmin, verifyJWTToken, adminPermissionController.createAdmin);

// Super Admin: Get permission list of an admin
router.get("/list", adminPermissionValidator.getAdminPermission, verifyJWTToken, adminPermissionController.getAdminPermission);

// Super Admin: Update permissions for an admin
router.post("/update", adminPermissionValidator.updateAdminPermission, verifyJWTToken, adminPermissionController.updateAdminPermission);

// Super Admin: Get all admins list
router.get("/admin-list", verifyJWTToken, adminPermissionController.adminList);

// Super Admin: Seed permissions for an existing admin
router.post("/seed", adminPermissionValidator.seedPermissions, verifyJWTToken, adminPermissionController.seedPermissionsForAdmin);

module.exports = router;
