const express = require("express");
const router = express.Router();

const controller = require("../controller/dashboard.controller");

const { verifyJWTTokenMarketing } = require("../../middleware/jwt.middleware");

router.get("/", verifyJWTTokenMarketing, controller.dashboard);
// router.get("/transaction", verifyJWTToken, controller.transactionDashboard);
router.get("/user", verifyJWTTokenMarketing, controller.userDashboard);

module.exports = router;