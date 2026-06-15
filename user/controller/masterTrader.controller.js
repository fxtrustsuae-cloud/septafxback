const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const axios = require("axios");
const appConfig = require("../../config/config");
const sequelize = require("../../config/db.config");
const UserModel = require("../../models/users.model");
const Mt5AccountModel = require("../../models/mt5Account.model");
const MasterTraderModel = require("../../models/masterTrader.model");
const CopyTradeModel = require("../../models/copyTrade.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");
const DealsControllers = require("../../mt5Services/deals");

const safeRequire = (modulePath) => {
    try {
        return require(modulePath);
    } catch (error) {
        return null;
    }
};

const MasterTraderStatsModel = safeRequire("../../models/masterTraderStats.model");
const MasterTraderEquityCurveModel = safeRequire("../../models/masterTraderEquityCurve.model");
const MasterTraderWatcherModel = safeRequire("../../models/masterTraderWatcher.model");
const MasterTraderReviewModel = safeRequire("../../models/masterTraderReview.model");
const CopyTradeSubscriptionModel = safeRequire("../../models/copyTradeSubscription.model");

const COPY_TRADE_PLUGIN_BASE_URL = appConfig.COPY_TRADE_PLUGIN_BASE_URL || "https://achiever.fxtrusts.cloud";
const COPY_TRADE_PLUGIN_PATH = appConfig.COPY_TRADE_PLUGIN_PATH || "/api/Config/plugin";
const COPY_TRADE_PLUGIN_AUTH_TOKEN = appConfig.COPY_TRADE_PLUGIN_AUTH_TOKEN;

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

const syncMasterTraderPluginTargets = async (masterTraderId) => {
    if (!CopyTradeSubscriptionModel) return;

    const masterTrader = await MasterTraderModel.findOne({
        where: { id: masterTraderId, isDeleted: false },
        attributes: ["id", "mt5Login", "ruleMode", "ruleName", "sourceSymbol"]
    });
    if (!masterTrader) return;

    const activeSubscriptions = await CopyTradeSubscriptionModel.findAll({
        where: {
            masterTraderId,
            status: "ACTIVE",
            isDeleted: false
        },
        attributes: ["login"]
    });

    let targets = [...new Set(activeSubscriptions.map((item) => toPluginLoginValue(item.login)))];
    if (targets.length === 0) targets = [0]; // API requirement: targets cannot be empty
    const sourceLogin = toPluginLoginValue(masterTrader.mt5Login);

    const { data: pluginResponse } = await axios.get(buildPluginConfigUrl(), {
        headers: { Accept: "*/*" }
    });

    // API returns { success, data: { auth_token, rules } }
    const pluginData = (pluginResponse && typeof pluginResponse === "object" && pluginResponse.data)
        ? pluginResponse.data
        : pluginResponse;

    const rules = sanitizePluginRules(pluginData?.rules);
    const sourceRuleIndex = rules.findIndex((rule) => {
        const source = Array.isArray(rule?.sources) ? rule.sources[0] : undefined;
        return source !== undefined && String(source) === String(sourceLogin);
    });

    if (sourceRuleIndex >= 0) {
        rules[sourceRuleIndex] = {
            ...rules[sourceRuleIndex],
            targets,
            sources: [sourceLogin]
        };
    } else {
        rules.push({
            destination_symbol: "*",
            inverse: false,
            is_rule_active: true,
            mode: masterTrader.ruleMode || "Percentage",
            rule_name: masterTrader.ruleName || `Master_${masterTrader.mt5Login}`,
            source_symbol: masterTrader.sourceSymbol || "*",
            sources: [sourceLogin],
            targets,
            value: 100
        });
    }

    try {
        await axios.put(buildPluginConfigUrl(), {
            auth_token: pluginData?.auth_token || COPY_TRADE_PLUGIN_AUTH_TOKEN,
            rules
        }, {
            headers: {
                Accept: "*/*",
                "Content-Type": "application/json"
            }
        });
    } catch (error) {
        const errorDetail = {
            url: error.config?.url,
            status: error.response?.status,
            responseData: JSON.stringify(error.response?.data)
        };
        userLogger.error('--- PLUGIN API ERROR (User Side) ---', errorDetail);
        throw error;
    }
};

