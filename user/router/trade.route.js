const express = require("express");
const router = express.Router();
const tradeValidator = require("../validator/trade.validator");
const tradeController = require("../controller/trade.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkPermission = require("../../middleware/permission.middleware");

router.post(
  "/deposit/balance",
  tradeValidator.metaDeposit,
  verifyJWTToken,
  // checkPermission("deposit"),
  tradeController.metaDeposit
);
router.post(
  "/withdraw/balance",
  tradeValidator.metaDeposit,
  verifyJWTToken,
  // checkPermission("withdraw"),
  tradeController.metaWithdraw
);
router.post(
  "/send/trade/request",
  tradeValidator.sendTrade,
  verifyJWTToken,
  // checkPermission("trade"),
  tradeController.sendTrade
);
router.post(
  "/close/position",
  tradeValidator.closePosition,
  verifyJWTToken,
  // checkPermission("trade"),
  tradeController.closeTradeByPosition
);
router.post(
  "/limit/order",
  tradeValidator.limitTradeRequest,
  verifyJWTToken,
  // checkPermission("trade"),
  tradeController.limitTradeOrder
);
router.post(
  "/modify/order",
  tradeValidator.modifyTradeRequest,
  verifyJWTToken,
  // checkPermission("trade"),
  tradeController.modifyTradeOrder
);
router.post(
  "/close/limit/order",
  tradeValidator.closeLimitTradeRequest,
  verifyJWTToken,
  // checkPermission("trade"),
  tradeController.closeLimitTradeOrder
);
router.get(
  "/check/balance",
  tradeValidator.checkBalance,
  verifyJWTToken,
  tradeController.checkBalance
);

router.get(
  "/closed/order-list",
  tradeValidator.closedOrderList,
  verifyJWTToken,
  tradeController.closedOrderList
);

router.get(
  "/bot/list",
  tradeValidator.botList,
  verifyJWTToken,
  tradeController.botList
);

router.post(
  "/update/watchlist",
  tradeValidator.updateWatchList,
  verifyJWTToken,
  tradeController.updateWatchList
);

router.get(
  "/watchlist",
  verifyJWTToken,
  tradeController.getWatchList
);

module.exports = router;
