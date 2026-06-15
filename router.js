"use strict";
const express = require("express");
const router = express.Router();

const adminRouter = require("./admin/router/router");
const userRouter = require("./user/router/router");
const marketingRouter = require("./marketing/router/router");

router.use("/admin", adminRouter);
router.use("/user", userRouter);
router.use("/marketing", marketingRouter);

module.exports = router;
