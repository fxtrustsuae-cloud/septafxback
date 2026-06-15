"use strict";
const express = require("express");
const router = express.Router();
const logController = require("../controller/log.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

// Get a list of all log files (latest first)
router.get("/list", verifyJWTToken, checkAdminPermission("LOGS-LIST"), logController.listLogs);

// Download a specific log file by filename
router.get("/download/:filename", verifyJWTToken, checkAdminPermission("LOGS-DOWNLOAD"), logController.downloadLog);

// Get parsed content of a log file
router.get("/view/:filename", verifyJWTToken, checkAdminPermission("LOGS-LIST"), logController.getLogContent);

module.exports = router;
