const fs = require("fs");
const express = require("express");
const router = express.Router();
const validator = require("../validator/ib.validator");
const controller = require("../controller/ib.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");


router.get("/comission", validator.list, verifyJWTToken, controller.getIbComission);
router.put("/make-subib", validator.makeSubIb, verifyJWTToken, controller.makeSubIb);
router.get("/client/trx-list", validator.teamTrxReport, verifyJWTToken, controller.teamTrxReport);
router.get("/kyc-report", validator.ibKycReport, verifyJWTToken, controller.ibKycReport);//KCY
router.get("/live-account", verifyJWTToken, controller.liveAccount);
router.post("/withdraw", validator.ibWithdraw, verifyJWTToken, controller.ibWithdraw);
router.get("/ftd-report", validator.ibKycReport, verifyJWTToken, controller.ftdRefReport);

module.exports = router;