const resolveChartWindow = (chartTimeframe) => {
    const normalized = String(chartTimeframe || "30D").toUpperCase();

    if (normalized === "90D")  return { chartTimeframe: "90D",  pointLimit: 90  };
    if (normalized === "365D") return { chartTimeframe: "365D", pointLimit: 365 };

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

// Build a daily cumulative PnL curve directly from MT5 deal history.
// Returns one point per calendar day in the window, starting at 0 on day 0.
const buildPnlChartFromDeals = async (login, pointLimit) => {
    try {
        const nowTs   = Math.floor(Date.now() / 1000);
        const fromTs  = nowTs - pointLimit * 86400;

        const totalRes = await DealsControllers.getDealsList(login, fromTs, nowTs);
        const totalCount = parseInt(totalRes?.answer?.total ?? 0, 10);
        if (!totalCount) return [];

        const BATCH = 1000;
        let allDeals = [];
        let offset = 0;
        while (offset < totalCount) {
            const res = await DealsControllers.getDealsPage(login, fromTs, nowTs, offset, BATCH);
            const batch = res?.answer;
            if (!Array.isArray(batch) || batch.length === 0) break;
            allDeals = allDeals.concat(batch);
            offset += batch.length;
        }

        // Keep only closing deals (Entry=1) that carry trade P&L
        const closing = allDeals
            .filter(d => String(d.Entry) === '1')
            .map(d => ({
                ts:  parseInt(d.Time ?? 0, 10),
                pnl: parseFloat(d.Profit ?? 0) + parseFloat(d.Commission ?? 0) + parseFloat(d.Storage ?? 0),
            }))
            .sort((a, b) => a.ts - b.ts);

        if (closing.length === 0) return [];

        // One point per calendar day — running cumulative PnL
        const points = [];
        let cumPnL = 0;
        for (let i = 0; i < pointLimit; i++) {
            const dayStart = fromTs + i * 86400;
            const dayEnd   = dayStart + 86400;
            for (const deal of closing) {
                if (deal.ts >= dayStart && deal.ts < dayEnd) cumPnL += deal.pnl;
            }
            const date = new Date((dayStart + 43200) * 1000); // noon of that day
            points.push({
                date: date.toISOString().slice(0, 10),
                totalPnL: parseFloat(cumPnL.toFixed(2)),
            });
        }

        // Drop leading all-zero points so the chart starts where activity begins
        const firstActivity = points.findIndex((p, i) => i > 0 && p.totalPnL !== points[i - 1].totalPnL);
        return firstActivity > 0 ? points.slice(firstActivity - 1) : points;
    } catch {
        return [];
    }
};

// Get Master Traders List (Public Discovery)
module.exports.masterTraderList = async (request, response) => {
    try {
        userLogger.info('Entering masterTraderList', { method: request.method || "", route: request.originalUrl || "" });
        const {
            page = 1,
            sizePerPage = 10,
            search,
            minWinRate,
            maxDrawdown,
            minReturn,
            sortBy = 'copiers',
            chartTimeframe,
            timeframe
        } = request.query;
        const chartWindow = resolveChartWindow(chartTimeframe || timeframe);

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const searchCondition = search
            ? {
                [Op.or]: [
                    { displayName: { [Op.iLike]: `%${search}%` } },
                    { "$user.name$": { [Op.iLike]: `%${search}%` } },
                ],
            }
            : {};

        const whereCondition = {
            isDeleted: false,
            status: 'ACTIVE',
            ...searchCondition
        };

        // Fetch all matching records first (JS-level filtering requires full result set)
        const { count, rows } = await MasterTraderModel.findAndCountAll({
            where: whereCondition,
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name", "country"]
                },
                {
                    model: Mt5AccountModel,
                    as: "mt5Account",
                    attributes: ["id", "Login", "accountType"]
                }
            ],
            order: [["createdAt", "DESC"]],
        });

        // Fetch latest stats and filter based on criteria
        const masterTradersWithStats = await Promise.all(
            rows.map(async (master) => {
                const latestStats = MasterTraderStatsModel
                    ? await MasterTraderStatsModel.findOne({
                        where: { masterTraderId: master.id, isDeleted: false },
                        order: [["snapshotDate", "DESC"]],
                        limit: 1
                    })
                    : null;

                const pnlPerformanceChart = await getPnlPerformanceChart(master.id, chartWindow.pointLimit);

                // Fetch reviews for rating
                let reviewsRating = 0;
                let reviewsCount = 0;
                if (MasterTraderReviewModel) {
                    const reviews = await MasterTraderReviewModel.findAll({
                        where: {
                            masterTraderId: master.id,
                            isDeleted: false
                        },
                        attributes: ["rating", "id"]
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
                    reviewsCount,
                    latestReview: null
                };
            })
        );

        // Filter by criteria
        let filteredMasters = masterTradersWithStats;

        if (minWinRate !== undefined) {
            filteredMasters = filteredMasters.filter(m =>
                m.latestStats && m.latestStats.winRate >= parseFloat(minWinRate)
            );
        }

        if (maxDrawdown !== undefined) {
            filteredMasters = filteredMasters.filter(m =>
                m.latestStats && m.latestStats.maxDrawdownPercent <= parseFloat(maxDrawdown)
            );
        }

        if (minReturn !== undefined) {
            filteredMasters = filteredMasters.filter(m =>
                m.latestStats && m.latestStats.totalPnLPercentage >= parseFloat(minReturn)
            );
        }

        // Sort by criteria
        if (sortBy === 'roi') {
            filteredMasters.sort((a, b) =>
                (b.latestStats?.totalPnLPercentage || 0) - (a.latestStats?.totalPnLPercentage || 0)
            );
        } else if (sortBy === 'winRate') {
            filteredMasters.sort((a, b) =>
                (b.latestStats?.winRate || 0) - (a.latestStats?.winRate || 0)
            );
        } else if (sortBy === 'copiers') {
            filteredMasters.sort((a, b) =>
                (b.latestStats?.activeCopiers || 0) - (a.latestStats?.activeCopiers || 0)
            );
        } else if (sortBy === 'drawdown') {
            filteredMasters.sort((a, b) =>
                (a.latestStats?.maxDrawdownPercent || 100) - (b.latestStats?.maxDrawdownPercent || 100)
            );
        } else if (sortBy === 'trending') {
            filteredMasters.sort((a, b) =>
                (b.latestStats?.weeklyPnL || 0) - (a.latestStats?.weeklyPnL || 0)
            );
        } else if (sortBy === 'newest') {
            filteredMasters.sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );
        }

        // FIXED: Proper pagination on filtered results
        const totalFilteredRecords = filteredMasters.length;
        const paginatedMasters = filteredMasters.slice(offset, offset + limit);

        userLogger.info('Exiting masterTraderList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Traders list.",
            data: {
                totalRecords: totalFilteredRecords,
                totalPages: Math.ceil(totalFilteredRecords / sizePerPage),
                currentPage: parseInt(page, 10),
                chartTimeframe: chartWindow.chartTimeframe,
                masterTraders: paginatedMasters
            },
        });
    } catch (e) {
        userLogger.error('Error in masterTraderList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Master Trader Detail
module.exports.getMasterTraderDetail = async (request, response) => {
    try {
        userLogger.info('Entering getMasterTraderDetail', { method: request.method || "", route: request.originalUrl || "" });
        const masterTraderId = request.params.masterTraderId || request.query.masterTraderId;
        const chartWindow = resolveChartWindow(request.query.chartTimeframe || request.query.timeframe);
        const { user } = request.body;

        if (!masterTraderId) {
            throw CustomErrorHandler.badRequest("masterTraderId is required!");
        }

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const masterTrader = await MasterTraderModel.findOne({
            where: {
                id: masterTraderId,
                isDeleted: false,
                status: 'ACTIVE'
            },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name", "country"]
                },
                {
                    model: Mt5AccountModel,
                    as: "mt5Account",
                    attributes: ["id", "Login", "accountType"]
                }
            ]
        });

        if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found or not available!");

        // Fetch latest stats
        const latestStats = MasterTraderStatsModel
            ? await MasterTraderStatsModel.findOne({
                where: { masterTraderId: masterTrader.id, isDeleted: false },
                order: [["snapshotDate", "DESC"]],
                limit: 1
            })
            : null;

        const login = masterTrader.mt5Account?.Login;
        const pnlPerformanceChart = login
            ? await buildPnlChartFromDeals(login, chartWindow.pointLimit)
            : await getPnlPerformanceChart(masterTrader.id, chartWindow.pointLimit);

        // Fetch equity curve data (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const equityCurve = MasterTraderEquityCurveModel
            ? await MasterTraderEquityCurveModel.findAll({
                where: {
                    masterTraderId: masterTrader.id,
                    timestamp: { [Op.gte]: thirtyDaysAgo },
                    isDeleted: false
                },
                attributes: ["timestamp", "balance", "equity", "profitLoss", "returnPercent", "drawdown"],
                order: [["timestamp", "ASC"]],
                limit: 300
            })
            : [];

        // Check if current user is watching this master (optional feature)
        let isWatching = false;
        try {
            const [watchCount] = await sequelize.query(
                `SELECT COUNT(*) as count FROM "MasterTraderWatchers" 
                 WHERE "userId" = :userId 
                 AND "masterTraderId" = :masterTraderId 
                 AND "isDeleted" = false`,
                {
                    replacements: { userId: user.id, masterTraderId: masterTrader.id },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            isWatching = parseInt(watchCount.count, 10) > 0;
        } catch (error) {
            userLogger.error('Error in getMasterTraderDetail', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
            const relationMissing =
                error?.original?.code === "42P01" ||
                error?.parent?.code === "42P01";

            if (!relationMissing) {
                throw error;
            }
        }

        // Check if current user has an active subscription
        const userSubscription = CopyTradeSubscriptionModel
            ? await CopyTradeSubscriptionModel.findOne({
                where: {
                    userId: user.id,
                    masterTraderId: masterTrader.id,
                    isDeleted: false
                },
                order: [["createdAt", "DESC"]]
            })
            : null;

        // Fetch reviews
        const reviews = MasterTraderReviewModel
            ? await MasterTraderReviewModel.findAll({
                where: {
                    masterTraderId: masterTrader.id,
                    isDeleted: false
                },
                attributes: { exclude: ["status"] },
                include: [
                    {
                        model: UserModel,
                        as: "user",
                        attributes: ["id", "userName", "name"]
                    }
                ],
                order: [["createdAt", "DESC"]],
                limit: 20
            })
            : [];

        // Calculate average rating
        let reviewsRating = 0;
        if (reviews && reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + parseFloat(review.rating), 0);
            reviewsRating = (totalRating / reviews.length).toFixed(2);
        }

        userLogger.info('Exiting getMasterTraderDetail: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader details.",
            data: {
                masterTrader,
                latestStats,
                chartTimeframe: chartWindow.chartTimeframe,
                pnlPerformanceChart,
                equityCurve,
                isWatching,
                userSubscription,
                reviewsCount: reviews.length,
                reviewsRating: parseFloat(reviewsRating)
            },
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

// Submit or update Master Trader review
module.exports.submitMasterTraderReview = async (request, response) => {
    try {
        userLogger.info('Entering submitMasterTraderReview', { method: request.method || "", route: request.originalUrl || "" });
        if (!MasterTraderReviewModel) {
            throw CustomErrorHandler.notAllowed("Review feature is not available right now.");
        }

        const { user, masterTraderId, rating, comment = "" } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const masterTrader = await MasterTraderModel.findOne({
            where: {
                id: masterTraderId,
                isDeleted: false,
                status: "ACTIVE"
            },
            attributes: ["id"]
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found or not available!");

        const existingReview = await MasterTraderReviewModel.findOne({
            where: {
                userId: user.id,
                masterTraderId,
                isDeleted: false
            }
        });

        if (existingReview) {
            await existingReview.update({
                rating,
                comment,
                status: "APPROVED"
            });

            userLogger.info('Exiting submitMasterTraderReview: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
            return response.json({
                status: true,
                message: "Review updated successfully.",
                data: existingReview
            });
        }

        const review = await MasterTraderReviewModel.create({
            userId: user.id,
            masterTraderId,
            rating,
            comment,
            status: "APPROVED"
        });

        userLogger.info('Exiting submitMasterTraderReview: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.status(201).json({
            status: true,
            message: "Review submitted successfully.",
            data: review
        });
    } catch (e) {
        userLogger.error('Error in submitMasterTraderReview', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Delete Master Trader Review
module.exports.deleteMasterTraderReview = async (request, response) => {
    try {
        userLogger.info('Entering deleteMasterTraderReview', { method: request.method || "", route: request.originalUrl || "" });
        if (!MasterTraderReviewModel) {
            throw CustomErrorHandler.notAllowed("Review feature is not available right now.");
        }

        const { user } = request.body;
        const { masterTraderId } = request.params;

        // Find review
        const review = await MasterTraderReviewModel.findOne({
            where: {
                userId: user.id,
                masterTraderId,
                isDeleted: false
            }
        });

        if (!review) {
            userLogger.info('Exiting deleteMasterTraderReview: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
            return response.status(404).json({
                status: false,
                message: "Review not found.",
                data: null
            });
        }

        // Soft delete
        await review.update({ isDeleted: true });

        userLogger.info('Exiting deleteMasterTraderReview: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Review deleted successfully.",
            data: review
        });
    } catch (e) {
        userLogger.error('Error in deleteMasterTraderReview', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Master Trader Reviews List
module.exports.getMasterTraderReviews = async (request, response) => {
    try {
        userLogger.info('Entering getMasterTraderReviews', { method: request.method || "", route: request.originalUrl || "" });
        if (!MasterTraderReviewModel) {
            throw CustomErrorHandler.notAllowed("Review feature is not available right now.");
        }

        const { masterTraderId } = request.params;
        const { page = 1, sizePerPage = 10 } = request.query;

        // Validate master trader exists
        const masterTrader = await MasterTraderModel.findOne({
            where: { id: masterTraderId, isDeleted: false }
        });

        if (!masterTrader) {
            throw CustomErrorHandler.notFound("Master Trader not found!");
        }

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const { count, rows } = await MasterTraderReviewModel.findAndCountAll({
            where: {
                masterTraderId,
                isDeleted: false
            },
            attributes: { exclude: ["status"] },
            include: [
                {
                    model: UserModel,
                    as: "user",
                    attributes: ["id", "userName", "name"]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        // Calculate average rating
        let averageRating = 0;
        if (rows.length > 0) {
            const totalRating = rows.reduce((sum, review) => sum + parseFloat(review.rating), 0);
            averageRating = (totalRating / rows.length).toFixed(2);
        }

        userLogger.info('Exiting getMasterTraderReviews: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader reviews list.",
            data: {
                masterTraderId,
                totalReviews: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page, 10),
                averageRating: parseFloat(averageRating),
                reviews: rows
            }
        });
    } catch (e) {
        userLogger.error('Error in getMasterTraderReviews', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Watch Master Trader
module.exports.watchMasterTrader = async (request, response) => {
    try {
        userLogger.info('Entering watchMasterTrader', { method: request.method || "", route: request.originalUrl || "" });
        if (!MasterTraderWatcherModel) {
            throw CustomErrorHandler.notAllowed("Watchlist feature is not available right now.");
        }

        const { user, masterTraderId, notificationsEnabled = true } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const masterTrader = await MasterTraderModel.findOne({
            where: {
                id: masterTraderId,
                isDeleted: false,
                status: 'ACTIVE'
            }
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found!");

        // Check if already watching
        const existingWatch = await MasterTraderWatcherModel.findOne({
            where: {
                userId: user.id,
                masterTraderId,
                isDeleted: false
            }
        });

        if (existingWatch) {
            throw CustomErrorHandler.alreadyExist("Already watching this Master Trader!");
        }

        // Add to watchlist
        const watcher = await MasterTraderWatcherModel.create({
            userId: user.id,
            masterTraderId,
            notificationsEnabled
        });

        userLogger.info('Exiting watchMasterTrader: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader added to watchlist.",
            data: watcher,
        });
    } catch (e) {
        userLogger.error('Error in watchMasterTrader', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Unwatch Master Trader
module.exports.unwatchMasterTrader = async (request, response) => {
    try {
        userLogger.info('Entering unwatchMasterTrader', { method: request.method || "", route: request.originalUrl || "" });
        if (!MasterTraderWatcherModel) {
            throw CustomErrorHandler.notAllowed("Watchlist feature is not available right now.");
        }

        const { masterTraderId } = request.params;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const watcher = await MasterTraderWatcherModel.findOne({
            where: {
                userId: user.id,
                masterTraderId,
                isDeleted: false
            }
        });

        if (!watcher) {
            throw CustomErrorHandler.notFound("Not watching this Master Trader!");
        }

        watcher.isDeleted = true;
        await watcher.save();

        userLogger.info('Exiting unwatchMasterTrader: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader removed from watchlist.",
            data: null,
        });
    } catch (e) {
        userLogger.error('Error in unwatchMasterTrader', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get My Watchlist
module.exports.getMyWatchlist = async (request, response) => {
    try {
        userLogger.info('Entering getMyWatchlist', { method: request.method || "", route: request.originalUrl || "" });
        if (!MasterTraderWatcherModel) {
            throw CustomErrorHandler.notAllowed("Watchlist feature is not available right now.");
        }

        const { page = 1, sizePerPage = 10 } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const { count, rows } = await MasterTraderWatcherModel.findAndCountAll({
            where: {
                userId: user.id,
                isDeleted: false
            },
            include: [
                {
                    model: MasterTraderModel,
                    as: "masterTrader",
                    where: { isDeleted: false },
                    include: [
                        {
                            model: UserModel,
                            as: "user",
                            attributes: ["id", "userName", "name"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        // Fetch latest stats for each master
        const watchlistWithStats = await Promise.all(
            rows.map(async (watch) => {
                const latestStats = MasterTraderStatsModel
                    ? await MasterTraderStatsModel.findOne({
                        where: { masterTraderId: watch.masterTrader.id, isDeleted: false },
                        order: [["snapshotDate", "DESC"]],
                        limit: 1
                    })
                    : null;

                return {
                    ...watch.toJSON(),
                    masterTrader: {
                        ...watch.masterTrader.toJSON(),
                        latestStats
                    }
                };
            })
        );

        userLogger.info('Exiting getMyWatchlist: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "My watchlist.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page, 10),
                watchlist: watchlistWithStats,
            },
        });
    } catch (e) {
        userLogger.error('Error in getMyWatchlist', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Toggle Watchlist Notifications
module.exports.toggleWatchlistNotifications = async (request, response) => {
    try {
        userLogger.info('Entering toggleWatchlistNotifications', { method: request.method || "", route: request.originalUrl || "" });
        if (!MasterTraderWatcherModel) {
            throw CustomErrorHandler.notAllowed("Watchlist feature is not available right now.");
        }

        const { masterTraderId, notificationsEnabled } = request.body;
        const { user } = request.body;

        if (typeof notificationsEnabled !== 'boolean') {
            throw CustomErrorHandler.badRequest("notificationsEnabled must be a boolean value!");
        }

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const watcher = await MasterTraderWatcherModel.findOne({
            where: {
                userId: user.id,
                masterTraderId,
                isDeleted: false
            }
        });

        if (!watcher) {
            throw CustomErrorHandler.notFound("Not watching this Master Trader!");
        }

        watcher.notificationsEnabled = notificationsEnabled;
        await watcher.save();

        userLogger.info('Exiting toggleWatchlistNotifications: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: `Notifications ${notificationsEnabled ? 'enabled' : 'disabled'} for this master trader.`,
            data: {
                masterTraderId,
                notificationsEnabled: watcher.notificationsEnabled,
            },
        });
    } catch (e) {
        userLogger.error('Error in toggleWatchlistNotifications', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Subscribe to Master Trader
module.exports.subscribeMasterTrader = async (request, response) => {
    try {
        userLogger.info('Entering subscribeMasterTrader', { method: request.method || "", route: request.originalUrl || "" });
        if (!CopyTradeSubscriptionModel) {
            throw CustomErrorHandler.notAllowed("Subscription feature is not available right now.");
        }

        const {
            user,
            masterTraderId,
            mt5Login
        } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        // Validate master trader
        const masterTrader = await MasterTraderModel.findOne({
            where: {
                id: masterTraderId,
                isDeleted: false,
                status: 'ACTIVE'
            }
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("Master Trader not found or not active!");

        // Validate MT5 account belongs to user
        const mt5Account = await Mt5AccountModel.findOne({
            where: {
                userId: user.id,
                Login: mt5Login,
                isDeleted: false
            },
            attributes: ["id", "Login", "Balance", "Credit"]
        });
        if (!mt5Account) throw CustomErrorHandler.notFound("MT5 account not found or doesn't belong to you!");

        // Check balance requirement
        if (masterTrader.minimumCopyBalance > 0 && parseFloat(mt5Account.Balance) < parseFloat(masterTrader.minimumCopyBalance)) {
            throw CustomErrorHandler.notAllowed(`Insufficient balance. A minimum of $${masterTrader.minimumCopyBalance} is required to copy this trader. Your account balance is $${parseFloat(mt5Account.Balance).toFixed(2)}.`);
        }

        // Check if already subscribed
        const existingSubscription = await CopyTradeSubscriptionModel.findOne({
            where: {
                userId: user.id,
                masterTraderId,
                login: mt5Login,
                isDeleted: false,
                status: { [Op.in]: ['ACTIVE', 'PENDING'] }
            }
        });

        if (existingSubscription) {
            throw CustomErrorHandler.alreadyExist("Already subscribed to this Master Trader on this account!");
        }

        // Check max copiers limit (using raw query)
        const [copiersCount] = await sequelize.query(
            `SELECT COUNT(*) as count FROM "CopyTradeSubscriptions" 
             WHERE master_trader_id = :masterTraderId 
             AND status = 'ACTIVE' 
             AND is_deleted = false`,
            {
                replacements: { masterTraderId },
                type: sequelize.QueryTypes.SELECT
            }
        );
        const currentCopiers = parseInt(copiersCount.count) || 0;

        if (currentCopiers >= masterTrader.maxCopiers) {
            throw CustomErrorHandler.notAllowed("Master Trader has reached maximum copiers limit!");
        }

        // Create CopyTrade record first
        const copyTrade = await CopyTradeModel.create({
            userId: user.id,
            masterTraderId,
            followerMt5Login: mt5Login,
            riskType: 'MULTIPLIER',
            multiplier: 1.0,
            status: 'ACTIVE'
        });

        // Create subscription (AUTO-APPROVED)
        const subscription = await CopyTradeSubscriptionModel.create({
            userId: user.id,
            copyTradeId: copyTrade.id,
            masterTraderId,
            login: mt5Login,
            status: 'ACTIVE',
            subscribedAt: new Date(),
            approvedAt: new Date(),
            approvedBy: user.id
        });

        syncMasterTraderPluginTargets(masterTraderId).catch((err) => {
            userLogger.error('syncMasterTraderPluginTargets failed after subscribe', { error: err?.message || err });
        });

        // Fetch complete data
        const subscriptionData = await CopyTradeSubscriptionModel.findOne({
            where: { id: subscription.id },
            include: [
                {
                    model: MasterTraderModel,
                    as: "masterTrader",
                    attributes: ["id", "displayName"]
                }
            ]
        });

        userLogger.info('Exiting subscribeMasterTrader: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Subscription approved successfully.",
            data: subscriptionData,
        });
    } catch (e) {
        userLogger.error('Error in subscribeMasterTrader', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Unsubscribe from Master Trader
module.exports.unsubscribeMasterTrader = async (request, response) => {
    try {
        userLogger.info('Entering unsubscribeMasterTrader', { method: request.method || "", route: request.originalUrl || "" });
        if (!CopyTradeSubscriptionModel) {
            throw CustomErrorHandler.notAllowed("Subscription feature is not available right now.");
        }

        const { user, subscriptionId } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const subscriptionById = await CopyTradeSubscriptionModel.findOne({
            where: { id: subscriptionId }
        });

        if (!subscriptionById) throw CustomErrorHandler.notFound(`Subscription #${subscriptionId} not found.`);
        if (subscriptionById.isDeleted) throw CustomErrorHandler.notFound("Subscription already cancelled.");
        if (String(subscriptionById.userId) !== String(user.id)) throw CustomErrorHandler.notAllowed("Subscription does not belong to this account.");

        const subscription = subscriptionById;

        // Update linked CopyTrade status if exists
        if (subscription.copyTradeId) {
            try {
                const copyTrade = await CopyTradeModel.findOne({
                    where: { id: subscription.copyTradeId, isDeleted: false }
                });
                if (copyTrade) {
                    copyTrade.status = 'STOPPED';
                    await copyTrade.save();
                }
            } catch (error) {
                userLogger.error('Error in unsubscribeMasterTrader', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
                console.error('[Copy Trade] Error updating CopyTrade status:', error.message);
            }
        }

        subscription.status = 'INACTIVE';
        subscription.unsubscribedAt = new Date();
        subscription.isDeleted = true;
        await subscription.save();

        syncMasterTraderPluginTargets(subscription.masterTraderId).catch((err) => {
            userLogger.error('syncMasterTraderPluginTargets failed after unsubscribe', { error: err?.message || err });
        });

        userLogger.info('Exiting unsubscribeMasterTrader: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Successfully unsubscribed from Master Trader.",
            data: null,
        });
    } catch (e) {
        userLogger.error('Error in unsubscribeMasterTrader', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get My Subscriptions
module.exports.getMySubscriptions = async (request, response) => {
    try {
        userLogger.info('Entering getMySubscriptions', { method: request.method || "", route: request.originalUrl || "" });
        if (!CopyTradeSubscriptionModel) {
            throw CustomErrorHandler.notAllowed("Subscription feature is not available right now.");
        }

        const { page = 1, sizePerPage = 10, status } = request.query;
        const { user } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const offset = (page - 1) * sizePerPage;
        const limit = parseInt(sizePerPage);

        const whereCondition = {
            userId: user.id,
            isDeleted: false
        };
        if (status) whereCondition.status = status;

        // Use raw SQL for count to avoid Sequelize association issues
        const countQuery = status
            ? `SELECT COUNT(*) as count FROM "CopyTradeSubscriptions" 
               WHERE user_id = :userId AND is_deleted = false AND status = :status`
            : `SELECT COUNT(*) as count FROM "CopyTradeSubscriptions" 
               WHERE user_id = :userId AND is_deleted = false`;

        const replacements = status
            ? { userId: user.id, status }
            : { userId: user.id };

        const [countResult] = await sequelize.query(countQuery, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });

        const count = parseInt(countResult.count);

        // Use findAll for actual data retrieval
        const rows = await CopyTradeSubscriptionModel.findAll({
            where: whereCondition,
            include: [
                {
                    model: MasterTraderModel,
                    as: "masterTrader",
                    include: [
                        {
                            model: UserModel,
                            as: "user",
                            attributes: ["id", "userName", "name"]
                        }
                    ]
                }
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset
        });

        userLogger.info('Exiting getMySubscriptions: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "My subscriptions.",
            data: {
                totalRecords: count,
                totalPages: Math.ceil(count / sizePerPage),
                currentPage: parseInt(page, 10),
                subscriptions: rows,
            },
        });
    } catch (e) {
        userLogger.error('Error in getMySubscriptions', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Update Subscription Settings
module.exports.updateSubscriptionSettings = async (request, response) => {
    try {
        userLogger.info('Entering updateSubscriptionSettings', { method: request.method || "", route: request.originalUrl || "" });
        if (!CopyTradeSubscriptionModel) {
            throw CustomErrorHandler.notAllowed("Subscription feature is not available right now.");
        }

        throw CustomErrorHandler.notAllowed("Subscription settings are not supported. Trades are copied as-is.");

    } catch (e) {
        userLogger.error('Error in updateSubscriptionSettings', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Pause Subscription
module.exports.pauseSubscription = async (request, response) => {
    try {
        userLogger.info('Entering pauseSubscription', { method: request.method || "", route: request.originalUrl || "" });
        if (!CopyTradeSubscriptionModel) {
            throw CustomErrorHandler.notAllowed("Subscription feature is not available right now.");
        }

        const { user, subscriptionId, reason } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const subscription = await CopyTradeSubscriptionModel.findOne({
            where: {
                id: subscriptionId,
                userId: user.id,
                isDeleted: false
            }
        });

        if (!subscription) throw CustomErrorHandler.notFound("Subscription not found!");
        if (!["ACTIVE", "PENDING"].includes(subscription.status)) {
            throw CustomErrorHandler.notAllowed(`Cannot pause a subscription with status "${subscription.status}".`);
        }

        // Update linked CopyTrade status
        if (subscription.copyTradeId) {
            try {
                const copyTrade = await CopyTradeModel.findOne({
                    where: { id: subscription.copyTradeId, isDeleted: false }
                });
                if (copyTrade) {
                    copyTrade.status = 'PAUSED';
                    await copyTrade.save();
                }
            } catch (error) {
                userLogger.error('Error updating CopyTrade status in pauseSubscription', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
                console.error("[Copy Trade] Error updating CopyTrade status:", error.message);
            }
        }

        subscription.status = "PAUSED";
        await subscription.save();

        syncMasterTraderPluginTargets(subscription.masterTraderId).catch((err) => {
            userLogger.error('syncMasterTraderPluginTargets failed after pause', { error: err?.message || err });
        });

        userLogger.info('Exiting pauseSubscription: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Subscription paused successfully.",
            data: subscription,
        });
    } catch (e) {
        userLogger.error('Error in pauseSubscription', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Resume Subscription
module.exports.resumeSubscription = async (request, response) => {
    try {
        userLogger.info('Entering resumeSubscription', { method: request.method || "", route: request.originalUrl || "" });
        if (!CopyTradeSubscriptionModel) {
            throw CustomErrorHandler.notAllowed("Subscription feature is not available right now.");
        }

        const { user, subscriptionId } = request.body;

        const userData = await UserModel.findOne({
            where: { id: user.id, isDeleted: false },
            attributes: ["id"]
        });
        if (!userData) throw CustomErrorHandler.notFound("User not found!");

        const subscription = await CopyTradeSubscriptionModel.findOne({
            where: {
                id: subscriptionId,
                userId: user.id,
                isDeleted: false
            }
        });

        if (!subscription) throw CustomErrorHandler.notFound("Subscription not found!");
        if (subscription.status !== "PAUSED") {
            throw CustomErrorHandler.notAllowed("Only paused subscriptions can be resumed!");
        }

        // Validate master trader is active
        const masterTrader = await MasterTraderModel.findOne({
            where: {
                id: subscription.masterTraderId,
                isDeleted: false,
                status: "ACTIVE"
            }
        });

        if (!masterTrader) {
            throw CustomErrorHandler.notAllowed("Master Trader is not active. Cannot resume subscription.");
        }

        // Validate MT5 account and balance
        const mt5Account = await Mt5AccountModel.findOne({
            where: {
                userId: user.id,
                Login: subscription.login,
                isDeleted: false
            },
            attributes: ["id", "Login", "Balance"]
        });
        if (!mt5Account) {
            throw CustomErrorHandler.notFound("Follower MT5 account not found!");
        }

        // Update linked CopyTrade status
        if (subscription.copyTradeId) {
            try {
                const copyTrade = await CopyTradeModel.findOne({
                    where: { id: subscription.copyTradeId, isDeleted: false }
                });
                if (copyTrade) {
                    copyTrade.status = 'ACTIVE';
                    await copyTrade.save();
                }
            } catch (error) {
                userLogger.error('Error updating CopyTrade status in resumeSubscription', { stack: error.stack || error, method: request.method || "", route: request.originalUrl || "" });
                console.error("[Copy Trade] Error updating CopyTrade status:", error.message);
            }
        }

        subscription.status = "ACTIVE";
        await subscription.save();

        syncMasterTraderPluginTargets(subscription.masterTraderId).catch((err) => {
            userLogger.error('syncMasterTraderPluginTargets failed after resume', { error: err?.message || err });
        });

        userLogger.info('Exiting resumeSubscription: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Subscription resumed successfully.",
            data: subscription,
        });
    } catch (e) {
        userLogger.error('Error in resumeSubscription', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Unified Subscription Update (Settings / Pause / Resume / Unsubscribe)
module.exports.updateSubscription = async (request, response) => {
    try {
        userLogger.info('Entering updateSubscription', { method: request.method || "", route: request.originalUrl || "" });
        const {
            subscriptionId,
            pauseSubscription,
            resumeSubscription,
            unsubscribe,
            reason
        } = request.body;

        const actionFlags = [
            pauseSubscription === true,
            resumeSubscription === true,
            unsubscribe === true,
        ].filter(Boolean);

        if (actionFlags.length > 1) {
            throw CustomErrorHandler.badRequest("Only one action is allowed at a time: pauseSubscription, resumeSubscription, or unsubscribe.");
        }

        if (unsubscribe === true) {
            request.body.subscriptionId = subscriptionId;
            return module.exports.unsubscribeMasterTrader(request, response);
        }

        if (pauseSubscription === true) {
            request.body.subscriptionId = subscriptionId;
            return module.exports.pauseSubscription(request, response);
        }

        if (resumeSubscription === true) {
            request.body.subscriptionId = subscriptionId;
            return module.exports.resumeSubscription(request, response);
        }

        throw CustomErrorHandler.badRequest("Please provide one action flag (pauseSubscription/resumeSubscription/unsubscribe).");
    } catch (e) {
        userLogger.error('Error in updateSubscription', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Master Trader's Trade List (Deals)
module.exports.getMasterTraderTradeList = async (request, response) => {
    try {
        userLogger.info('Entering getMasterTraderTradeList', { method: request.method || "", route: request.originalUrl || "" });
        const { masterTraderId } = request.params;
        const { page = 1, sizePerPage = 20, fromDate, toDate, sortOrder = 'desc' } = request.query;

        if (!masterTraderId) {
            throw CustomErrorHandler.notFound("Master Trader ID is required");
        }

        // Fetch master trader
        const masterTrader = await MasterTraderModel.findOne({
            where: { id: masterTraderId, isDeleted: false, status: 'ACTIVE' },
            include: [
                {
                    model: Mt5AccountModel,
                    as: "mt5Account",
                    attributes: ["Login", "Balance"]
                }
            ]
        });

        if (!masterTrader) {
            throw CustomErrorHandler.notFound("Master Trader not found");
        }

        if (!masterTrader.mt5Account) {
            return response.json({
                status: true,
                message: "Master Trader trades list.",
                data: {
                    masterTrader: { id: masterTrader.id, displayName: masterTrader.displayName },
                    totalRecords: 0,
                    totalPages: 0,
                    currentPage: parseInt(page, 10),
                    trades: []
                }
            });
        }

        const DealsControllers = require("../../mt5Services/deals");

        // Resolve date range — honour fromDate/toDate query params if provided (YYYY-MM-DD or Unix ts)
        const nowTs = Math.floor(Date.now() / 1000);
        const resolvedFromTs = fromDate
            ? (isNaN(Number(fromDate)) ? Math.floor(new Date(fromDate).getTime() / 1000) : Number(fromDate))
            : 0;
        const resolvedToTs = toDate
            ? (isNaN(Number(toDate)) ? Math.floor(new Date(toDate).getTime() / 1000) + 86399 : Number(toDate))
            : nowTs;

        // Fetch total deal count first
        const totalResponse = await DealsControllers.getDealsList(masterTrader.mt5Account.Login, resolvedFromTs, resolvedToTs);
        const totalDealCount = parseInt(totalResponse?.answer?.total ?? totalResponse?.answer?.count ?? 0, 10) || 0;

        // Batch-fetch ALL deals so we can filter to closing deals and sort correctly.
        // totalDealCount includes non-closing deals (opens, balance ops), so we cannot
        // rely on offset-based server pagination for accurate sort+paginate.
        const BATCH = 1000;
        let allDeals = [];
        let fetchOffset = 0;
        while (fetchOffset < totalDealCount) {
            const res = await DealsControllers.getDealsPage(
                masterTrader.mt5Account.Login, resolvedFromTs, resolvedToTs, fetchOffset, BATCH
            );
            const batch = res?.answer;
            if (!Array.isArray(batch) || batch.length === 0) break;
            allDeals = allDeals.concat(batch);
            fetchOffset += batch.length;
        }

        // Keep only closing deals (Entry=1), sort, then paginate in JS
        const closingDeals = allDeals.filter(d => String(d.Entry) === '1');
        closingDeals.sort((a, b) =>
            sortOrder === 'asc'
                ? parseInt(a.Time ?? 0, 10) - parseInt(b.Time ?? 0, 10)
                : parseInt(b.Time ?? 0, 10) - parseInt(a.Time ?? 0, 10)
        );

        const pageNum  = parseInt(page, 10);
        const pageSize = parseInt(sizePerPage, 10);
        const paginatedDeals = closingDeals.slice((pageNum - 1) * pageSize, pageNum * pageSize);

        const formattedDeals = paginatedDeals.map(deal => ({
            ticket: deal.Deal,
            orderId: deal.Order,
            positionId: deal.PositionID,
            symbol: deal.Symbol,
            type: parseInt(deal.Action ?? 0, 10), // 0=Buy, 1=Sell
            volume: parseFloat(deal.Volume ?? 0) / 10000,
            price: parseFloat(deal.Price ?? 0),
            commission: parseFloat(deal.Commission ?? 0),
            profit: parseFloat(deal.Profit ?? 0),
            swap: parseFloat(deal.Storage ?? 0),
            comment: deal.Comment,
            time: deal.Time,
        }));

        userLogger.info('Exiting getMasterTraderTradeList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader trades list.",
            data: {
                masterTrader: {
                    id: masterTrader.id,
                    displayName: masterTrader.displayName,
                    mt5Login: masterTrader.mt5Account.Login
                },
                totalRecords: closingDeals.length,
                totalPages: Math.ceil(closingDeals.length / pageSize),
                currentPage: pageNum,
                trades: formattedDeals,
                tradesOnPage: formattedDeals.length
            }
        });
    } catch (e) {
        userLogger.error('Error in getMasterTraderTradeList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Get Copiers List for a Specific Master Trader (User)
module.exports.getMasterTraderCopiers = async (request, response) => {
    try {
        userLogger.info('Entering getMasterTraderCopiers', { method: request.method || "", route: request.originalUrl || "" });
        const { masterTraderId } = request.params;
        const { status, page = 1, sizePerPage = 10 } = request.query;

        const masterTrader = await MasterTraderModel.findOne({
            where: { id: masterTraderId, isDeleted: false, status: "ACTIVE" },
            attributes: ["id", "displayName", "mt5Login", "status"]
        });
        if (!masterTrader) {
            throw CustomErrorHandler.notFound("Master Trader not found");
        }

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
                    attributes: ["id", "userName", "name", "country"]
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

        userLogger.info('Exiting getMasterTraderCopiers: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
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
                    status: copier.status,
                    totalCopiedTrades: copier.totalCopiedTrades,
                    totalPnL: parseFloat(copier.totalPnL || 0),
                    subscribedOn: copier.createdAt
                }))
            }
        });
    } catch (e) {
        userLogger.error('Error in getMasterTraderCopiers', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};


// Get My Master Trader Profile (self-service)
module.exports.getMyMasterTraderProfile = async (request, response) => {
    try {
        userLogger.info('Entering getMyMasterTraderProfile', { method: request.method || "", route: request.originalUrl || "" });
        const { user } = request.body;

        const masterTrader = await MasterTraderModel.findOne({
            where: { userId: user.id, isDeleted: false },
            include: [
                {
                    model: Mt5AccountModel,
                    as: "mt5Account",
                    attributes: ["id", "Login", "accountType"]
                }
            ]
        });

        if (!masterTrader) {
            return response.json({
                status: true,
                message: "No master trader profile found for this account.",
                data: null
            });
        }

        userLogger.info('Exiting getMyMasterTraderProfile: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader profile.",
            data: masterTrader.toJSON()
        });
    } catch (e) {
        userLogger.error('Error in getMyMasterTraderProfile', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Upload My Master Trader Profile Photo (self-service)
module.exports.uploadMyMasterTraderPhoto = async (request, response) => {
    try {
        userLogger.info('Entering uploadMyMasterTraderPhoto', { method: request.method || "", route: request.originalUrl || "" });
        const user = request.user || request.body.user;

        if (!request.file) {
            return response.status(400).json({ status: false, message: "No file uploaded.", data: null });
        }

        const masterTrader = await MasterTraderModel.findOne({
            where: { userId: user.id, isDeleted: false }
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("You do not have a master trader profile.");

        // Remove old photo from disk
        if (masterTrader.profilePhoto) {
            const oldFile = path.join(__dirname, "../../public", masterTrader.profilePhoto);
            if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }

        masterTrader.profilePhoto = `/masterTraderProfile/${request.file.filename}`;
        await masterTrader.save();

        userLogger.info('Exiting uploadMyMasterTraderPhoto: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Profile photo updated successfully.",
            data: { profilePhoto: masterTrader.profilePhoto }
        });
    } catch (e) {
        userLogger.error('Error in uploadMyMasterTraderPhoto', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.uploadMyMasterTraderCoverPhoto = async (request, response) => {
    try {
        userLogger.info('Entering uploadMyMasterTraderCoverPhoto', { method: request.method || "", route: request.originalUrl || "" });
        const user = request.user || request.body.user;

        if (!request.file) {
            return response.status(400).json({ status: false, message: "No file uploaded.", data: null });
        }

        const masterTrader = await MasterTraderModel.findOne({
            where: { userId: user.id, isDeleted: false }
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("You do not have a master trader profile.");

        if (masterTrader.coverPhoto) {
            const oldFile = path.join(__dirname, "../../public", masterTrader.coverPhoto);
            if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }

        masterTrader.coverPhoto = `/masterTraderProfile/${request.file.filename}`;
        await masterTrader.save();

        userLogger.info('Exiting uploadMyMasterTraderCoverPhoto: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Cover photo updated successfully.",
            data: { coverPhoto: masterTrader.coverPhoto }
        });
    } catch (e) {
        userLogger.error('Error in uploadMyMasterTraderCoverPhoto', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

// Update My Master Trader Profile (self-service)
module.exports.updateMyMasterTraderProfile = async (request, response) => {
    try {
        userLogger.info('Entering updateMyMasterTraderProfile', { method: request.method || "", route: request.originalUrl || "" });
        const { user, displayName, description, riskLevel, tradingStyle, instruments, avgTradeDuration, minimumCopyBalance, maxCopiers } = request.body;

        const masterTrader = await MasterTraderModel.findOne({
            where: { userId: user.id, isDeleted: false }
        });
        if (!masterTrader) throw CustomErrorHandler.notFound("You do not have a master trader profile.");

        if (displayName !== undefined) masterTrader.displayName = displayName;
        if (description !== undefined) masterTrader.description = description;
        if (riskLevel !== undefined) masterTrader.riskLevel = riskLevel;
        if (tradingStyle !== undefined) masterTrader.tradingStyle = tradingStyle;
        if (instruments !== undefined) masterTrader.instruments = instruments;
        if (avgTradeDuration !== undefined) masterTrader.avgTradeDuration = avgTradeDuration;
        if (minimumCopyBalance !== undefined) masterTrader.minimumCopyBalance = minimumCopyBalance;
        if (maxCopiers !== undefined) masterTrader.maxCopiers = maxCopiers;

        await masterTrader.save();

        userLogger.info('Exiting updateMyMasterTraderProfile: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Master Trader profile updated successfully.",
            data: masterTrader.toJSON()
        });
    } catch (e) {
        userLogger.error('Error in updateMyMasterTraderProfile', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};
