const fs = require("fs");
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const userValidator = require("../validator/user.validator");
const userController = require("../controller/user.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkPermission = require("../../middleware/permission.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

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
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
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
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only JPEG/PNG/PDF files are allowed"));
    },
});

router.post("/add", userValidator.addUser, verifyJWTToken, checkAdminPermission("ADD-USER"), userController.addUser);
router.put("/update", userValidator.updateUser, verifyJWTToken, checkAdminPermission("UPDATE-USER"), userController.updateUser);
router.get("/list", userValidator.list, verifyJWTToken, checkAdminPermission("USER-LIST"), userController.userList);
router.get("/asset/list", verifyJWTToken, checkAdminPermission("ASSET-LIST"), userController.assetList);
router.get("/:id", userValidator.getById, verifyJWTToken, checkAdminPermission("USER-BY-ID"), userController.userById);
// router.get("/list", userValidator.list, verifyJWTToken, checkPermission("view-members"), userController.userList);
router.post("/mt5-add", userValidator.addMT5User, verifyJWTToken, checkAdminPermission("MT5-ADD-USER"), userController.addMT5User);
router.get("/mt5/list", userValidator.list, verifyJWTToken, checkAdminPermission("MT5-USER-LIST"), userController.mt5UserList);
router.get("/mt5/:id", userValidator.getById, verifyJWTToken, checkAdminPermission("MT5-USER-BY-ID"), userController.mt5UserById);

router.post(
    "/add/bank",
    userValidator.addBank,
    upload.fields([{ name: "image", maxCount: 1 }]), // This will store the image in 'public/uploads'
    verifyJWTToken,
    checkAdminPermission("ADD-BANK"),
    userController.addBank
);

router.get("/referral/list", userValidator.referralList, verifyJWTToken, checkAdminPermission("REFERRAL-LIST"), userController.referralList);
router.get("/referral/tree", userValidator.referralList, verifyJWTToken, checkAdminPermission("REFERRAL-TREE"), userController.getUserReferralTree);

router.get("/bank/list", userValidator.list, verifyJWTToken, checkAdminPermission("BANK-LIST"), userController.bankList);
router.get("/bank/:id", userValidator.getById, verifyJWTToken, checkAdminPermission("BANK-BY-ID"), userController.bankById);
router.put(
    "/update/bank",
    userValidator.updateBank,
    upload.fields([{ name: "image", maxCount: 1 }]),
    verifyJWTToken,
    checkAdminPermission("UPDATE-BANK"),
    userController.updateBank
);
router.put("/approve/bank", userValidator.approveBank, verifyJWTToken, checkAdminPermission("APPROVE-BANK"), userController.approveBank);

router.post(
    "/upload/doc",
    userValidator.uploadDocument,
    docUpload.fields([
        { name: "poi", maxCount: 1 },
        { name: "poa", maxCount: 1 },
        { name: "extraDocs", maxCount: 20 } 
    ]),
    verifyJWTToken,
    checkAdminPermission("UPLOAD-DOCUMENT"),
    userController.uploadDocument
);

router.get("/document/list", userValidator.list, verifyJWTToken, checkAdminPermission("DOCUMENT-LIST"), userController.documentList);
router.put("/update/kyc", userValidator.approveKyc, verifyJWTToken, checkAdminPermission("APPROVE-KYC"), userController.approveKyc);
router.get("/password/list", userValidator.list, verifyJWTToken, checkAdminPermission("PASSWORD-LIST"), userController.passwordList);
router.put("/password/change", userValidator.changePassword, verifyJWTToken, checkAdminPermission("CHANGE-PASSWORD"), userController.changePassword);
router.put("/update/mt5", userValidator.updateMt5, verifyJWTToken, checkAdminPermission("UPDATE-MT5"), userController.updateMt5);

router.get("/bank/deposit/list", userValidator.bankDepositList, verifyJWTToken, checkAdminPermission("BANK-DEPOSIT-LIST"), userController.bankDepositList);

router.get("/action-tracking", userValidator.list, verifyJWTToken, checkAdminPermission("ACTION-TRACKING"), userController.actionTrackingList);

router.post("/send-email", verifyJWTToken, checkAdminPermission("SEND-EMAIL"), userController.sendEmail);


module.exports = router;