const express = require("express");
const router = express.Router();
const masterTraderValidator = require("../validator/masterTrader.validator");
const masterTraderController = require("../controller/masterTrader.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

// Create Master Trader
router.post(
    "/create",
    masterTraderValidator.createMasterTrader,
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-CREATE"),
    masterTraderController.createMasterTrader
);

// List Master Traders
router.get(
    "/list",
    masterTraderValidator.listMasterTraders,
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-LIST"),
    masterTraderController.listMasterTraders
);

// Get Master Trader by ID
router.get(
    "/:id",
    masterTraderValidator.getMasterTraderById,
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-BY-ID"),
    masterTraderController.getMasterTraderById
);

// Get Master Trader Trade List / Deals
router.get(
    "/trade-list/:masterTraderId",
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-TRADE-LIST"),
    masterTraderController.getMasterTraderTradeList
);

// Get Master Trader Watchers (Admin)
router.get(
    "/watchers/list",
    masterTraderValidator.getMasterTraderWatchers,
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-WATCHERS-LIST"),
    masterTraderController.getMasterTraderWatchers
);

// Get Master Trader Copiers (Admin)
router.get(
    "/copiers/list",
    masterTraderValidator.getMasterTraderCopiers,
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-COPIERS-LIST"),
    masterTraderController.getMasterTraderCopiers
);

// Get Watchlist Analytics (Admin Dashboard)
router.get(
    "/watchers/analytics",
    masterTraderValidator.watchlistAnalytics,
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-WATCHERS-ANALYTICS"),
    masterTraderController.watchlistAnalytics
);


// Update Master Trader (Consolidated: Profile, Source Account, Delete)
router.put(
    "/update",
    masterTraderValidator.updateMasterTrader,
    verifyJWTToken,
    checkAdminPermission("MASTER-TRADER-UPDATE"),
    masterTraderController.updateMasterTrader
);

module.exports = router;
