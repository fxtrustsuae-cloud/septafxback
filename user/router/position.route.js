const express = require("express");
const router = express.Router();

const positionValidator = require("../../admin/validator/position.validator");
const positionController = require("../controller/posotions.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.get("/symbol", positionValidator.getSymbolPosition, verifyJWTToken, positionController.getSymbolPosition);
router.get("/list", positionValidator.positionList, verifyJWTToken, positionController.positionList);
router.get("/open-order/list", positionValidator.getOpenOrderList, verifyJWTToken, positionController.getOpenOrderList);

module.exports = router;
