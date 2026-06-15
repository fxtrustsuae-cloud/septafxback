const fs = require("fs");
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const userValidator = require("../validator/user.validator");
const userController = require("../controller/user.controller");
const paymentController = require("../controller/paymentNotification.controller");
const companyConfigController = require("../../admin/controller/companyConfig.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkPermission = require("../../middleware/permission.middleware");
const uploadsImgDir = path.join(__dirname, "../../public/profileImage");
const uploadsDir = path.join(__dirname, "../../public/depositWithdraw");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  console.error(`Failed to create directory ${uploadsDir}:`, error);
  process.exit(1);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir); // Use the previously defined uploadsDir
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Generate a unique filename
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG/PNG images are allowed"));
  },
});

try {
  if (!fs.existsSync(uploadsImgDir)) {
    fs.mkdirSync(uploadsImgDir, { recursive: true });
  }
} catch (error) {
  console.error(`Failed to create directory ${uploadsImgDir}:`, error);
  process.exit(1);
}
const storagImg = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsImgDir); // Use the previously defined uploadsDir
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Generate a unique filename
  },
});
const uploadImg = multer({
  storage: storagImg,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG/PNG images are allowed"));
  },
});

router.put(
  "/profile/update",
  userValidator.updateUserProfile,
  verifyJWTToken,
  // checkPermission("update-profile"),
  userController.updateUserProfile
);

router.post(
  "/create/trxpassword",
  userValidator.createTransactionPassword,
  verifyJWTToken,
  // checkPermission("transaction-password"),
  userController.createTransactionPassword
);

router.put(
  "/change/trxpassword",
  userValidator.changeTransactionPassword,
  verifyJWTToken,
  // checkPermission("transaction-password"),
  userController.changeTransactionPassword
);

router.post(
  "/add/bank/account",
  userValidator.addBankDetails,
  verifyJWTToken,
  // checkPermission("update-bank"),
  userController.addBankDetails
);

router.get(
  "/fetch/bank",
  verifyJWTToken,
  userController.getBankDetails
);

router.get(
  "/referral/list",
  verifyJWTToken,
  // checkPermission("view-referral"),
  userController.referralList
);

router.get(
  "/referral/tree",
  verifyJWTToken,
  // checkPermission("view-referral"),
  userController.getUserReferralTree
);

router.get(
  "/transaction/list",
  userValidator.transactionList,
  verifyJWTToken,
  // checkPermission("transactions-list"),
  userController.transactionList
);

router.post(
  "/bank/deposit",
  userValidator.bankDeposit,
  upload.fields([{ name: "image", maxCount: 1 }]), // This will store the image in 'public/uploads'
  verifyJWTToken,
  // checkPermission("deposit"),
  userController.bankDeposit
);

router.post(
  "/bank/withdraw",
  userValidator.bankWithdraw,
  verifyJWTToken,
  // checkPermission("withdraw"),
  userController.bankWithdraw
);

router.get(
  "/deposit-withdraw/list",
  userValidator.depositWithdrawList,
  verifyJWTToken,
  // checkPermission("transactions-list"),
  userController.depositWithdrawList
);

router.post("/ib/request", userValidator.requestIb, verifyJWTToken, userController.requestIb);
router.get("/ib/request", verifyJWTToken, userController.getRequestIb);
router.get("/updated/data", verifyJWTToken, userController.getUpdatedDetails);

router.post("/notifiaction", paymentController.paymentNotification);
router.post("/notification", paymentController.paymentNotification);
router.post("/payment/notification", paymentController.paymentNotification);
router.get("/payment/status/:orderNo", verifyJWTToken, paymentController.checkPaymentStatus);
router.post("/card/payment/notification", paymentController.cardPaymentNotification);

router.get("/yopips/trail", userController.yopipsTrail);

router.post("/meta/deposit", userValidator.metaDeposit, verifyJWTToken, userController.metaDeposit);
router.post("/meta/withdraw", userValidator.metaDeposit, verifyJWTToken, userController.metaWithdraw);
router.post("/withdraw", userValidator.withdrawUsdt, verifyJWTToken, userController.withdrawUsdt);
router.put("/update/security-method", userValidator.updateSecuriyMethod, verifyJWTToken, userController.updateSecuriyMethod);

router.put(
  "/update/profile-img",
  uploadImg.fields([{ name: "image", maxCount: 1 }]), // This will store the image in 'public/uploads'
  verifyJWTToken,
  // checkPermission("deposit"),
  userController.updateProfile
);

router.get("/ib/comission-list", userValidator.transactionList, verifyJWTToken, userController.ibComissionList);
router.post("/accept-promotional", verifyJWTToken, userController.acceptPromotion);

router.get("/payment-charges/list", companyConfigController.getPaymentCharges);

module.exports = router;
