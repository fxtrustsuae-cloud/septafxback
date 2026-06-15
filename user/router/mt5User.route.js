const express = require("express");
const router = express.Router();
const mt5UserValidator = require("../validator/mt5User.validator");
const mt5UserController = require("../controller/mt5User.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkPermission = require("../../middleware/permission.middleware");

router.get(
  "/group/list",
  mt5UserValidator.list,
  verifyJWTToken,
  mt5UserController.groupList
);
router.get(
  "/account/list",
  mt5UserValidator.list,
  verifyJWTToken,
  // checkPermission("list-mt5-account"),
  mt5UserController.mt5AccountList
);
router.get(
  "/account/:id", 
  mt5UserValidator.mt5AccountById, 
  verifyJWTToken, 
  mt5UserController.mt5AccountById
);
router.post(
  "/create/account",
  mt5UserValidator.addMt5Account,
  verifyJWTToken,
  // checkPermission("create-mt5-account"),
  mt5UserController.addMt5Account
);

router.get(
  "/requested/account/list",
  mt5UserValidator.list,
  verifyJWTToken,
  // checkPermission("list-mt5-account"),
  mt5UserController.requestedMt5AccountList
);

// Only for demo account
router.post(
  "/add/demo-balance",
  mt5UserValidator.demoAddBalance,
  verifyJWTToken,
  // checkPermission("create-mt5-account"),
  mt5UserController.demoAddBalance
);
router.put(
  "/update/account",
  mt5UserValidator.updateMt5User,
  verifyJWTToken,
  // checkPermission("update-mt5-account"),
  mt5UserController.updateMt5User
);
router.put(
  "/update/default-symbol",
  mt5UserValidator.updateMt5User,
  verifyJWTToken,
  // checkPermission("update-mt5-account"),
  mt5UserController.updateMt5DefaultSymbol
);
router.put(
  "/change-password",
  mt5UserValidator.updateMt5Password,
  verifyJWTToken,
  // checkPermission("update-mt5-account"),
  mt5UserController.updateMt5Password
);

router.delete(
  "/delete/account",
  mt5UserValidator.deleteUser,
  verifyJWTToken,
  mt5UserController.deleteUser
);
router.get(
  "/user/trade/status",
  mt5UserValidator.tradeStatus,
  verifyJWTToken,
  mt5UserController.tradeStatus
);
router.get(
  "/user/check/balance",
  mt5UserValidator.checkBalance,
  verifyJWTToken,
  mt5UserController.checkBalance
);

module.exports = router;
