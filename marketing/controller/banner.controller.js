const AdminModel = require("../../models/users.model");
const BannerModel = require("../../models/banner.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.uploadBanner = async (req, res) => {
    try {
        marketingLogger.info('Entering uploadBanner', { method: req.method || "", route: req.originalUrl || "" });
        const { user } = req.body;
        const { title } = req.query;

        const userData = await AdminModel.findOne({
            where: {
                id: user.id,
                role: "ADMIN",
                isDeleted: false,
            }
        }); if (!userData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const newBanner = await BannerModel.create({
            title,
            image: req.files["image"][0].filename
        })

        marketingLogger.info('Exiting uploadBanner: Request Processed', { method: req.method || "", route: req.originalUrl || "" });
        return res.json({
            status: true,
            message: "Banner Updated.",
            data: newBanner,
        });
    } catch (e) {
        marketingLogger.error('Error in uploadBanner', { stack: e.stack || e, method: req.method || "", route: req.originalUrl || "" });
        handleErrorResponse(e, res);
    }
};

module.exports.getBanner = async (request, response) => {
    try {
        marketingLogger.info('Entering getBanner', { method: request.method || "", route: request.originalUrl || "" });

        const banner = await BannerModel.findOne({
            where: { isDeleted: false },
        });
        if(!banner) throw CustomErrorHandler.notFound("Not Found!");

        const host = `${request.protocol}://${request.get("host")}`;
        banner.image = `${host}/public/banner/${banner.image}`

        marketingLogger.info('Exiting getBanner: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Banner.",
            data: banner,
        });
    } catch (e) {
        marketingLogger.error('Error in getBanner', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.deleteBanner = async (request, response) => {
    try {
        marketingLogger.info('Entering deleteBanner', { method: request.method || "", route: request.originalUrl || "" });
        const { user, bannerId } = request.body;

        const checkAdmin = await AdminModel.findOne({
            where: {
                id: user.id,
                role: "ADMIN",
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
            marketingLogger.info('Exiting deleteBanner: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(404).json({
                status: false,
                message: "Banner not found or deleted",
                data: null,
            });
        }

        bannerData.isDeleted = true;
        bannerData.save();

        marketingLogger.info('Exiting deleteBanner: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(200).json({
            status: true,
            message: "Banner Deleted successfully",
            data: bannerData,
        });
    } catch (error) {
        marketingLogger.error('Error in deleteBanner', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
        response.status(500).json({
            status: false,
            message: "Failed to delete banner",
            data: null,
        });
    }
};
