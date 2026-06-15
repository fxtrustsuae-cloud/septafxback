const express = require("express");
const router = express.Router();
const mt5UserValidator = require("../validator/mt5User.validator");
const mt5UserController = require("../controller/mt5User.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.get("/user", mt5UserValidator.getUser, verifyJWTToken, checkAdminPermission("MT5-GET-USER"), mt5UserController.getUser);
router.post("/user/add", mt5UserValidator.addUser, verifyJWTToken, checkAdminPermission("MT5-ADD"), mt5UserController.addUser);
router.put("/user/update", mt5UserValidator.updateUser, verifyJWTToken, checkAdminPermission("MT5-UPDATE"), mt5UserController.updateUser);
router.delete("/user/delete", mt5UserValidator.deleteUser, verifyJWTToken, checkAdminPermission("MT5-DELETE"), mt5UserController.deleteUser);
router.put("/user/change/password", mt5UserValidator.changePassword, verifyJWTToken, checkAdminPermission("MT5-CHANGE-PASSWORD"), mt5UserController.changePassword);
router.get("/user/trade/status", mt5UserValidator.tradeStatus, verifyJWTToken, checkAdminPermission("MT5-TRADE-STATUS"), mt5UserController.tradeStatus);
router.get("/user/check/balance", mt5UserValidator.checkBalance, verifyJWTToken, checkAdminPermission("MT5-CHECK-BALANCE"), mt5UserController.checkBalance);
router.post("/user/deposit/balance", mt5UserValidator.metaDeposit, verifyJWTToken, checkAdminPermission("MT5-DEPOSIT-BALANCE"), mt5UserController.metaDeposit);
router.post("/user/withdraw/balance", mt5UserValidator.metaDeposit, verifyJWTToken, checkAdminPermission("MT5-WITHDRAW-BALANCE"), mt5UserController.metaWithdraw);
router.post("/change/user", mt5UserValidator.moveMt5User, verifyJWTToken, checkAdminPermission("MT5-MOVE-USER"), mt5UserController.moveMt5User);
router.post("/import/account", mt5UserValidator.importMt5toUser, verifyJWTToken, checkAdminPermission("MT5-IMPORT-ACCOUNT"), mt5UserController.importMt5toUser);

router.get("/requested/list", mt5UserValidator.requestedMt5List, verifyJWTToken, checkAdminPermission("MT5-REQUESTED-LIST"), mt5UserController.requestedMt5List);
router.post("/requested/approve-reject", mt5UserValidator.approveRejectRequestedMt5, verifyJWTToken, checkAdminPermission("MT5-APPROVE-REJECT-REQUESTED"), mt5UserController.approveRejectRequestedMt5);


module.exports = router;
