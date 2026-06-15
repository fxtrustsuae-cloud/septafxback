const express = require("express");
const router = express.Router();

const groupValidator = require("../validator/group.validator");
const groupController = require("../controller/group.controller");

const { verifyJWTTokenMarketing } = require("../../middleware/jwt.middleware");

// router.get("/mt5/list", groupValidator.list, verifyJWTToken, groupController.mt5GroupList);
// router.post("/create", groupValidator.createGroup, verifyJWTToken, groupController.createGroup);
router.get("/list", groupValidator.list, verifyJWTTokenMarketing, groupController.groupList);
// router.get("/:id", groupValidator.getById, verifyJWTToken, groupController.singleGroup);
// router.put("/update", groupValidator.updateGroup, verifyJWTToken, groupController.updateGroup);

module.exports = router;