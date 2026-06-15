const { Op, QueryTypes } = require("sequelize");
const axios = require("axios");
const appConfig = require("../../config/config");
const sequelize = require("../../config/db.config");
const UserModel = require("../../models/users.model");
const Mt5AccountModel = require("../../models/mt5Account.model");
const MasterTraderModel = require("../../models/masterTrader.model");
const CopyTradeModel = require("../../models/copyTrade.model");
const { actionTracking } = require("../../helpers/index");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

const safeRequire = (modulePath) => {
    try {
        return require(modulePath);
    } catch (error) {
        return null;
    }
};

const MasterTraderStatsModel = safeRequire("../../models/masterTraderStats.model");

const COPY_TRADE_PLUGIN_BASE_URL = appConfig.COPY_TRADE_PLUGIN_BASE_URL || "https://achiever.fxtrusts.cloud";
const COPY_TRADE_PLUGIN_PATH = appConfig.COPY_TRADE_PLUGIN_PATH || "/api/Config/plugin";
const COPY_TRADE_PLUGIN_AUTH_TOKEN = appConfig.COPY_TRADE_PLUGIN_AUTH_TOKEN || "53ee14b86f5844abadc15f8a4face896";

const buildPluginConfigUrl = () => {
    if (!COPY_TRADE_PLUGIN_AUTH_TOKEN) {
        return `${COPY_TRADE_PLUGIN_BASE_URL}${COPY_TRADE_PLUGIN_PATH}`;
    }

    const query = new URLSearchParams({ authToken: COPY_TRADE_PLUGIN_AUTH_TOKEN }).toString();
    return `${COPY_TRADE_PLUGIN_BASE_URL}${COPY_TRADE_PLUGIN_PATH}?${query}`;
};

const toPluginLoginValue = (login) => {
    const parsed = Number(login);
    return Number.isNaN(parsed) ? login : parsed;
};

const getPluginConfig = async () => {
    const { data } = await axios.get(buildPluginConfigUrl(), {
        headers: { Accept: "*/*" }
    });
    if (data && typeof data === "object" && data.data && typeof data.data === "object") {
        return {
            ...data.data,
            rules: sanitizePluginRules(data.data.rules)
        };
    }

    return {
        ...(data && typeof data === "object" ? data : {}),
        rules: sanitizePluginRules(data?.rules)
    };
};

const putPluginConfig = async (payload) => {
    try {
        adminLogger.info('Plugin API Request', {
            url: buildPluginConfigUrl(),
            payload: JSON.stringify(payload)
        });

        const { data } = await axios.put(buildPluginConfigUrl(), payload, {
            headers: {
                Accept: "*/*",
                "Content-Type": "application/json"
            }
        });

        adminLogger.info('Plugin API Response Success', { data: JSON.stringify(data) });
        return data;
    } catch (error) {
        const errorDetail = {
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: JSON.stringify(error.response?.data),
            requestData: JSON.stringify(error.config?.data),
            url: error.config?.url
        };

        adminLogger.error('Plugin API Response Error', errorDetail);
        console.error('--- PLUGIN API ERROR DETAIL ---');
        console.error('URL:', errorDetail.url);
        console.error('Status:', errorDetail.status);
        console.error('Response Data:', errorDetail.responseData);
        console.error('--------------------------------');

        throw error;
    }
};

const buildPluginConfigPayload = (currentConfig, rules) => {
    const payload = {
        auth_token: currentConfig?.auth_token || COPY_TRADE_PLUGIN_AUTH_TOKEN,
        rules: sanitizePluginRules(rules)
    };

    if (currentConfig?.enabled !== undefined) payload.enabled = currentConfig.enabled;
    if (currentConfig?.general !== undefined) payload.general = currentConfig.general;
    if (currentConfig?.log_path !== undefined) payload.log_path = currentConfig.log_path;

    return payload;
};

const sanitizePluginRules = (rules) => {
    return (Array.isArray(rules) ? rules : []).map((rule) => ({
        destination_symbol: rule?.destination_symbol ?? "*",
        inverse: Boolean(rule?.inverse),
        is_rule_active: rule?.is_rule_active !== undefined ? Boolean(rule?.is_rule_active) : true,
        mode: rule?.mode ?? "Percentage",
        rule_name: rule?.rule_name,
        source_symbol: rule?.source_symbol ?? "*",
        sources: Array.isArray(rule?.sources) ? rule.sources : [],
        targets: Array.isArray(rule?.targets) ? rule.targets : [],
        value: rule?.value !== undefined ? rule.value : 100,
    }));
};

