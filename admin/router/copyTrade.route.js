const express = require("express");
const router = express.Router();
const copyTradeController = require("../controller/copyTrade.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

// List Copy Trade Subscriptions
router.get(
    "/subscriptions/list",
    verifyJWTToken,
    checkAdminPermission("COPY-TRADE-SUBSCRIPTIONS-LIST"),
    copyTradeController.listCopyTradeSubscriptions
);

// Get Single Copy Trade Subscription
router.get(
    "/subscriptions/:id",
    verifyJWTToken,
    checkAdminPermission("COPY-TRADE-SUBSCRIPTION-BY-ID"),
    copyTradeController.getCopyTradeSubscription
);

// Pause Copy Trade Subscription
router.post(
    "/subscriptions/pause",
    verifyJWTToken,
    checkAdminPermission("COPY-TRADE-PAUSE"),
    copyTradeController.pauseCopyTradeSubscription
);

// Resume Copy Trade Subscription
router.post(
    "/subscriptions/resume",
    verifyJWTToken,
    checkAdminPermission("COPY-TRADE-RESUME"),
    copyTradeController.resumeCopyTradeSubscription
);

// Delete Copy Trade Subscription
router.delete(
    "/subscriptions/:id",
    verifyJWTToken,
    checkAdminPermission("COPY-TRADE-DELETE"),
    copyTradeController.deleteCopyTradeSubscription
);

// Get Subscription Statistics
router.get(
    "/stats",
    verifyJWTToken,
    checkAdminPermission("COPY-TRADE-STATS"),
    copyTradeController.getSubscriptionStats
);

module.exports = router;
