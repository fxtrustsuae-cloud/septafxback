const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const GroupModel = require("../../models/group.model");
const MarketingMemberModel = require("../../models/marketingUser.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { marketingLogger } = require("../../utils/logger");

module.exports.groupList = async (request, response) => {
    try {
        marketingLogger.info('Entering groupList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, type, search } = request.query;
        const { user } = request.body;

        const adminData = await MarketingMemberModel.findOne({
            where: { id: user.id, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        // Search condition
        const searchCondition = search
            ? {
                  [Op.or]: [
                      { name: { [Op.iLike]: `%${search}%` } },
                  ],
              }
            : {};

        const whereCondition = {
            isDeleted: false,
            ...searchCondition,
        };

        if(type) whereCondition.type = type;

        const { count, rows: groupsList } = await GroupModel.findAndCountAll({
            where: whereCondition,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        marketingLogger.info('Exiting groupList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Group list.',
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page),
                groupsList,
            },
        });
    } catch (e) {
        marketingLogger.error('Error in groupList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
}

module.exports.singleGroup = async (request, response) => {
    try {
        marketingLogger.info('Entering singleGroup', { method: request.method || "", route: request.originalUrl || "" });
        const { id } = request.params;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: 'ADMIN', isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed('Access Denied!');

        const group = await GroupModel.findOne({
            where: {
                id,
                isDeleted: false,
            },
            include: [
                {
                    model: Mt5GroupModel,
                    as: 'mt5GroupData',
                    attributes: ['mt5GroupName'],
                    where: { isDeleted: false },
                },
            ],
        });

        if (!group) {
            throw CustomErrorHandler.notFound('Group not found');
        }

        marketingLogger.info('Exiting singleGroup: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Group details.',
            data: group,
        });
    } catch (e) {
        marketingLogger.error('Error in singleGroup', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

