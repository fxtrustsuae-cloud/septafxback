const express = require("express");
const router = express.Router();
const ibUserValidator = require("../validator/ibUser.validator");
const ibUserController = require("../controller/ibUser.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get("/list", ibUserValidator.ibList, verifyJWTToken, checkAdminPermission("IB-LIST"), ibUserController.ibList);
router.put("/update", ibUserValidator.updateIb, verifyJWTToken, checkAdminPermission("IB-UPDATE"), ibUserController.updateIb);
router.post("/add/plan-name", ibUserValidator.addIbComissionPlan, verifyJWTToken, checkAdminPermission("IB-ADD-PLAN-NAME"), ibUserController.addIbComissionPlan);
router.get("/plan-name/list", ibUserValidator.IbComissionPlanNameList, verifyJWTToken, checkAdminPermission("IB-PLAN-NAME-LIST"), ibUserController.IbComissionPlanNameList);
router.post("/add/plan", ibUserValidator.addPlan, verifyJWTToken, checkAdminPermission("IB-ADD-PLAN"), ibUserController.addPlan);
router.get("/plan/list", ibUserValidator.list, verifyJWTToken, checkAdminPermission("IB-PLAN-LIST"), ibUserController.ibPlanList);
router.put("/update/plan", ibUserValidator.updatePlan, verifyJWTToken, checkAdminPermission("IB-UPDATE-PLAN"), ibUserController.updatePlan);
router.post("/set/sub-ib-comission", ibUserValidator.setSubIbComission, verifyJWTToken, checkAdminPermission("IB-SET-SUB-COMMISSION"), ibUserController.setSubIbComission);
router.put("/update/sub-ib-comission", ibUserValidator.updateSubIbComission, verifyJWTToken, checkAdminPermission("IB-UPDATE-SUB-COMMISSION"), ibUserController.updateSubIbComission);
router.get("/sub-ib-comission/list", ibUserValidator.subIbComissionList, verifyJWTToken, checkAdminPermission("IB-SUB-COMMISSION-LIST"), ibUserController.subIbComissionList);
router.post("/user/move-to-ib", ibUserValidator.moveUserToIb, verifyJWTToken, checkAdminPermission("IB-MOVE-USER"), ibUserController.moveUserToIb);
router.post("/remove/user-from-ib", ibUserValidator.removeUserFromIb, verifyJWTToken, checkAdminPermission("IB-REMOVE-USER"), ibUserController.removeUserFromIb);
router.get("/comission/trx-list", ibUserValidator.list, verifyJWTToken, checkAdminPermission("IB-COMMISSION-TRX-LIST"), ibUserController.ibComissionList);
router.get("/report", ibUserValidator.ibReport, verifyJWTToken, checkAdminPermission("IB-REPORT"), ibUserController.ibReport);
router.post("/distribute", ibUserValidator.manualDistribute, verifyJWTToken, checkAdminPermission("IB-MANUAL-DISTRIBUTION"), ibUserController.manualDistributeCommission);
router.get("/order/list", ibUserValidator.mt5OrderList, verifyJWTToken, checkAdminPermission("IB-COMMISSION-TRX-LIST"), ibUserController.mt5OrderList);

module.exports = router;