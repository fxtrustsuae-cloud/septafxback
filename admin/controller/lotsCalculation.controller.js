const { Op } = require("sequelize");
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const UserModel = require("../../models/users.model");
const { processTradeFile } = require("../../lots calulations/backend/processor");
const { generateExcelReport } = require("../../lots calulations/backend/exporter");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

const TMP_DIR = path.join(os.tmpdir(), "flexy-lots-calculation-tmp");
if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

const sessions = new Map();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}_${file.originalname}`),
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if ([".xlsx", ".xls", ".csv"].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("Only Excel (.xlsx, .xls) and CSV files are allowed"));
        }
    },
});

module.exports.uploadLotsCalculationFile = upload.single("file");

module.exports.uploadLotsCalculation = async (request, response) => {
    try {
        /*
            #swagger.tags = ['Lots Calculation']
            #swagger.summary = 'Upload lots calculation file'
            #swagger.consumes = ['multipart/form-data']
            #swagger.parameters['file'] = {
                in: 'formData',
                type: 'file',
                required: true,
                description: 'Excel or CSV file to process'
            }
            #swagger.parameters['startDate'] = { in: 'formData', type: 'string', required: false }
            #swagger.parameters['endDate'] = { in: 'formData', type: 'string', required: false }
            #swagger.parameters['scalpingTimeLimit'] = { in: 'formData', type: 'string', required: false }
        */
        adminLogger.info('Entering uploadLotsCalculation', { method: request.method || "", route: request.originalUrl || "" });
        
        // Prevent crashes if user is not in body (e.g. wiped by multer)
        const user = request.body?.user || request.user;
        if (!user || !user.id) {
            throw CustomErrorHandler.unAuthorized("User not authenticated or token missing.");
        }

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } },
        });
        if (!adminData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        if (!request.file) {
            throw CustomErrorHandler.badRequest("No file uploaded. Please ensure you are sending a multipart/form-data request with a 'file' field.");
        }

        const startDate = request.body.startDate || null;
        const endDate = request.body.endDate || null;

        let scalpingTimeLimit = Number(request.body.scalpingTimeLimit);
        if (!Number.isFinite(scalpingTimeLimit) || scalpingTimeLimit <= 0) {
            scalpingTimeLimit = 3;
        }

        const result = await processTradeFile(
            request.file.path,
            startDate,
            endDate,
            scalpingTimeLimit
        );

        const sessionId = uuidv4();
        sessions.set(sessionId, result);

        if (sessions.size > 20) {
            const oldestKey = sessions.keys().next().value;
            sessions.delete(oldestKey);
        }

        fs.unlink(request.file.path, () => {});

        adminLogger.info('Exiting uploadLotsCalculation: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Lots calculation processed successfully.",
            data: {
                sessionId,
                ...result,
            },
        });
    } catch (e) {
        adminLogger.error('Error in uploadLotsCalculation', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        if (request.file?.path) {
            fs.unlink(request.file.path, () => {});
        }
        handleErrorResponse(e, response);
    }
};

module.exports.exportLotsCalculation = async (request, response) => {
    try {
        adminLogger.info('Entering exportLotsCalculation', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { sessionId } = request.params;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } },
        });
        if (!adminData) throw CustomErrorHandler.wrongCredentials("Access Denied!");

        const data = sessions.get(sessionId);
        if (!data) {
            throw CustomErrorHandler.notFound("Session not found or expired.");
        }

        const reportPath = await generateExcelReport(data, TMP_DIR);
        return response.download(reportPath, "lots_calculation_report.xlsx", () => {
            fs.unlink(reportPath, () => {});
        });
    } catch (e) {
        adminLogger.error('Error in exportLotsCalculation', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
