const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const marketingValidator = require("../validator/marketing.validator");
const marketingController = require("../controller/marketing.controller");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

// Create CSV upload directory
const uploadsDir = path.join(__dirname, "../../public/csv");
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (error) {
    console.error(`Failed to create directory ${uploadsDir}:`, error);
    process.exit(1);
}

// Configure multer for CSV uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /csv/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only CSV files are allowed"));
    },
});

// Routes
router.post("/add-member", marketingValidator.addMarketingMember, verifyJWTToken, checkAdminPermission("MARKETING-ADD-MEMBER"), marketingController.addMarketingMember);
router.get("/member-list", marketingValidator.list, verifyJWTToken, checkAdminPermission("MARKETING-MEMBER-LIST"), marketingController.marketingMemberList);
router.get("/member/:id", marketingValidator.getById, verifyJWTToken, checkAdminPermission("MARKETING-MEMBER-BY-ID"), marketingController.marketingMemberById);
router.put("/update-member", marketingValidator.updateMarketingMember, verifyJWTToken, checkAdminPermission("MARKETING-UPDATE-MEMBER"), marketingController.updateMarketingMember);
router.put("/assing-manager", marketingValidator.assignManager, verifyJWTToken, checkAdminPermission("MARKETING-ASSIGN-MANAGER"), marketingController.assignManager);
router.get("/incentive-list", marketingValidator.list, verifyJWTToken, checkAdminPermission("MARKETING-INCENTIVE-LIST"), marketingController.incentiveList);
router.get("/incentive/:id", marketingValidator.getById, verifyJWTToken, checkAdminPermission("MARKETING-INCENTIVE-BY-ID"), marketingController.incentiveById);

router.post(
    "/bulk-upload",
    upload.fields([{ name: "csv", maxCount: 1 }]),
    verifyJWTToken,
    checkAdminPermission("MARKETING-BULK-UPLOAD"),
    marketingController.bulkUpload
);
router.post("/add-lead", marketingValidator.addLead, verifyJWTToken, checkAdminPermission("MARKETING-ADD-LEAD"), marketingController.addLead);
router.get("/lead-list", marketingValidator.list, verifyJWTToken, checkAdminPermission("MARKETING-LEAD-LIST"), marketingController.leadList);
router.get("/lead/:id", marketingValidator.getById, verifyJWTToken, checkAdminPermission("MARKETING-LEAD-BY-ID"), marketingController.leadById);

router.post("/assign-to", marketingValidator.leadAssignTo, verifyJWTToken, checkAdminPermission("MARKETING-ASSIGN-TO"), marketingController.leadAssignTo);
router.put("/update/lead", marketingValidator.leadUpdate, verifyJWTToken, checkAdminPermission("MARKETING-UPDATE-LEAD"), marketingController.leadUpdate);


router.get("/permission/list", marketingValidator.getPermission, verifyJWTToken, checkAdminPermission("MARKETING-PERMISSION-LIST"), marketingController.getPermission);
router.post("/update/permission", marketingValidator.updatePermission, verifyJWTToken, checkAdminPermission("MARKETING-UPDATE-PERMISSION"), marketingController.updatePermission);

router.post("/assign-user", marketingValidator.userAssignTo, verifyJWTToken, checkAdminPermission("MARKETING-ASSIGN-USER"), marketingController.userAssignTo);
router.get("/assign-user-list", marketingValidator.marketingUserAssingList, verifyJWTToken, checkAdminPermission("MARKETING-ASSIGN-USER-LIST"), marketingController.marketingUserAssingList);
router.post("/assign-ib", marketingValidator.ibAssignTo, verifyJWTToken, checkAdminPermission("MARKETING-ASSIGN-IB"), marketingController.ibAssignTo);
module.exports = router;
