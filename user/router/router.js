"use strict";
const express = require("express");
const router = express.Router();

const authRouter = require("./auth.route");
const userRouter = require("./user.route");
const mt5Router = require("./mt5User.route");
const tradeRouter = require("./trade.route");
const complianceRouter = require("./compliance.route");
const supportRouter = require("./support.route");
const analyticsRouter = require("./analytics.route");
const ibRouter = require("./ib.route");
const masterTraderRouter = require("./masterTrader.route");
const positionRouter = require("./position.route");

router.use("/", userRouter);
router.use("/auth", authRouter);
router.use("/mt5", mt5Router);
router.use("/trade", tradeRouter);
router.use("/compliance", complianceRouter);
router.use("/support", supportRouter);
router.use("/analytics", analyticsRouter);
router.use("/ib", ibRouter);
router.use("/master-trader", masterTraderRouter);
router.use("/position", positionRouter);

module.exports = router;
