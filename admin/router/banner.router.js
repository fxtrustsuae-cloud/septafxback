const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const validator = require("../validator/banner.validator");
const controller = require("../controller/banner.controller");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

const uploadsDir = path.join(__dirname, "../../public/banner");
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

router.post(
    "/upload",
    validator.uploadBanner,
    upload.fields([{ name: "image", maxCount: 1 }]), // This will store the image in 'public/uploads'
    verifyJWTToken,
    checkAdminPermission("BANNER-UPLOAD"),
    controller.uploadBanner
);

router.get(
    "/notification",
    controller.getNotification
);

router.get(
    "/",
    controller.getBanner
);

router.delete(
    "/",
    validator.deleteBanner,
    verifyJWTToken,
    checkAdminPermission("BANNER-DELETE"),
    controller.deleteBanner
);

module.exports = router;
