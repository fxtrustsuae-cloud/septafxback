const express = require("express");
const router = express.Router();

const transactionValidator = require("../validator/transaction.validator");
const transactionController = require("../controller/transaction.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.post("/client/deposit", transactionValidator.metaDeposit, verifyJWTToken, checkAdminPermission("CLIENT-DEPOSIT"), transactionController.metaDeposit);
router.post("/client/withdraw", transactionValidator.metaDeposit, verifyJWTToken, checkAdminPermission("CLIENT-WITHDRAW"), transactionController.metaWithdraw);
router.post("/wallet-to-meta-deposit", transactionValidator.metaDeposit, verifyJWTToken, checkAdminPermission("WALLET-TO-META-DEPOSIT"), transactionController.walletToMetaDeposit);
router.post("/meta-to-wallet-withdraw", transactionValidator.metaDeposit, verifyJWTToken, checkAdminPermission("META-TO-WALLET-WITHDRAW"), transactionController.metaToWalletWithdraw);
router.post("/wallet/deposit", transactionValidator.walletDeposit, verifyJWTToken, checkAdminPermission("WALLET-DEPOSIT"), transactionController.walletDeposit);
router.post("/wallet/withdraw", transactionValidator.walletDeposit, verifyJWTToken, checkAdminPermission("WALLET-WITHDRAW"), transactionController.walletWithdraw);
router.post("/wallet/remove-bonus", transactionValidator.removeBonus, verifyJWTToken, checkAdminPermission("REMOVE-BONUS"), transactionController.removeBonus);
// router.put("/withdraw/app-rej", transactionValidator.approveRejectWithdraw, verifyJWTToken, transactionController.approveRejectWithdraw);
router.get("/list", transactionValidator.transactionList, verifyJWTToken, checkAdminPermission("TRANSACTION-LIST"), transactionController.transactionList);
// router.post("/internal/transfer", transactionValidator.internalTransfer, verifyJWTToken, transactionController.internalTransfer);

router.get("/deposit-withdraw/list", transactionValidator.depositWithdrawList, verifyJWTToken, checkAdminPermission("DEPOSIT-WITHDRAW-LIST"), transactionController.depositWithdrawList);
router.get("/deposit-withdraw/:id", transactionValidator.singleDepositWithdraw, verifyJWTToken, checkAdminPermission("DEPOSIT-WITHDRAW-BY-ID"), transactionController.singleDepositWithdraw);
router.put("/update/deposit-withdraw", transactionValidator.apporveRejectDepositWithdraw, verifyJWTToken, checkAdminPermission("APPROVE-REJECT-DEPOSIT-WITHDRAW"), transactionController.apporveRejectDepositWithdraw);
router.put("/update/deposit-withdraw-amount", transactionValidator.updateDepositWithdrawAmount, verifyJWTToken, checkAdminPermission("UPDATE-DEPOSIT-WITHDRAW-AMOUNT"), transactionController.updateDepositWithdrawAmount);
router.post("/ib-withdraw", transactionValidator.ibWithdraw, verifyJWTToken, checkAdminPermission("IB-WITHDRAW"), transactionController.ibWithdraw);

module.exports = router;