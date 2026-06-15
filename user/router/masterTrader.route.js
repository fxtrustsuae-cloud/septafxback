const fs = require("fs");
const path = require("path");
const multer = require("multer");
const express = require("express");
const router = express.Router();
const masterTraderController = require("../controller/masterTrader.controller");
const masterTraderValidator = require("../validator/masterTrader.validator");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");

// ── Photo upload helpers ────────────────────────────────────────────────────
const photoUploadDir = path.join(__dirname, "../../public/masterTraderProfile");
if (!fs.existsSync(photoUploadDir)) fs.mkdirSync(photoUploadDir, { recursive: true });

const photoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, photoUploadDir),
    filename: (_req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const imageFileFilter = (_req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())
        && /image\/(jpeg|png|webp)/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Only JPEG/PNG/WebP images are allowed"));
};
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });
const uploadCoverPhoto = multer({ storage: photoStorage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: imageFileFilter });

// Get Master Traders List (Discovery)
router.get(
    "/list",
    masterTraderValidator.masterTraderList,
    verifyJWTToken,
    masterTraderController.masterTraderList
);

// Get Master Trader Detail
router.get(
    "/detail",
    masterTraderValidator.getMasterTraderDetail,
    verifyJWTToken,
    masterTraderController.getMasterTraderDetail
);

// Submit / Update Master Trader Review
router.post(
    "/review",
    masterTraderValidator.submitMasterTraderReview,
    verifyJWTToken,
    masterTraderController.submitMasterTraderReview
);

// Delete Master Trader Review
router.delete(
    "/review/:masterTraderId",
    masterTraderValidator.deleteMasterTraderReview,
    verifyJWTToken,
    masterTraderController.deleteMasterTraderReview
);

// Get Master Trader Reviews List
router.get(
    "/reviews/:masterTraderId",
    masterTraderValidator.getMasterTraderReviews,
    verifyJWTToken,
    masterTraderController.getMasterTraderReviews
);

// Watch Master Trader
router.post(
    "/watch",
    masterTraderValidator.watchMasterTrader,
    verifyJWTToken,
    masterTraderController.watchMasterTrader
);

// Unwatch Master Trader
router.delete(
    "/unwatch/:masterTraderId",
    masterTraderValidator.unwatchMasterTrader,
    verifyJWTToken,
    masterTraderController.unwatchMasterTrader
);

// Get My Watchlist
router.get(
    "/my-watchlist",
    masterTraderValidator.getMyWatchlist,
    verifyJWTToken,
    masterTraderController.getMyWatchlist
);

// Toggle Watchlist Notifications
router.put(
    "/watchlist/notification",
    masterTraderValidator.toggleWatchlistNotifications,
    verifyJWTToken,
    masterTraderController.toggleWatchlistNotifications
);

// Subscribe to Master Trader
router.post(
    "/subscribe",
    masterTraderValidator.subscribeMasterTrader,
    verifyJWTToken,
    masterTraderController.subscribeMasterTrader
);


// Unsubscribe from Master Trader
router.post(
    "/unsubscribe",
    masterTraderValidator.unsubscribeMasterTrader,
    verifyJWTToken,
    masterTraderController.unsubscribeMasterTrader
);

// Get My Subscriptions
router.get(
    "/my-subscriptions",
    masterTraderValidator.getMySubscriptions,
    verifyJWTToken,
    masterTraderController.getMySubscriptions
);

// Update Subscription Settings
router.put(
    "/subscription/settings",
    masterTraderValidator.updateSubscriptionSettings,
    verifyJWTToken,
    masterTraderController.updateSubscriptionSettings
);

// Pause Subscription
router.post(
    "/subscription/pause",
    masterTraderValidator.pauseSubscription,
    verifyJWTToken,
    masterTraderController.pauseSubscription
);

// Resume Subscription
router.post(
    "/subscription/resume",
    masterTraderValidator.resumeSubscription,
    verifyJWTToken,
    masterTraderController.resumeSubscription
);

// Unified Subscription Update (settings / pause / resume / unsubscribe)
router.put(
    "/subscription/update",
    masterTraderValidator.updateSubscription,
    verifyJWTToken,
    masterTraderController.updateSubscription
);

// Get Master Trader Trade List / Deals
router.get(
    "/trade-list/:masterTraderId",
    verifyJWTToken,
    masterTraderController.getMasterTraderTradeList
);

// Get Master Trader Copiers List
router.get(
    "/copiers/:masterTraderId",
    masterTraderValidator.getMasterTraderCopiers,
    verifyJWTToken,
    masterTraderController.getMasterTraderCopiers
);

// Get My Master Trader Profile (self-service)
router.get(
    "/my-profile",
    masterTraderValidator.getMyMasterTraderProfile,
    verifyJWTToken,
    masterTraderController.getMyMasterTraderProfile
);

// Update My Master Trader Profile (self-service)
router.put(
    "/my-profile",
    masterTraderValidator.updateMyMasterTraderProfile,
    verifyJWTToken,
    masterTraderController.updateMyMasterTraderProfile
);

// Upload My Master Trader Profile Photo (self-service)
router.put(
    "/my-profile/photo",
    verifyJWTToken,
    uploadPhoto.single("photo"),
    masterTraderController.uploadMyMasterTraderPhoto
);

// Upload My Master Trader Cover Photo (self-service)
router.put(
    "/my-profile/cover-photo",
    verifyJWTToken,
    uploadCoverPhoto.single("coverPhoto"),
    masterTraderController.uploadMyMasterTraderCoverPhoto
);

// Get Master Trader Detail by ID
router.get(
    "/:masterTraderId",
    masterTraderValidator.getMasterTraderById,
    verifyJWTToken,
    masterTraderController.getMasterTraderDetail
);

module.exports = router;
