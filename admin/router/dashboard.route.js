const express = require("express");
const router = express.Router();

const controller = require("../controller/dashboard.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get("/", verifyJWTToken, checkAdminPermission("DASHBOARD"), controller.dashboard);
router.get("/transaction", verifyJWTToken, checkAdminPermission("TRANSACTION-DASHBOARD"), controller.transactionDashboard);
router.get("/user", verifyJWTToken, checkAdminPermission("USER-DASHBOARD"), controller.userDashboard);
router.post("/app-setting", verifyJWTToken, checkAdminPermission("APP-SETTING"), controller.appSetting);
router.get("/app-setting", controller.getAppSetting);

module.exports = router;