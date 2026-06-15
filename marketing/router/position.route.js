const express = require("express");
const router = express.Router();

const positionVlidator = require("../validator/position.validator");
const positionController = require("../controller/position.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.get("/symbol", positionVlidator.getSymbolPosition, verifyJWTToken, positionController.getSymbolPosition);
router.get("/list", positionVlidator.positionList, verifyJWTToken, positionController.positionList);
router.get("/open-order/list", positionVlidator.getOpenOrderList, verifyJWTToken, positionController.getOpenOrderList);

module.exports = router;