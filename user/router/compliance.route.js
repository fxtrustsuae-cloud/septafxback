const fs = require("fs");
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const configuration = require("../../config/config");
const complianceValidator = require("../validator/compliance.validator");
const complianceController = require("../controller/compliance.controller");
const checkPermission = require("../../middleware/permission.middleware");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");

const defaultKycDocumentMaxUploadMb = 10;
const configuredKycDocumentMaxUploadMb = Number(configuration.KYC_DOCUMENT_MAX_UPLOAD_MB);
const kycDocumentMaxUploadMb = Number.isFinite(configuredKycDocumentMaxUploadMb) && configuredKycDocumentMaxUploadMb > 0
    ? configuredKycDocumentMaxUploadMb
    : defaultKycDocumentMaxUploadMb;
const kycDocumentMaxUploadBytes = kycDocumentMaxUploadMb * 1024 * 1024;

// Bank details upload directory setup
const bankUploadsDir = path.join(__dirname, "../../public/bankDetails");
try {
    if (!fs.existsSync(bankUploadsDir)) {
        fs.mkdirSync(bankUploadsDir, { recursive: true });
    }
} catch (error) {
    console.error(`Failed to create directory ${bankUploadsDir}:`, error);
    process.exit(1);
}

// Document upload directory setup
const docUploadsDir = path.join(__dirname, "../../public/documents");
try {
    if (!fs.existsSync(docUploadsDir)) {
        fs.mkdirSync(docUploadsDir, { recursive: true });
    }
} catch (error) {
    console.error(`Failed to create directory ${docUploadsDir}:`, error);
    process.exit(1);
}

// Storage configuration for bank images
const bankStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, bankUploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

// Storage configuration for documents
const docStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, docUploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

// Multer configuration for bank images
const bankUpload = multer({
    storage: bankStorage,
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

// Multer configuration for documents
const docUpload = multer({
    storage: docStorage,
    limits: { fileSize: kycDocumentMaxUploadBytes },
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

const uploadKycDocuments = (request, response, next) => {
    const upload = docUpload.fields([
        { name: "poi", maxCount: 1 },
        { name: "poa", maxCount: 1 },
        { name: "extraDocs", maxCount: 20 }
    ]);

    upload(request, response, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? `Each document must not exceed ${kycDocumentMaxUploadMb}MB.`
                : error.message;

            return response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
                status: false,
                message,
                data: null
            });
        }

        return response.status(400).json({
            status: false,
            message: error.message || "Invalid document upload.",
            data: null
        });
    });
};

// Route for adding bank details
router.post(
    "/add/bank",
    complianceValidator.addBank,
    bankUpload.fields([{ name: "image", maxCount: 1 }]),
    verifyJWTToken,
    // checkPermission("update-bank"),
    complianceController.addBank
);

router.put(
    "/update/bank",
    complianceValidator.updateBank,
    bankUpload.fields([{ name: "image", maxCount: 1 }]),
    verifyJWTToken,
    complianceController.updateBank
);

// Route for uploading documents
router.post(
    "/upload/doc",
    uploadKycDocuments,
    verifyJWTToken,
    // checkPermission("update-kyc"),
    complianceController.uploadDocument
);

router.get("/bank/details", verifyJWTToken, complianceController.getbank);
router.get("/document/details", verifyJWTToken, complianceController.getDocument);

module.exports = router;
