const { Op } = require("sequelize");
const UserModel = require("../../models/users.model");
const GroupModel = require("../../models/group.model");
const SymbolModel = require("../../models/symbol.model");
const Mt5GroupModel = require("../../models/mt5Group.model");
const GroupController = require("../../mt5Services/group");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.mt5GroupList = async (request, response) => {
    try {
        adminLogger.info('Entering mt5GroupList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        }); if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = sizePerPage;

        // Search condition
        const searchCondition = search
            ? {
                [Op.or]: [
                    { mt5GroupName: { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = {
            ...searchCondition,
        };

        const { count, rows: list } = await Mt5GroupModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        adminLogger.info('Exiting mt5GroupList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 Group list.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: page,
                list,
            },
        });
    } catch (e) {
        adminLogger.error('Error in mt5GroupList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.createGroup = async (request, response) => {
    try {
        adminLogger.info('Entering createGroup', { method: request.method || "", route: request.originalUrl || "" });
        const { user, name, groupType, mt5GroupId, status, recomendation, message, minDeposit,
            spread, commission, leverage } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkGroupName = await GroupModel.findOne({
            where: { name }
        }); if (checkGroupName) throw CustomErrorHandler.unAuthorized("Group Name Already Exists!");

        const checkMt5Group = await Mt5GroupModel.findByPk(mt5GroupId);
        if (!checkMt5Group) throw CustomErrorHandler.notFound("MT5 Group Not Found!");

        const newGroup = await GroupModel.create({
            name,
            mt5Group: mt5GroupId,
            status,
            type: groupType,
            recomendation,
            message,
            minDeposit,
            spread,
            commission,
            leverage
        });

        adminLogger.info('Exiting createGroup: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Group Created.",
            data: newGroup,
        });
    } catch (e) {
        adminLogger.error('Error in createGroup', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

GroupModel.belongsTo(Mt5GroupModel, {
    foreignKey: 'mt5Group',
    targetKey: 'id',
    as: 'mt5GroupData' // Alias for the association
});

module.exports.groupList = async (request, response) => {
    try {
        adminLogger.info('Entering groupList', { method: request.method || "", route: request.originalUrl || "" });
        const { page = 1, sizePerPage = 10, type, search } = request.query;
        const { user } = request.body;

        // Check if admin
        const adminData = await UserModel.findOne({
            where: { id: user.id, role: 'ADMIN', isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed('Access Denied!');

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

        if (type) whereCondition.type = type;

        const { count, rows: groupsList } = await GroupModel.findAndCountAll({
            where: whereCondition,
            include: [
                {
                    model: Mt5GroupModel,
                    as: 'mt5GroupData',
                    attributes: ['mt5GroupName'], // Only fetch mt5GroupName
                    where: { isDeleted: false },
                },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        adminLogger.info('Exiting groupList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
        adminLogger.error('Error in groupList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
}

module.exports.singleGroup = async (request, response) => {
    try {
        adminLogger.info('Entering singleGroup', { method: request.method || "", route: request.originalUrl || "" });
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

        adminLogger.info('Exiting singleGroup: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: 'Group details.',
            data: group,
        });
    } catch (e) {
        adminLogger.error('Error in singleGroup', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateGroup = async (request, response) => {
    try {
        adminLogger.info('Entering updateGroup', { method: request.method || "", route: request.originalUrl || "" });
        const { user, groupId, status, groupType, name, mt5GroupId, recomendation, message, minDeposit, spread, commission, leverage } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] } }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const checkGroup = await GroupModel.findByPk(groupId);
        if (!checkGroup) throw CustomErrorHandler.wrongCredentials("Group Not Found!");

        if (mt5GroupId) {
            const checkMt5Group = await Mt5GroupModel.findByPk(mt5GroupId);
            if (!checkMt5Group) throw CustomErrorHandler.notFound("MT5 Group Not Found!");
        }

        if (status) checkGroup.status = status;
        if (name) checkGroup.name = name;
        if (recomendation) checkGroup.recomendation = recomendation;
        if (message) checkGroup.message = message;
        if (minDeposit) checkGroup.minDeposit = minDeposit;
        if (spread) checkGroup.spread = spread;
        if (commission) checkGroup.commission = commission;
        if (mt5GroupId) checkGroup.mt5Group = mt5GroupId;
        if (groupType) checkGroup.type = groupType;
        if (leverage) checkGroup.leverage = leverage;

        await checkGroup.save();

        adminLogger.info('Exiting updateGroup: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Updated Group.",
            data: checkGroup,
        });
    } catch (e) {
        adminLogger.error('Error in updateGroup', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateMt5Group = updateMt5Group;
module.exports.updateMt5Symbol = updateMt5Symbol;

module.exports.syncMt5Groups = async (request, response) => {
    // #swagger.tags = ['Admin']
    // #swagger.summary = 'Synchronize MT5 Groups and Symbols'
    // #swagger.description = 'Manually triggers the synchronization process to fetch all groups and symbols from the MT5 server and save them into the local database.'
    try {
        adminLogger.info('Entering syncMt5Groups', { method: request.method || "", route: request.originalUrl || "" });

        // Run synchronization asynchronously in the background
        (async () => {
            try {
                const groupResult = await updateMt5Group();
                if (groupResult && !groupResult.success) throw new Error(groupResult.message);
                
                const symbolResult = await updateMt5Symbol();
                if (symbolResult && !symbolResult.success) throw new Error(symbolResult.message);
                
                adminLogger.info('Background MT5 Sync completed successfully.');
            } catch (err) {
                adminLogger.error('Background MT5 Sync Error:', { error: err.message, stack: err.stack });
            }
        })();

        adminLogger.info('Exiting syncMt5Groups: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "MT5 synchronization started in the background. It may take a few minutes to complete.",
        });
    } catch (e) {
        adminLogger.error('Error in syncMt5Groups', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function updateMt5Group() {
    // Helper function to clean paths
    function cleanPath(path) {
        if (path === "*") return path; // keep only "*"
        return path.replace(/\\\*$/, ""); // remove \* at end
    }

    try {
        const result = await GroupController.getTotalGroup();
        if (!result || !result.answer) {
            throw new Error('Failed to fetch total group count from MT5. Please check MT5 connection or VPN Proxy settings.');
        }
        const total = result.answer.total;

        for (let i = 0; i < total; i++) {
            const data = await GroupController.getGroupByIndex(i);
            const groupName = data.answer.Group;

            let existingGroup = await Mt5GroupModel.findOne({
                where: {
                    mt5GroupName: groupName,
                    isDeleted: false
                }
            });

            const resultByName = await GroupController.getGroupByName(groupName);
            let symbols = resultByName.answer.Symbols;

            // Clean paths here
            const pathList = symbols.map(item => cleanPath(item.Path));

            if (!existingGroup) {
                // Create only if not exists
                await Mt5GroupModel.create({
                    mt5GroupName: groupName,
                    path: pathList
                });
                console.log(`✅ Created new MT5 group: ${groupName}`);
            } else {
                // Update path of existing group
                existingGroup.path = pathList;
                await existingGroup.save();
                console.log(`✔ Updated MT5 group: ${groupName}`);
            }
        }

        console.log('✅ MT5 group update process completed.');
        return { success: true, message: 'Groups updated successfully' };

    } catch (error) {
        console.error('❌ Error updating MT5 groups:', error.message);
        return { success: false, message: error.message };
    }
}

//setInterval(updateMt5Group, 1000 * 60 * 60 * 24)
//setInterval(updateMt5Symbol, 1000 * 60 * 60 * 24)

async function updateMt5Symbol() {
    try {
        const result = await GroupController.getGroupByMask();
        if (!result || !result.answer) {
            throw new Error('Failed to fetch symbols from MT5. Please check MT5 connection or VPN Proxy settings.');
        }
        console.log(result.answer.length)
        const symbolList = result.answer;

        for (const item of symbolList) {
            let basePath = item.Path;
            if (basePath.includes("\\")) {
                const parts = basePath.split("\\");
                parts.pop(); // remove symbol name like "XAUUSD.c"
                basePath = parts.join("\\"); // join remaining path
            }

            // ✅ Check if symbol exists
            const existingSymbol = await SymbolModel.findOne({
                where: {
                    symbol: item.Symbol,
                    isDeleted: false
                }
            });

            if (!existingSymbol) {
                await SymbolModel.create({
                    symbol: item.Symbol,
                    path: basePath
                });
                console.log(`✅ Created new Symbol: ${item.Symbol} | Path: ${basePath}`);
            } else {
                console.log(`⏭️ Skipped existing Symbol: ${existingSymbol.symbol}`);
            }
        }

        return { success: true, message: 'Symbols updated successfully' };
    } catch (error) {
        console.error("❌ Error updating MT5 Symbol:", error.message);
        return { success: false, message: error.message };
    }
}
