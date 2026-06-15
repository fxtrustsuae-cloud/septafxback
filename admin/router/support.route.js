const express = require("express");
const router = express.Router();

const supportValidator = require("../validator/support.validator");
const supportController = require("../controller/support.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get("/list", supportValidator.list, verifyJWTToken, checkAdminPermission("SUPPORT-LIST"), supportController.ticketList);
router.get("/:id", supportValidator.getById, verifyJWTToken, checkAdminPermission("SUPPORT-BY-ID"), supportController.singleTicket);
router.post("/close", supportValidator.updateTicket, verifyJWTToken, checkAdminPermission("SUPPORT-CLOSE"), supportController.updateTicket);
router.put("/replay", supportValidator.replay, verifyJWTToken, checkAdminPermission("SUPPORT-REPLAY"), supportController.replay);

module.exports = router;