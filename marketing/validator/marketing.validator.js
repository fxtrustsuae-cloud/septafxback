const Joi = require("joi");

module.exports.addMarketingMember = async (request, response, next) => {
    const rules = Joi.object().keys({
        name: Joi.string().min(3).max(40).optional(),
        email: Joi.string().email().optional(),
        mobile: Joi.string().min(10).max(15).optional(),
        password: Joi.string().min(6).max(20).required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateMarketingMember = async (request, response, next) => {
    const rules = Joi.object().keys({
        marketingId: Joi.number().min(1).required(),
        name: Joi.string().min(3).max(40).optional(),
        email: Joi.string().email().optional(),
        mobile: Joi.string().min(10).max(15).optional(),
        password: Joi.string().min(6).max(20).optional()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.list = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).optional(),
        search: Joi.string().optional(),
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.getById = (request, response, next) => {
    const rules = Joi.object().keys({
        id: Joi.number().min(1).required()
    });
    const { error } = rules.validate(request.params);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.addLead = (request, response, next) => {
    const rules = Joi.object().keys({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        mobile: Joi.string().required(),
        country: Joi.string().required(),
        status: Joi.string().valid("INTRESTED", "NOT-INTRESTED").required(),
        source: Joi.string().valid("REFERRAL", "ORGANIC").required(),
        description: Joi.string().required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.leadAssignTo = (request, response, next) => {
    const rules = Joi.object().keys({
        marketingMemberId: Joi.number().min(1).required(),
        leadId: Joi.number().min(1).required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

// leadId, name, mobile, email, country, source, status, description, isDeleted
module.exports.leadUpdate = (request, response, next) => {
    const rules = Joi.object().keys({
        leadId: Joi.number().min(1).required(),
        name: Joi.string().optional(),
        mobile: Joi.string().optional(),
        email: Joi.string().email().optional(),
        country: Joi.string().optional(),
        source: Joi.string().valid("REFERRAL", "ORGANIC").optional(),
        status: Joi.string().valid("INTRESTED", "NOT-INTRESTED", "PROGRESS").optional(),
        note: Joi.string().optional(),
        reminder: Joi.date().optional(),
        isDeleted: Joi.bool().optional(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.getPermission = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().integer().min(1).optional()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updatePermission = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().integer().min(1).required(),

        // Marketing
        "ADD-MARKETING": Joi.boolean().optional(),
        "MARKETING-LIST": Joi.boolean().optional(),
        "MARKETING-BY-ID": Joi.boolean().optional(),
        "UPDATE-MARKETING": Joi.boolean().optional(),
        "ADD-LEAD": Joi.boolean().optional(),
        "UPLOAD-LEADS": Joi.boolean().optional(),
        "LEAD-LIST": Joi.boolean().optional(),
        "LEAD-BY-ID": Joi.boolean().optional(),
        "UPDATE-LEAD": Joi.boolean().optional(),
        "ASSING-LEAD": Joi.boolean().optional(),
        "PERMISSION-LIST": Joi.boolean().optional(),
        "UPDATE-PERMISSION": Joi.boolean().optional(),

        // Meta
        "ADD-MT5-ACCOUNT": Joi.boolean().optional(),
        "LIST-MT5-ACCOUNT": Joi.boolean().optional(),
        "UPDATE-MT5-ACCOUNT": Joi.boolean().optional(),

        // User
        "ADD-USER": Joi.boolean().optional(),
        "USER-LIST": Joi.boolean().optional(),
        "KYC": Joi.boolean().optional(),

        // Support
        "SUPPORT": Joi.boolean().optional(),

        // Transaction
        "TRANSACTION-LIST": Joi.boolean().optional(),
        "DEPOSIT-WITHDRAWL-LIST": Joi.boolean().optional(),
        "REFERRAL-LIST": Joi.boolean().optional(),
    });

    const { error } = rules.validate(request.body.data || request.body); // In case "data" is nested

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};