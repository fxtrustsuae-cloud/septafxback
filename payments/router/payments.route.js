const express = require("express");
const router = express.Router();
const paymentController = require("../../user/controller/paymentNotification.controller");

// PayOnCoins webhook callbacks (no authentication required)
router.post("/payoncoins/invoice/webhook", paymentController.paymentNotification);
router.post("/payoncoins/withdraw/webhook", paymentController.withdrawNotification);

module.exports = router;
