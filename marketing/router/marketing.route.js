const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const marketingValidator = require("../validator/marketing.validator");
const marketingController = require("../controller/marketing.controller");

const checkPermission = require("../../middleware/permission.middleware");
const { verifyJWTTokenMarketing } = require("../../middleware/jwt.middleware");

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
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel";
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only CSV files are allowed"));
  },
});

// Routes
router.post(
  "/add-member",
  marketingValidator.addMarketingMember,
  verifyJWTTokenMarketing,
  checkPermission("ADD-MARKETING"),
  marketingController.addMarketingMember
);
router.get(
  "/member-list",
  marketingValidator.list,
  verifyJWTTokenMarketing,
  checkPermission("MARKETING-LIST"),
  marketingController.marketingMemberList
);
router.get(
  "/member/:id",
  marketingValidator.getById,
  verifyJWTTokenMarketing,
  checkPermission("MARKETING-BY-ID"),
  marketingController.marketingMemberById
);
router.put(
  "/update-member",
  marketingValidator.updateMarketingMember,
  verifyJWTTokenMarketing,
  checkPermission("UPDATE-MARKETING"),
  marketingController.updateMarketingMember
);
router.get(
  "/incentive-list",
  marketingValidator.list,
  verifyJWTTokenMarketing,
  marketingController.incentiveList
);
router.get(
  "/incentive/:id",
  marketingValidator.getById,
  verifyJWTTokenMarketing,
  marketingController.incentiveById
);

router.post(
  "/bulk-upload",
  upload.fields([{ name: "csv", maxCount: 1 }]),
  verifyJWTTokenMarketing,
  checkPermission("UPLOAD-LEADS"),
  marketingController.bulkUpload
);
router.post(
  "/add-lead",
  marketingValidator.addLead,
  verifyJWTTokenMarketing,
  checkPermission("ADD-LEAD"),
  marketingController.addLead
);
router.get(
  "/lead-list",
  marketingValidator.list,
  verifyJWTTokenMarketing,
  checkPermission("LEAD-LIST"),
  marketingController.leadList
);
router.get(
  "/lead/:id",
  marketingValidator.getById,
  verifyJWTTokenMarketing,
  checkPermission("LEAD-BY-ID"),
  marketingController.leadById
);

router.post(
  "/assign-to",
  marketingValidator.leadAssignTo,
  verifyJWTTokenMarketing,
  checkPermission("ASSING-LEAD"),
  marketingController.leadAssignTo
);
router.put(
  "/update/lead",
  marketingValidator.leadUpdate,
  verifyJWTTokenMarketing,
  checkPermission("UPDATE-LEAD"),
  marketingController.leadUpdate
);

router.get(
  "/permission/list",
  marketingValidator.getPermission,
  verifyJWTTokenMarketing,
//   checkPermission("PERMISSION-LIST"),
  marketingController.getPermission
);
router.post(
  "/update/permission",
  marketingValidator.updatePermission,
  verifyJWTTokenMarketing,
  checkPermission("UPDATE-PERMISSION"),
  marketingController.updatePermission
);

module.exports = router;
