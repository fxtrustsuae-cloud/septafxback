const express = require("express");
const router = express.Router();
const analyticsController = require("../controller/analytics.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.get("/economics-calender", analyticsController.echonomicsCalander);
router.get("/chart", verifyJWTToken, analyticsController.getSymbolChart);
router.get("/price", verifyJWTToken, analyticsController.getSymbolPrice);

module.exports = router;
