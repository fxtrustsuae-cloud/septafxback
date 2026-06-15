const express = require("express");
const router = express.Router();

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const lotsCalculationController = require("../controller/lotsCalculation.controller");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.post(
    "/upload",
    verifyJWTToken,
    checkAdminPermission("LOTS-CALCULATION-UPLOAD"),
    lotsCalculationController.uploadLotsCalculationFile,
    lotsCalculationController.uploadLotsCalculation
);

router.get(
    "/export/:sessionId",
    verifyJWTToken,
    checkAdminPermission("LOTS-CALCULATION-EXPORT"),
    lotsCalculationController.exportLotsCalculation
);

module.exports = router;
