const Joi = require("joi");

module.exports.createMasterTrader = async (request, response, next) => {
    const rules = Joi.object({
        userId: Joi.number().integer().required(),
        mt5Login: Joi.string().required(),
        displayName: Joi.string().required(),
        description: Joi.string().optional().allow(""),
        riskType: Joi.string().valid("LOW", "MEDIUM", "HIGH").optional(),
        tradingStyle: Joi.string().valid("SCALPING", "SWING", "DAY", "POSITION").optional().allow(null),
        instruments: Joi.array().items(Joi.string().valid("FOREX", "INDICES", "COMMODITIES", "CRYPTO", "STOCKS")).optional(),
        avgTradeDuration: Joi.string().valid("MINUTES", "HOURS", "DAYS", "WEEKS").optional().allow(null),
        minimumCopyBalance: Joi.number().min(0).optional(),
        maxCopiers: Joi.number().integer().min(1).optional(),
        mode: Joi.string().valid("Percentage", "Fixed", "Balance", "Equity").optional(),
        rule_name: Joi.string().optional(),
        source_symbol: Joi.string().optional(),
        pluginRule: Joi.object({
            destination_symbol: Joi.string().optional(),
            inverse: Joi.boolean().optional(),
            is_rule_active: Joi.boolean().optional(),
            mode: Joi.string().valid("Percentage", "Fixed", "Balance", "Equity").optional(),
            rule_name: Joi.string().required(),
            source_symbol: Joi.string().optional(),
            targets: Joi.array().items(Joi.alternatives().try(Joi.number(), Joi.string())).required(),
            value: Joi.number().required(),
        }).optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    return next();
};

module.exports.updateMasterTrader = async (request, response, next) => {
    const rules = Joi.object({
        masterTraderId: Joi.number().integer().required(),
        displayName: Joi.string().optional(),
        description: Joi.string().optional().allow(""),
        riskType: Joi.string().valid("LOW", "MEDIUM", "HIGH").optional(),
        tradingStyle: Joi.string().valid("SCALPING", "SWING", "DAY", "POSITION").optional().allow(null),
        instruments: Joi.array().items(Joi.string().valid("FOREX", "INDICES", "COMMODITIES", "CRYPTO", "STOCKS")).optional(),
        avgTradeDuration: Joi.string().valid("MINUTES", "HOURS", "DAYS", "WEEKS").optional().allow(null),
        minimumCopyBalance: Joi.number().min(0).optional(),
        maxCopiers: Joi.number().integer().min(1).optional(),
        status: Joi.string().valid("ACTIVE", "INACTIVE", "SUSPENDED").optional(),
        newMt5Login: Joi.string().optional(),
        isDeleted: Joi.boolean().optional(),
        pluginRuleIndex: Joi.number().integer().min(0).optional(),
        pluginRule: Joi.object({
            destination_symbol: Joi.string().optional(),
            inverse: Joi.boolean().optional(),
            is_rule_active: Joi.boolean().optional(),
            mode: Joi.string().valid("Percentage", "Fixed", "Balance", "Equity").optional(),
            rule_name: Joi.string().required(),
            source_symbol: Joi.string().optional(),
            targets: Joi.array().items(Joi.alternatives().try(Joi.number(), Joi.string())).required(),
            value: Joi.number().required(),
        }).optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    return next();
};

module.exports.getMasterTraderById = async (request, response, next) => {
    const rules = Joi.object({
        id: Joi.number().integer().required(),
    });

    const { error } = rules.validate(request.params);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    return next();
};

module.exports.listMasterTraders = async (request, response, next) => {
    const rules = Joi.object({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        search: Joi.string().optional().allow(""),
        status: Joi.string().valid("ACTIVE", "INACTIVE", "SUSPENDED").optional(),
        chartTimeframe: Joi.string().valid("7D", "30D", "90D").optional(),
        timeframe: Joi.string().valid("7D", "30D", "90D").optional(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    return next();
};

module.exports.getMasterTraderWatchers = async (request, response, next) => {
    const rules = Joi.object({
        masterTraderId: Joi.number().integer().min(1).required(),
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).max(100).optional(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    return next();
};

module.exports.getMasterTraderCopiers = async (request, response, next) => {
    const rules = Joi.object({
        masterTraderId: Joi.number().integer().min(1).required(),
        status: Joi.string().valid("ACTIVE", "PAUSED", "STOPPED").optional(),
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).max(100).optional(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    return next();
};

module.exports.watchlistAnalytics = async (request, response, next) => {
    // No query/body params required for analytics
    return next();
};
