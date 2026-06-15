const express = require("express");
const router = express.Router();
const riskManagementController = require("../controller/riskManagement.controller");
const riskManagementValidator = require("../validator/riskManagement.validator");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get(
  "/dashboard",
  riskManagementValidator.dashboard,
  verifyJWTToken,
  checkAdminPermission("POSITION-LIST"),
  riskManagementController.dashboard
);

router.get(
  "/profit-risk",
  riskManagementValidator.dashboard,
  verifyJWTToken,
  checkAdminPermission("POSITION-LIST"),
  riskManagementController.profitRiskReport
);

router.get(
  "/scalping",
  riskManagementValidator.dashboard,
  verifyJWTToken,
  checkAdminPermission("POSITION-LIST"),
  riskManagementController.scalpingReport
);

router.post(
  "/:login/leverage",
  riskManagementValidator.updateLeverage,
  verifyJWTToken,
  checkAdminPermission("UPDATE-MT5"),
  riskManagementController.updateLeverage
);

router.post(
  "/:login/close-all",
  riskManagementValidator.closeAllPositions,
  verifyJWTToken,
  checkAdminPermission("CLOSE-POSITION"),
  riskManagementController.closeAllPositions
);

module.exports = router;
