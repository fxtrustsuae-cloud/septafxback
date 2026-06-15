const express = require("express");
const router = express.Router();
const ibUserValidator = require("../validator/ibUser.validator");
const ibUserController = require("../controller/ibUser.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.get("/list", ibUserValidator.ibList, verifyJWTToken, ibUserController.ibList);
router.put("/update", ibUserValidator.updateIb, verifyJWTToken, ibUserController.updateIb);
router.post("/add/plan", ibUserValidator.addPlan, verifyJWTToken, ibUserController.addPlan);
router.get("/plan/list", ibUserValidator.list, verifyJWTToken, ibUserController.ibPlanList);
router.post("/add/comission/group", ibUserValidator.addComissionGroup, verifyJWTToken, ibUserController.addComissionGroup);
router.get("/comission/group/list", ibUserValidator.list, verifyJWTToken, ibUserController.comissionGroupList);
router.put("/update/comission/group", ibUserValidator.updateComissionGroup, verifyJWTToken, ibUserController.updateComissionGroup);
router.post("/add/user/comission/group", ibUserValidator.addUserComissionGroup, verifyJWTToken, ibUserController.addUserComissionGroup);
router.post("/user/move-to-ib", ibUserValidator.moveUserToIb, verifyJWTToken, ibUserController.moveUserToIb);

module.exports = router;