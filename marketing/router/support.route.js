const express = require("express");
const router = express.Router();

const supportValidator = require("../validator/support.validator");
const supportController = require("../controller/support.controller");

const { verifyJWTTokenMarketing } = require("../../middleware/jwt.middleware");

router.get("/list", supportValidator.list, verifyJWTTokenMarketing, supportController.ticketList);
router.get("/:id", supportValidator.getById, verifyJWTTokenMarketing, supportController.singleTicket);
router.post("/close", supportValidator.updateTicket, verifyJWTTokenMarketing, supportController.updateTicket);
router.put("/replay", supportValidator.replay, verifyJWTTokenMarketing, supportController.replay);

module.exports = router;