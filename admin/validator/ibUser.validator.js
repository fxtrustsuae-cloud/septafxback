const Joi = require("joi");

module.exports.ibList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        status: Joi.string().valid("PENDING", "APPROVED", "PROCESSING", "REJECTED").optional(),
        userId: Joi.number().integer().min(1).optional(),
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.IbComissionPlanNameList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        search: Joi.string().optional(),
        id: Joi.number().optional()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.addIbComissionPlan = (request, response, next) => {
    const rules = Joi.object().keys({
        planName: Joi.string().min(3).required(),
        // groupId: Joi.number().min(1).required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateIb = (request, response, next) => {
    const rules = Joi.object().keys({
        ibId: Joi.number().integer().min(1).required(),
        status: Joi.string().valid("PENDING", "APPROVED", "PROCESSING", "REJECTED").optional(),
        force: Joi.boolean().required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.addPlan = (request, response, next) => {
    const rules = Joi.object().keys({
        planId: Joi.number().min(1).required(),
        cfdMetals: Joi.boolean().optional(),
        groupId: Joi.number().min(1).required(),
        cfdFx: Joi.boolean().optional(),
        ibId: Joi.number().min(1).required(),
        ibComission: Joi.number().required(),
        planType: Joi.string().valid("GLOBAL-MODEL").required(),
        symbolExtension: Joi.string().allow("").optional(),
    }).or("cfdMetals", "cfdFx");
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updatePlan = (request, response, next) => {
    const rules = Joi.object().keys({
        planId: Joi.number().min(1).optional(),
        groupId: Joi.number().min(1).required(),
        cfdMetals: Joi.boolean().optional(),
        cfdFx: Joi.boolean().optional(),
        planId: Joi.number().min(1).required(),
        isDeleted: Joi.boolean().optional(),
        ibComission: Joi.number().optional(),
        planType: Joi.string().valid("GLOBAL-MODEL").optional(),
        symbolExtension: Joi.string().allow("").optional(),
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
        searchWithLogin: Joi.string().optional(),
        ibId: Joi.number().optional(),
        fromDate: Joi.date().optional(),
        toDate: Joi.date().optional(),
        planId: Joi.number().optional(),
        groupId: Joi.number().optional(),
    });
    const { error } = rules.validate(request.query);
    
    if (error) {
        return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.moveUserToIb = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().min(1).required(),
        ibId: Joi.number().min(1).required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.removeUserFromIb = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().min(1).required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.setSubIbComission = (request, response, next) => {
    const rules = Joi.object().keys({
        ibPlanId: Joi.number().min(1).required(),
        subIbId: Joi.number().min(1).required(),
        amount: Joi.number().required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateSubIbComission = (request, response, next) => {
    const rules = Joi.object().keys({
        comissionId: Joi.number().min(1).required(),
        amount: Joi.number().required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.subIbComissionList = (request, response, next) => {
    const rules = Joi.object().keys({
        planId: Joi.number().min(1).required()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.ibReport = (request, response, next) => {
    const rules = Joi.object().keys({
        ibId: Joi.number().integer().min(1).required(),
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).optional(),
        transactionType: Joi.string().valid("WALLET-DEPOSIT", "WALLET-WITHDRAW").optional(),
        fromDate: Joi.date().iso().optional(),
        toDate: Joi.date().iso().min(Joi.ref("fromDate")).optional(),
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.manualDistribute = (request, response, next) => {
    const rules = Joi.object().keys({
        ibId: Joi.number().integer().min(1).optional(),
        fromDate: Joi.date().iso().optional(),
        toDate: Joi.date().iso().min(Joi.ref("fromDate")).optional(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.mt5OrderList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).optional(),
        ibId: Joi.number().integer().min(1).optional(),
        userId: Joi.number().integer().min(1).optional(),
        isComissionDistributed: Joi.boolean().optional(),
        search: Joi.string().optional(),
        fromDate: Joi.date().iso().optional(),
        toDate: Joi.date().iso().min(Joi.ref("fromDate")).optional(),
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};
