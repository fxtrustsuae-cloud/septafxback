const express = require("express");
const router = express.Router();

const positionVlidator = require("../validator/position.validator");
const positionController = require("../controller/position.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get("/symbol", positionVlidator.getSymbolPosition, verifyJWTToken, checkAdminPermission("POSITION-SYMBOL"), positionController.getSymbolPosition);
router.get("/list", positionVlidator.positionList, verifyJWTToken, checkAdminPermission("POSITION-LIST"), positionController.positionList);
router.get("/open-order/list", positionVlidator.getOpenOrderList, verifyJWTToken, checkAdminPermission("OPEN-ORDER-LIST"), positionController.getOpenOrderList);
router.post("/close/position", positionVlidator.closeTradeByPosition, verifyJWTToken, checkAdminPermission("CLOSE-POSITION"), positionController.closeTradeByPosition);
router.post("/close/limit/order", positionVlidator.closeLimitTradeOrder, verifyJWTToken, checkAdminPermission("CLOSE-LIMIT-ORDER"), positionController.closeLimitTradeOrder);
router.get("/closed-order/list", positionVlidator.closedOrderList, verifyJWTToken, checkAdminPermission("CLOSED-ORDER-LIST"), positionController.closedOrderList);

module.exports = router;