const buildPluginRule = (pluginRule, sourceLogin) => {
    if (!pluginRule || typeof pluginRule !== "object") {
        throw CustomErrorHandler.badRequest("pluginRule object is required.");
    }

    if (!Array.isArray(pluginRule.targets)) {
        throw CustomErrorHandler.badRequest("pluginRule.targets must be an array.");
    }

    const mode = pluginRule.mode || "Percentage";
    const value = pluginRule.value !== undefined ? pluginRule.value : 100;

    return {
        destination_symbol: pluginRule.destination_symbol || "*",
        inverse: Boolean(pluginRule.inverse),
        is_rule_active: pluginRule.is_rule_active !== undefined ? Boolean(pluginRule.is_rule_active) : true,
        mode,
        rule_name: pluginRule.rule_name,
        source_symbol: pluginRule.source_symbol || "*",
        sources: [sourceLogin],
        targets: pluginRule.targets,
        value
    };
};

const upsertMasterRuleBySource = (rules, sourceLogin, pluginRule, ruleIndex) => {
    const updatedRules = sanitizePluginRules(rules);
    const normalizedSource = String(sourceLogin);
    const newRule = buildPluginRule(pluginRule, sourceLogin);

    if (Number.isInteger(ruleIndex) && ruleIndex >= 0 && ruleIndex < updatedRules.length) {
        updatedRules[ruleIndex] = newRule;
        return {
            rules: updatedRules,
            ruleIndex,
            action: "UPDATED"
        };
    }

    const sourceRuleIndex = updatedRules.findIndex((rule) => {
        const source = Array.isArray(rule?.sources) ? rule.sources[0] : undefined;
        return source !== undefined && String(source) === normalizedSource;
    });

    if (sourceRuleIndex >= 0) {
        updatedRules[sourceRuleIndex] = newRule;
        return {
            rules: updatedRules,
            ruleIndex: sourceRuleIndex,
            action: "UPDATED"
        };
    } else {
        const createdIndex = updatedRules.length;
        updatedRules.push(newRule);
        return {
            rules: updatedRules,
            ruleIndex: createdIndex,
            action: "CREATED"
        };
    }
};

const replaceRuleSourceLogin = (rules, oldLogin, newLogin) => {
    const normalizedOld = String(oldLogin);
    return sanitizePluginRules(rules).map((rule) => {
        const source = Array.isArray(rule?.sources) ? rule.sources[0] : undefined;
        if (source !== undefined && String(source) === normalizedOld) {
            return {
                ...rule,
                sources: [newLogin]
            };
        }
        return rule;
    });
};

const resolveChartWindow = (chartTimeframe) => {
    const normalized = String(chartTimeframe || "30D").toUpperCase();

    if (normalized === "7D") return { chartTimeframe: "7D", pointLimit: 7 };
    if (normalized === "90D") return { chartTimeframe: "90D", pointLimit: 90 };

    return { chartTimeframe: "30D", pointLimit: 30 };
};

const getPnlPerformanceChart = async (masterTraderId, pointLimit = 14) => {
    if (!MasterTraderStatsModel) return [];

    const pnlPoints = await MasterTraderStatsModel.findAll({
        where: { masterTraderId, isDeleted: false },
        attributes: ["snapshotDate", "totalPnL", "totalPnLPercentage", "weeklyPnL", "monthlyPnL"],
        order: [["snapshotDate", "DESC"]],
        limit: pointLimit
    });

    return pnlPoints.reverse().map((point) => ({
        date: point.snapshotDate,
        totalPnL: parseFloat(point.totalPnL || 0),
        totalPnLPercentage: parseFloat(point.totalPnLPercentage || 0),
        weeklyPnL: parseFloat(point.weeklyPnL || 0),
        monthlyPnL: parseFloat(point.monthlyPnL || 0)
    }));
};

