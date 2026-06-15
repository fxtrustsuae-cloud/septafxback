const { Op } = require("sequelize");
const AdminModel = require("../../models/users.model");
const BannerModel = require("../../models/banner.model");
const { actionTracking } = require("../../helpers/index");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.uploadBanner = async (req, res) => {
    try {
        adminLogger.info('Entering uploadBanner', { method: req.method || "", route: req.originalUrl || "" });
        const { user } = req.body;
        const { title } = req.query;

        const userData = await AdminModel.findOne({
            where: {
                id: user.id,
                role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] },
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const newBanner = await BannerModel.create({
            title,
            image: req.files["image"][0].filename,
            admin: userData.id
        });
        
        actionTracking(request, userData.id, "BANNER-UPDATED");
        adminLogger.info('Exiting uploadBanner: Request Processed', { method: req.method || "", route: req.originalUrl || "" });
        return res.json({
            status: true,
            message: "Banner Updated.",
            data: newBanner,
        });
    } catch (e) {
        adminLogger.error('Error in uploadBanner', { stack: e.stack || e, method: req.method || "", route: req.originalUrl || "" });
        handleErrorResponse(e, res);
    }
};

module.exports.getBanner = async (request, response) => {
    try {
        adminLogger.info('Entering getBanner', { method: request.method || "", route: request.originalUrl || "" });

        const banner = await BannerModel.findOne({
            where: { isDeleted: false },
        });
        if(!banner) {
            adminLogger.info('Exiting getBanner: Request Processed (Not Found)', { method: request.method || "", route: request.originalUrl || "" });
            return response.json({
                status: false,
                message: "Not Found!",
                data: null,
            });
        }

        const host = `${request.protocol}://${request.get("host")}`;
        banner.image = `${host}/public/banner/${banner.image}`

        adminLogger.info('Exiting getBanner: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Banner.",
            data: banner,
        });
    } catch (e) {
        adminLogger.error('Error in getBanner', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.deleteBanner = async (request, response) => {
    try {
        adminLogger.info('Entering deleteBanner', { method: request.method || "", route: request.originalUrl || "" });
        const { user, bannerId } = request.body;

        const checkAdmin = await AdminModel.findOne({
            where: {
                id: user.id,
                role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] },
                isDeleted: false,
            }
        });

        if (!checkAdmin) throw CustomErrorHandler.notAllowed("Access Denied!");

        const bannerData = await BannerModel.findOne({
            where: {
                id: bannerId,
                isDeleted: false,
            }
        });

        if (!bannerData) {
            adminLogger.info('Exiting deleteBanner: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(404).json({
                status: false,
                message: "Banner not found or deleted",
                data: null,
            });
        }

        bannerData.isDeleted = true;
        bannerData.save();

        adminLogger.info('Exiting deleteBanner: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Banner Deleted successfully",
            data: bannerData,
        });
    } catch (error) {
        adminLogger.error('Error in deleteBanner', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
        response.status(500).json({
            status: false,
            message: "Failed to delete banner",
            data: null,
        });
    }
};

module.exports.getNotification = async (request, response) => {
    try {
        adminLogger.info('Entering getNotification', { method: request.method || "", route: request.originalUrl || "" });

        const banner = await BannerModel.findOne({
            where: { isDeleted: false },
            order: [['createdAt', 'DESC']]
        });
        
        if(!banner) {
            adminLogger.info('Exiting getNotification: Request Processed (Not Found)', { method: request.method || "", route: request.originalUrl || "" });
            return response.json({
                status: false,
                message: "Not Found!",
                data: null,
            });
        }

        adminLogger.info('Exiting getNotification: Success', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Notification.",
            data: { message: banner.title },
        });
    } catch (e) {
        adminLogger.error('Error in getNotification', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

