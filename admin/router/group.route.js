const express = require("express");
const router = express.Router();

const groupValidator = require("../validator/group.validator");
const groupController = require("../controller/group.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get("/mt5/list", groupValidator.list, verifyJWTToken, checkAdminPermission("MT5-GROUP-LIST"), groupController.mt5GroupList);
router.get("/mt5/sync", verifyJWTToken, checkAdminPermission("MT5-GROUP-LIST"), groupController.syncMt5Groups);
router.post("/create", groupValidator.createGroup, verifyJWTToken, checkAdminPermission("GROUP-CREATE"), groupController.createGroup);
router.get("/list", groupValidator.list, verifyJWTToken, checkAdminPermission("GROUP-LIST"), groupController.groupList);
router.get("/:id", groupValidator.getById, verifyJWTToken, checkAdminPermission("GROUP-BY-ID"), groupController.singleGroup);
router.put("/update", groupValidator.updateGroup, verifyJWTToken, checkAdminPermission("GROUP-UPDATE"), groupController.updateGroup);

module.exports = router;