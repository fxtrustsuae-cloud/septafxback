const Joi = require("joi");

module.exports.ibList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        status: Joi.string().valid("PENDING", "APPROVED", "PROCESSING", "REJECTED").optional()
    });
    const { error } = rules.validate(request.query);

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
        status: Joi.string().valid("PENDING", "APPROVED", "PROCESSING", "REJECTED").optional()
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
        planName: Joi.string().min(3).required()
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

module.exports.addComissionGroup = (request, response, next) => {
    const rules = Joi.object().keys({
        planId: Joi.number().min(1).required(),
        groupId: Joi.number().min(1).required(),
        level1Commission: Joi.number().required(),
        level2Commission: Joi.number().required(),
        level3Commission: Joi.number().required(),
        level4Commission: Joi.number().required(),
        level5Commission: Joi.number().required(),
        level6Commission: Joi.number().required(),
        level7Commission: Joi.number().required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateComissionGroup = (request, response, next) => {
    const rules = Joi.object().keys({
        comissionGroupId: Joi.number().min(1).required(),
        planId: Joi.number().min(1).optional(),
        groupId: Joi.number().min(1).optional(),
        level1Commission: Joi.number().optional(),
        level2Commission: Joi.number().optional(),
        level3Commission: Joi.number().optional(),
        level4Commission: Joi.number().optional(),
        level5Commission: Joi.number().optional(),
        level6Commission: Joi.number().optional(),
        level7Commission: Joi.number().optional(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.addUserComissionGroup = (request, response, next) => {
    const rules = Joi.object().keys({
        ibId: Joi.number().min(1).required(),
        planId: Joi.number().min(1).required(),
    });
    const { error } = rules.validate(request.body);

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
