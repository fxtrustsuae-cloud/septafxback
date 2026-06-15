const express = require("express");
const router = express.Router();

const transactionValidator = require("../validator/transaction.validator");
const transactionController = require("../controller/transaction.controller");

const checkPermission = require("../../middleware/permission.middleware");
const { verifyJWTTokenMarketing } = require("../../middleware/jwt.middleware");

// router.post(
//   "/client/deposit",
//   transactionValidator.metaDeposit,
//   verifyJWTTokenMarketing,
//   checkPermission("DEPOSIT-WITHDRAWL-LIST"),
//   transactionController.metaDeposit
// );
// router.post(
//   "/client/withdraw",
//   transactionValidator.metaDeposit,
//   verifyJWTTokenMarketing,
//   checkPermission("DEPOSIT-WITHDRAWL-LIST"),
//   transactionController.metaWithdraw
// );
// router.post(
//   "/wallet/deposit",
//   transactionValidator.walletDeposit,
//   verifyJWTTokenMarketing,
//   checkPermission("DEPOSIT-WITHDRAWL-LIST"),
//   transactionController.walletDeposit
// );
// router.post(
//   "/wallet/withdraw",
//   transactionValidator.walletDeposit,
//   verifyJWTTokenMarketing,
//   checkPermission("DEPOSIT-WITHDRAWL-LIST"),
//   transactionController.walletWithdraw
// );

router.get(
  "/list",
  transactionValidator.transactionList,
  verifyJWTTokenMarketing,
  checkPermission("TRANSACTION-LIST"),
  transactionController.transactionList
);
// router.post(
//   "/internal/transfer",
//   transactionValidator.internalTransfer,
//   verifyJWTTokenMarketing,
//   transactionController.internalTransfer
// );

router.get(
  "/deposit-withdraw/list",
  transactionValidator.depositWithdrawList,
  verifyJWTTokenMarketing,
  checkPermission("DEPOSIT-WITHDRAWL-LIST"),
  transactionController.depositWithdrawList
);
router.get(
  "/deposit-withdraw/:id",
  transactionValidator.singleDepositWithdraw,
  verifyJWTTokenMarketing,
  checkPermission("DEPOSIT-WITHDRAWL-LIST"),
  transactionController.singleDepositWithdraw
);
// router.put(
//   "/update/deposit-withdraw",
//   transactionValidator.apporveRejectDepositWithdraw,
//   verifyJWTTokenMarketing,
//   transactionController.apporveRejectDepositWithdraw
// );

module.exports = router;
