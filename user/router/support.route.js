const express = require("express");
const router = express.Router();

const supportValidator = require("../validator/support.validator");
const supportController = require("../controller/support.controller");
const checkPermission = require("../../middleware/permission.middleware");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.post(
  "/create",
  supportValidator.createTicket,
  verifyJWTToken,
  // checkPermission("support"),
  supportController.createTicket
);
router.get(
  "/list",
  supportValidator.list,
  verifyJWTToken,
  // checkPermission("support"),
  supportController.ticketList
);
router.get(
  "/:id",
  supportValidator.getById,
  verifyJWTToken,
  // checkPermission("support"),
  supportController.singleTicket
);
router.post(
  "/close",
  supportValidator.closeTicket,
  verifyJWTToken,
  // checkPermission("support"),
  supportController.closeTicket
);
router.put(
  "/replay",
  supportValidator.replay,
  verifyJWTToken,
  // checkPermission("support"),
  supportController.replay
);

module.exports = router;
