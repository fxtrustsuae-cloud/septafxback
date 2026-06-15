"use strict";
const express = require("express");
const router = express.Router();

// const ibUser = require("./ibUser.route");
const authRouter = require("./auth.route");
const userRouter = require("./user.route");
// const mt5Router = require("./mt5User.route");
const groupRouter = require("./group.route");
// const dealsRouter = require("./deals.route");
// const bannerRouter = require("./banner.router");
const supportRouter = require("./support.route");
// const positionRouter = require("./position.route");
const marketingRouter = require("./marketing.route");
const dashboardRouter = require("./dashboard.route");
const transactionRouter = require("./transaction.route");

// router.use("/ib", ibUser);
// router.use("/mt5", mt5Router);
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/", marketingRouter);
router.use("/group", groupRouter);
// router.use("/deals", dealsRouter);
// router.use("/banner", bannerRouter);
router.use("/support", supportRouter);
// router.use("/position", positionRouter);
router.use("/dashboard", dashboardRouter);
router.use("/transaction", transactionRouter);

module.exports = router;
