const express = require("express");
const router = express.Router();
const mt5UserValidator = require("../validator/mt5User.validator");
const mt5UserController = require("../controller/mt5User.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.get("/user", mt5UserValidator.getUser, verifyJWTToken, mt5UserController.getUser);
router.post("/user/add", mt5UserValidator.addUser, verifyJWTToken, mt5UserController.addUser);
router.put("/user/update", mt5UserValidator.updateUser, verifyJWTToken, mt5UserController.updateUser);
router.delete("/user/delete", mt5UserValidator.deleteUser, verifyJWTToken, mt5UserController.deleteUser);
router.put("/user/change/password", mt5UserValidator.changePassword, verifyJWTToken, mt5UserController.changePassword);
router.get("/user/trade/status", mt5UserValidator.tradeStatus, verifyJWTToken, mt5UserController.tradeStatus);
router.get("/user/check/balance", mt5UserValidator.checkBalance, verifyJWTToken, mt5UserController.checkBalance);
router.post("/user/deposit/balance", mt5UserValidator.metaDeposit, verifyJWTToken, mt5UserController.metaDeposit);
router.post("/user/withdraw/balance", mt5UserValidator.metaDeposit, verifyJWTToken, mt5UserController.metaWithdraw);
router.post("/import/account", mt5UserValidator.importMt5toUser, verifyJWTToken, mt5UserController.importMt5toUser);


module.exports = router;
