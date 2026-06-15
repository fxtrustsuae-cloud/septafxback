const fs = require("fs");
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const userValidator = require("../validator/user.validator");
const userController = require("../controller/user.controller");
const { verifyJWTTokenMarketing } = require("../../middleware/jwt.middleware");
const checkPermission = require("../../middleware/permission.middleware");

const uploadsDir = path.join(__dirname, "../../public/bankDetails");
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

const docUploadsDir = path.join(__dirname, "../../public/documents");
try {
  if (!fs.existsSync(docUploadsDir)) {
    fs.mkdirSync(docUploadsDir, { recursive: true });
  }
} catch (error) {
  console.error(`Failed to create directory ${docUploadsDir}:`, error);
  process.exit(1);
}

// Storage configuration for documents
const docStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, docUploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG/PNG/PDF files are allowed"));
  },
});

router.post(
  "/add",
  userValidator.addUser,
  verifyJWTTokenMarketing,
  checkPermission("ADD-USER"),
  userController.addUser
);
// router.put(
//   "/update",
//   userValidator.updateUser,
//   verifyJWTTokenMarketing,
//   userController.updateUser
// );
router.get(
  "/list",
  userValidator.list,
  verifyJWTTokenMarketing,
  checkPermission("USER-LIST"),
  userController.userList
);
router.get(
  "/:id",
  userValidator.getById,
  verifyJWTTokenMarketing,
  checkPermission("USER-LIST"),
  userController.userById
);
router.post(
  "/mt5-add",
  userValidator.addMT5User,
  verifyJWTTokenMarketing,
  checkPermission("ADD-MT5-ACCOUNT"),
  userController.addMT5User
);
router.get(
  "/mt5/list",
  userValidator.list,
  verifyJWTTokenMarketing,
  checkPermission("LIST-MT5-ACCOUNT"),
  userController.mt5UserList
);
router.get(
  "/mt5/:id",
  userValidator.getById,
  verifyJWTTokenMarketing,
  checkPermission("LIST-MT5-ACCOUNT"),
  userController.mt5UserById
);

router.post(
  "/add/bank",
  userValidator.addBank,
  upload.fields([{ name: "image", maxCount: 1 }]), // This will store the image in 'public/uploads'
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.addBank
);

router.get(
  "/bank/list",
  userValidator.list,
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.bankList
);

router.get(
  "/bank/:id",
  userValidator.getById,
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.bankById
);

router.put(
  "/approve/bank",
  userValidator.approveBank,
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.approveBank
);

router.get(
  "/referral/list",
  userValidator.referralList,
  verifyJWTTokenMarketing,
  checkPermission("REFERRAL-LIST"),
  userController.referralList
);

router.post(
  "/upload/doc",
  userValidator.uploadDocument,
  docUpload.fields([
    { name: "poi", maxCount: 1 },
    { name: "poa", maxCount: 1 },
  ]),
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.uploadDocument
);

router.get(
  "/document/list",
  userValidator.list,
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.documentList
);
router.put(
  "/update/kyc",
  userValidator.approveKyc,
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.approveKyc
);
router.get(
  "/password/list",
  userValidator.list,
  verifyJWTTokenMarketing,
  checkPermission("PASSWORD-LIST"),
  userController.passwordList
);
// router.put(
//   "/password/change",
//   userValidator.changePassword,
//   verifyJWTTokenMarketing,
//   userController.changePassword
// );
// router.put(
//   "/update/mt5",
//   userValidator.updateMt5,
//   verifyJWTTokenMarketing,
//   userController.updateMt5
// );

router.get(
  "/bank/deposit/list",
  userValidator.bankDepositList,
  verifyJWTTokenMarketing,
  checkPermission("KYC"),
  userController.bankDepositList
);

// router.get(
//   "/action-tracking",
//   userValidator.list,
//   verifyJWTTokenMarketing,
//   userController.actionTrackingList
// );

// router.post(
//   "/user-assing-to",
//   userValidator.userAssignTo,
//   verifyJWTTokenMarketing,
//   userController.userAssignTo
// );

// router.post(
//   "/ib-assing-to",
//   userValidator.ibAssignTo,
//   verifyJWTTokenMarketing,
//   userController.ibAssignTo
// );

module.exports = router;