// Create Master Trader
module.exports.createMasterTrader = async (request, response) => {
    try {
        adminLogger.info('Entering createMasterTrader', { method: request.method || "", route: request.originalUrl || "" });
        const {
            user,
            userId,
            mt5Login,
            displayName,
            description,
            riskType,
            tradingStyle,
            instruments,
            avgTradeDuration,
            minimumCopyBalance,
            maxCopiers,
            pluginRule,
            mode,
            rule_name,
            source_symbol,
        } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        // Check if user exists
        const userData = await UserModel.findOne({
            where: { id: userId, isDeleted: false }
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        // Check if MT5 account exists and belongs to user
        const mt5Account = await Mt5AccountModel.findOne({
            where: {
                Login: mt5Login,
                userId: userId,
                isDeleted: false
            }
        });
        if (!mt5Account) throw CustomErrorHandler.notFound("MT5 account not found or does not belong to this user!");

        // Check if this MT5 login is already a master trader
        const existingMaster = await MasterTraderModel.findOne({
            where: {
                mt5Login: mt5Login,
                isDeleted: false
            }
        });
        if (existingMaster) throw CustomErrorHandler.alreadyExist("This MT5 account is already a master trader!");

        const effectivePluginRule = {
            ...(pluginRule || {}),
            destination_symbol: "*",
            inverse: false,
            is_rule_active: true,
            targets: [0],
            value: 100,
            mode: mode || pluginRule?.mode || "Percentage",
            rule_name: rule_name || pluginRule?.rule_name || `Master_${mt5Login}`,
            source_symbol: source_symbol || pluginRule?.source_symbol || "*",
        };

        // Create master trader
        const masterTrader = await MasterTraderModel.create({
            userId,
            mt5Login,
            displayName,
            description: description || "",
            riskLevel: riskType || "MEDIUM",
            tradingStyle: tradingStyle || null,
            instruments: instruments || [],
            avgTradeDuration: avgTradeDuration || null,
            minimumCopyBalance: minimumCopyBalance || 0,
            maxCopiers: maxCopiers || 100,
            ruleMode: effectivePluginRule.mode || "Percentage",
            ruleName: effectivePluginRule.rule_name || `Master_${mt5Login}`,
            sourceSymbol: effectivePluginRule.source_symbol || "*",
            status: "ACTIVE"
        });

        const currentConfig = await getPluginConfig();
        const sourceLogin = toPluginLoginValue(mt5Login);
        const pluginRuleMeta = upsertMasterRuleBySource(currentConfig?.rules, sourceLogin, effectivePluginRule);

        masterTrader.ruleIndex = pluginRuleMeta.ruleIndex;
        await masterTrader.save();

        // Restore the plugin config update with the correct format
        await putPluginConfig(buildPluginConfigPayload(currentConfig, pluginRuleMeta.rules));

        await actionTracking(request, adminData.id, "CREATED-MASTER-TRADER", `Master Trader ID: ${masterTrader.id}, Login: ${mt5Login}`);

        adminLogger.info('Exiting createMasterTrader: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(201).json({
            status: true,
            message: "Master Trader created successfully.",
            data: {
                ...masterTrader.toJSON(),
                pluginRuleIndex: pluginRuleMeta.ruleIndex,
                pluginRuleAction: pluginRuleMeta.action
            }
        });
    } catch (e) {
        adminLogger.error('Error in createMasterTrader', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// List Master Traders
module.exports.listMasterTraders = async (request, response) => {
    try {
        adminLogger.info('Entering listMasterTraders', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { page = 1, sizePerPage = 10, search, status, minWinRate, maxDrawdown, minReturn, sortBy = 'createdAt', chartTimeframe, timeframe } = request.query;
        const chartWindow = resolveChartWindow(chartTimeframe || timeframe);

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const searchCondition = search
            ? {
                [Op.or]: [
                    { displayName: { [Op.iLike]: `%${search}%` } },
                    { mt5Login: { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = {
            isDeleted: false,
            ...searchCondition,
        };

        if (status) whereCondition.status = status;

        const { count, rows: masterTraders } = await MasterTraderModel.findAndCountAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name", "email"]
                },
                {
                    model: Mt5AccountModel,
                    as: "mt5Account",
                    attributes: ["Login", "Balance"]
                }
            ]
        });

        // Fetch latest stats for each master trader
        const MasterTraderReviewModel = safeRequire("../../models/masterTraderReview.model");
        let masterTradersWithStats = await Promise.all(
            masterTraders.map(async (master) => {
                const latestStats = MasterTraderStatsModel
                    ? await MasterTraderStatsModel.findOne({
                        where: { masterTraderId: master.id, isDeleted: false },
                        order: [["snapshotDate", "DESC"]],
                        limit: 1
                    })
                    : null;

                const pnlPerformanceChart = await getPnlPerformanceChart(master.id, chartWindow.pointLimit);

                // Calculate reviews rating
                let reviewsRating = 0;
                let reviewsCount = 0;
                if (MasterTraderReviewModel) {
                    const reviews = await MasterTraderReviewModel.findAll({
                        where: {
                            masterTraderId: master.id,
                            isDeleted: false
                        },
                        attributes: ["rating"]
                    });

                    if (reviews.length > 0) {
                        const totalRating = reviews.reduce((sum, r) => sum + parseFloat(r.rating), 0);
                        reviewsRating = (totalRating / reviews.length).toFixed(2);
                        reviewsCount = reviews.length;
                    }
                }

                return {
                    ...master.toJSON(),
                    latestStats: latestStats || null,
                    pnlPerformanceChart,
                    reviewsRating: parseFloat(reviewsRating),
                    reviewsCount
                };
            })
        );

        // Filter by performance metrics (similar to user-side)
        if (minWinRate !== undefined) {
            masterTradersWithStats = masterTradersWithStats.filter(m =>
                m.latestStats && m.latestStats.winRate >= parseFloat(minWinRate)
            );
        }

        if (maxDrawdown !== undefined) {
            masterTradersWithStats = masterTradersWithStats.filter(m =>
                m.latestStats && m.latestStats.maxDrawdownPercent <= parseFloat(maxDrawdown)
            );
        }

        if (minReturn !== undefined) {
            masterTradersWithStats = masterTradersWithStats.filter(m =>
                m.latestStats && m.latestStats.totalPnLPercentage >= parseFloat(minReturn)
            );
        }

        // Sort by performance metrics (similar to user-side)
        if (sortBy === 'roi') {
            masterTradersWithStats.sort((a, b) =>
                (b.latestStats?.totalPnLPercentage || 0) - (a.latestStats?.totalPnLPercentage || 0)
            );
        } else if (sortBy === 'winRate') {
            masterTradersWithStats.sort((a, b) =>
                (b.latestStats?.winRate || 0) - (a.latestStats?.winRate || 0)
            );
        } else if (sortBy === 'copiers') {
            masterTradersWithStats.sort((a, b) =>
                (b.latestStats?.activeCopiers || 0) - (a.latestStats?.activeCopiers || 0)
            );
        } else if (sortBy === 'drawdown') {
            masterTradersWithStats.sort((a, b) =>
                (a.latestStats?.maxDrawdownPercent || 100) - (b.latestStats?.maxDrawdownPercent || 100)
            );
        } else if (sortBy === 'trending') {
            masterTradersWithStats.sort((a, b) =>
                (b.latestStats?.weeklyPnL || 0) - (a.latestStats?.weeklyPnL || 0)
            );
        }

        // Proper pagination on filtered results
        const totalFilteredRecords = masterTradersWithStats.length;
        const paginatedMasters = masterTradersWithStats.slice(offset, offset + limit);

        adminLogger.info('Exiting listMasterTraders: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Traders list.",
            data: {
                totalRecords: totalFilteredRecords,
                totalPages: Math.ceil(totalFilteredRecords / sizePerPage),
                currentPage: parseInt(page),
                chartTimeframe: chartWindow.chartTimeframe,
                masterTraders: paginatedMasters,
            },
        });
    } catch (e) {
        adminLogger.error('Error in listMasterTraders', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Master Trader by ID
module.exports.getMasterTraderById = async (request, response) => {
    try {
        adminLogger.info('Entering getMasterTraderById', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { id } = request.params;
        const { chartTimeframe, timeframe } = request.query;
        const chartWindow = resolveChartWindow(chartTimeframe || timeframe);

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const masterTrader = await MasterTraderModel.findOne({
            where: { id, isDeleted: false },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name", "email"]
                },
                {
                    model: Mt5AccountModel,
                    as: "mt5Account",
                    attributes: ["Login", "Balance"]
                }
            ]
        });

        if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found!");

        // Fetch latest stats
        const latestStats = MasterTraderStatsModel
            ? await MasterTraderStatsModel.findOne({
                where: { masterTraderId: masterTrader.id, isDeleted: false },
                order: [["snapshotDate", "DESC"]],
                limit: 1
            })
            : null;

        const pnlPerformanceChart = await getPnlPerformanceChart(masterTrader.id, chartWindow.pointLimit);

        // Calculate reviews rating for admin
        const MasterTraderReviewModel = safeRequire("../../models/masterTraderReview.model");
        let reviewsRating = 0;
        let reviewsCount = 0;
        if (MasterTraderReviewModel) {
            const reviews = await MasterTraderReviewModel.findAll({
                where: {
                    masterTraderId: masterTrader.id,
                    isDeleted: false
                },
                attributes: ["rating"]
            });

            if (reviews.length > 0) {
                const totalRating = reviews.reduce((sum, r) => sum + parseFloat(r.rating), 0);
                reviewsRating = (totalRating / reviews.length).toFixed(2);
                reviewsCount = reviews.length;
            }
        }

        const masterTraderWithStats = {
            ...masterTrader.toJSON(),
            latestStats: latestStats || null,
            chartTimeframe: chartWindow.chartTimeframe,
            pnlPerformanceChart,
            reviewsCount,
            reviewsRating: parseFloat(reviewsRating)
        };

        adminLogger.info('Exiting getMasterTraderById: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader details.",
            data: masterTraderWithStats
        });
    } catch (e) {
        adminLogger.error('Error in getMasterTraderById', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Update Master Trader (Consolidated: Update Profile, Source Account, Delete)
module.exports.updateMasterTrader = async (request, response) => {
    try {
        adminLogger.info('Entering updateMasterTrader', { method: request.method || "", route: request.originalUrl || "" });
        const { user, masterTraderId, displayName, description, minimumCopyBalance, maxCopiers, status,
            newMt5Login, isDeleted, riskType, tradingStyle, instruments, avgTradeDuration,
            pluginRule, pluginRuleIndex } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        }); if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const masterTrader = await MasterTraderModel.findOne({
            where: { id: masterTraderId, isDeleted: false }
        }); if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found!");

        let actionType = "UPDATED-MASTER-TRADER";
        let actionMsg = `Master Trader ID: ${masterTraderId}`;

        // Handle Delete Operation
        if (isDeleted === true || isDeleted === "true") {
            // Check if there are active copiers
            const activeCopiersCount = await CopyTradeModel.count({
                where: {
                    masterTraderId,
                    status: "ACTIVE",
                    isDeleted: false
                }
            });

            if (activeCopiersCount > 0) {
                throw CustomErrorHandler.notAllowed("Cannot delete Master Trader with active copiers. Please stop all copy trades first.");
            }

            masterTrader.isDeleted = true;
            masterTrader.status = "INACTIVE";
            await masterTrader.save();

            actionType = "DELETED-MASTER-TRADER";
            await actionTracking(request, adminData.id, actionType, actionMsg);

            adminLogger.info('Exiting updateMasterTrader: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
            return response.json({
                status: true,
                message: "Master Trader deleted successfully.",
                data: null
            });
        }

        // Handle Update Source Account (MT5 Login)
        let oldLogin;
        if (newMt5Login) {
            // Check if MT5 account exists and belongs to the master trader's user
            const mt5Account = await Mt5AccountModel.findOne({
                where: {
                    Login: newMt5Login,
                    userId: masterTrader.userId,
                    isDeleted: false
                }
            });
            if (!mt5Account) throw CustomErrorHandler.notFound("MT5 account not found or does not belong to this user!");

            // Check if this MT5 login is already used by another master trader
            const existingMaster = await MasterTraderModel.findOne({
                where: {
                    mt5Login: newMt5Login,
                    id: { [Op.ne]: masterTraderId },
                    isDeleted: false
                }
            });
            if (existingMaster) throw CustomErrorHandler.alreadyExist("This MT5 account is already used by another master trader!");

            oldLogin = masterTrader.mt5Login;
            masterTrader.mt5Login = newMt5Login;
            actionType = "UPDATED-MASTER-TRADER-SOURCE";
            actionMsg = `Master Trader ID: ${masterTraderId}, Old Login: ${oldLogin}, New Login: ${newMt5Login}`;
        }

        // Handle Basic Profile Updates
        if (displayName) masterTrader.displayName = displayName;
        if (description !== undefined) masterTrader.description = description;
        if (riskType) masterTrader.riskLevel = riskType;
        if (tradingStyle !== undefined) masterTrader.tradingStyle = tradingStyle;
        if (instruments !== undefined) masterTrader.instruments = instruments;
        if (avgTradeDuration !== undefined) masterTrader.avgTradeDuration = avgTradeDuration;
        if (minimumCopyBalance !== undefined) masterTrader.minimumCopyBalance = minimumCopyBalance;
        if (maxCopiers) masterTrader.maxCopiers = maxCopiers;
        if (status) masterTrader.status = status;

        await masterTrader.save();

        if (newMt5Login || pluginRule) {
            const currentConfig = await getPluginConfig();
            let updatedRules = sanitizePluginRules(currentConfig?.rules);
            let pluginRuleMeta = null;

            if (newMt5Login && oldLogin) {
                updatedRules = replaceRuleSourceLogin(
                    updatedRules,
                    toPluginLoginValue(oldLogin),
                    toPluginLoginValue(newMt5Login)
                );
            }

            if (pluginRule) {
                const sourceLogin = toPluginLoginValue(masterTrader.mt5Login);
                const parsedRuleIndex = pluginRuleIndex !== undefined ? Number(pluginRuleIndex) : undefined;
                pluginRuleMeta = upsertMasterRuleBySource(
                    updatedRules,
                    sourceLogin,
                    pluginRule,
                    Number.isInteger(parsedRuleIndex) ? parsedRuleIndex : undefined
                );
                updatedRules = pluginRuleMeta.rules;

                masterTrader.ruleIndex = pluginRuleMeta.ruleIndex;
                masterTrader.ruleMode = pluginRule.mode || "Percentage";
                masterTrader.ruleName = pluginRule.rule_name || `Master_${masterTrader.mt5Login}`;
                masterTrader.sourceSymbol = pluginRule.source_symbol || "*";
                await masterTrader.save();
            }

            await putPluginConfig(buildPluginConfigPayload(currentConfig, updatedRules));
        }

        await actionTracking(request, adminData.id, actionType, actionMsg);

        adminLogger.info('Exiting updateMasterTrader: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader updated successfully.",
            data: masterTrader
        });
    } catch (e) {
        adminLogger.error('Error in updateMasterTrader', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Master Trader's Trade List (Deals)
module.exports.getMasterTraderTradeList = async (request, response) => {
    try {
        adminLogger.info('Entering getMasterTraderTradeList', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { masterTraderId } = request.params;
        const { days = 30, page = 1, sizePerPage = 20 } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (!masterTraderId) {
            throw CustomErrorHandler.notFound("Master Trader ID is required");
        }

        // Fetch master trader
        const masterTrader = await MasterTraderModel.findOne({
            where: { id: masterTraderId, isDeleted: false },
            include: [
                {
                    model: Mt5AccountModel,
                    as: "mt5Account",
                    attributes: ["Login", "Balance"]
                },
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name"]
                }
            ]
        });

        if (!masterTrader) {
            throw CustomErrorHandler.notFound("Master Trader not found");
        }

        const DealControllers = require("../../mt5Services/deals");

        // Fetch deals from MT5
        const now = new Date();
        const fromDate = Math.floor((now.getTime() - (days * 24 * 60 * 60 * 1000)) / 1000);
        const toDate = Math.floor(now.getTime() / 1000);

        const totalResponse = await DealControllers.getDealsList(masterTrader.mt5Account.Login, fromDate, toDate);
        const totalCount = totalResponse?.answer?.total || totalResponse?.answer?.count || 0;

        // Paginate results
        const offset = (page - 1) * sizePerPage;
        const dealsResponse = await DealControllers.getDealsPage(
            masterTrader.mt5Account.Login,
            fromDate,
            toDate,
            offset,
            sizePerPage
        );

        const deals = dealsResponse?.answer || [];
        const formattedDeals = (Array.isArray(deals) ? deals : []).map(deal => ({
            ticket: deal.Ticket,
            symbol: deal.Symbol,
            type: deal.Type, // 0=buy, 1=sell
            volume: deal.Volume,
            price: deal.Price,
            commission: deal.Commission,
            profit: deal.Profit,
            comment: deal.Comment,
            time: deal.Time || deal.TimeMsc,
            swaps: deal.Swaps
        }));

        adminLogger.info('Exiting getMasterTraderTradeList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader trades list.",
            data: {
                masterTrader: {
                    id: masterTrader.id,
                    displayName: masterTrader.displayName,
                    mt5Login: masterTrader.mt5Account.Login,
                    user: {
                        id: masterTrader.user.id,
                        userName: masterTrader.user.userName,
                        name: masterTrader.user.name
                    }
                },
                totalRecords: totalCount,
                totalPages: Math.ceil(totalCount / sizePerPage),
                currentPage: parseInt(page, 10),
                trades: formattedDeals
            }
        });
    } catch (e) {
        adminLogger.error('Error in getMasterTraderTradeList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Copiers List for a Specific Master Trader (Admin)
module.exports.getMasterTraderCopiers = async (request, response) => {
    try {
        adminLogger.info('Entering getMasterTraderCopiers', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { masterTraderId, status, page = 1, sizePerPage = 10 } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const masterTrader = await MasterTraderModel.findOne({
            where: { id: masterTraderId, isDeleted: false },
            attributes: ["id", "displayName", "mt5Login", "status"]
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found!");

        const limit = parseInt(sizePerPage, 10);
        const offset = (parseInt(page, 10) - 1) * limit;
        const copyTradeWhere = {
            masterTraderId,
            isDeleted: false,
            ...(status ? { status } : {})
        };

        const { count, rows } = await CopyTradeModel.findAndCountAll({
            where: copyTradeWhere,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name", "email", "country"]
                },
                {
                    model: Mt5AccountModel,
                    as: "followerAccount",
                    attributes: ["Login", "Balance", "Leverage", "Currency"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        const totalCopiersPnLRaw = await CopyTradeModel.sum("totalPnL", {
            where: copyTradeWhere
        });

        const activeCopiers = await CopyTradeModel.count({
            where: {
                masterTraderId,
                status: "ACTIVE",
                isDeleted: false
            }
        });

        const pausedCopiers = await CopyTradeModel.count({
            where: {
                masterTraderId,
                status: "PAUSED",
                isDeleted: false
            }
        });

        const stoppedCopiers = await CopyTradeModel.count({
            where: {
                masterTraderId,
                status: "STOPPED",
                isDeleted: false
            }
        });

        await actionTracking(
            request,
            adminData.id,
            "VIEW-MASTER-TRADER-COPIERS",
            `Master Trader ID: ${masterTraderId}, Total Copiers: ${count}`
        );

        adminLogger.info('Exiting getMasterTraderCopiers: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader copiers list.",
            data: {
                masterTrader,
                totalCopiers: count,
                totalCopiersPnL: parseFloat(totalCopiersPnLRaw || 0),
                statusFilter: status || null,
                activeCopiers,
                pausedCopiers,
                stoppedCopiers,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page, 10),
                copiers: rows.map((copier) => ({
                    id: copier.id,
                    userId: copier.userId,
                    user: copier.user,
                    followerMt5Login: copier.followerMt5Login,
                    followerAccount: copier.followerAccount,
                    status: copier.status,
                    totalCopiedTrades: copier.totalCopiedTrades,
                    totalPnL: parseFloat(copier.totalPnL || 0),
                    subscribedOn: copier.createdAt
                }))
            }
        });
    } catch (e) {
        adminLogger.error('Error in getMasterTraderCopiers', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Watchers for a Specific Master Trader (Admin)
module.exports.getMasterTraderWatchers = async (request, response) => {
    try {
        adminLogger.info('Entering getMasterTraderWatchers', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;
        const { masterTraderId, page = 1, sizePerPage = 10 } = request.query;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if (!masterTraderId) {
            throw CustomErrorHandler.badRequest("masterTraderId is required!");
        }

        // Check if master trader exists
        const masterTrader = await MasterTraderModel.findOne({
            where: { id: masterTraderId, isDeleted: false }
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found!");

        const MasterTraderWatcherModel = require("../../models/masterTraderWatcher.model");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const { count, rows } = await MasterTraderWatcherModel.findAndCountAll({
            where: {
                masterTraderId: masterTraderId,
                isDeleted: false
            },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name", "email", "country"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        // Count notification preferences
        const notificationsEnabledCount = rows.filter(w => w.notificationsEnabled).length;

        await actionTracking(request, adminData.id, "VIEW-MASTER-TRADER-WATCHERS", `Master Trader ID: ${masterTraderId}, Total Watchers: ${count}`);

        adminLogger.info('Exiting getMasterTraderWatchers: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader watchers list.",
            data: {
                masterTraderId: masterTraderId,
                displayName: masterTrader.displayName,
                totalWatchers: count,
                notificationsEnabledCount: notificationsEnabledCount,
                notificationsDisabledCount: count - notificationsEnabledCount,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page, 10),
                watchers: rows.map(w => ({
                    id: w.id,
                    userId: w.userId,
                    user: w.user,
                    notificationsEnabled: w.notificationsEnabled,
                    addedOn: w.createdAt
                }))
            }
        });
    } catch (e) {
        adminLogger.error('Error in getMasterTraderWatchers', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Watchlist Analytics (Admin Dashboard)
module.exports.watchlistAnalytics = async (request, response) => {
    try {
        adminLogger.info('Entering watchlistAnalytics', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false }
        });
        if (!adminData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        const MasterTraderWatcherModel = require("../../models/masterTraderWatcher.model");

        // Total watchers count
        const totalWatchersCount = await MasterTraderWatcherModel.count({
            where: { isDeleted: false }
        });

        // Notifications enabled count
        const notificationsEnabledCount = await MasterTraderWatcherModel.count({
            where: { isDeleted: false, notificationsEnabled: true }
        });

        // Get top watched master traders - use raw query for cleaner aggregation
        const topWatchedTraders = await sequelize.query(
            `SELECT 
                m."masterTraderId", 
                COUNT(m.id) as watcher_count,
                mt.display_name,
                mt.mt5_login,
                mt.status
             FROM "MasterTraderWatchers" m
             LEFT JOIN "MasterTraders" mt ON m."masterTraderId" = mt.id
             WHERE m."isDeleted" = false AND mt.is_deleted = false
             GROUP BY m."masterTraderId", mt.id, mt.display_name, mt.mt5_login, mt.status
             ORDER BY COUNT(m.id) DESC
             LIMIT 10`,
            { type: QueryTypes.SELECT }
        );

        // Get watchers by day (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const watchersByDay = await sequelize.query(
            `SELECT 
                DATE("createdAt") as date,
                COUNT(id) as count
             FROM "MasterTraderWatchers"
             WHERE "isDeleted" = false AND "createdAt" >= :sevenDaysAgo
             GROUP BY DATE("createdAt")
             ORDER BY DATE("createdAt") ASC`,
            {
                replacements: { sevenDaysAgo },
                type: QueryTypes.SELECT
            }
        );

        // Get inactive watchers (notifications disabled)
        const inactiveWatchersCount = totalWatchersCount - notificationsEnabledCount;

        await actionTracking(request, adminData.id, "VIEW-WATCHLIST-ANALYTICS", `Total Watchers: ${totalWatchersCount}`);

        adminLogger.info('Exiting watchlistAnalytics: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Watchlist analytics.",
            data: {
                summary: {
                    totalWatchers: totalWatchersCount,
                    activeWatchers: notificationsEnabledCount,
                    inactiveWatchers: inactiveWatchersCount,
                    activationRate: totalWatchersCount > 0 ? ((notificationsEnabledCount / totalWatchersCount) * 100).toFixed(2) + '%' : '0%'
                },
                topWatchedTraders: topWatchedTraders.map(t => ({
                    masterTraderId: t.masterTraderId,
                    displayName: t.display_name || 'Unknown',
                    mt5Login: t.mt5_login || 'N/A',
                    status: t.status || 'ACTIVE',
                    watcherCount: parseInt(t.watcher_count, 10)
                })),
                watchersTrend: watchersByDay
            }
        });
    } catch (e) {
        adminLogger.error('Error in watchlistAnalytics', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

