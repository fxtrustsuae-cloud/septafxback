const Joi = require("joi");

module.exports.createGroup = (request, response, next) => {
    let rules = Joi.object().keys({
        name: Joi.string().required(),
        mt5GroupId: Joi.number().min(1).required(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").required(),
        groupType: Joi.string().valid("DEMO", "REAL").required(),
        recomendation: Joi.string().required(),
        message: Joi.string().required(),
        minDeposit: Joi.string().required(),
        spread: Joi.string().required(),
        commission: Joi.string().required(),
        leverage: Joi.number().required(),        
    });
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        next();
    }
};

module.exports.list = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        search: Joi.string().optional(),
        type: Joi.string().valid("REAL", "DEMO").optional()
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
        id: Joi.number().integer().min(1).required()
    });
    const { error } = rules.validate(request.params);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateGroup = (request, response, next) => {
    const rules = Joi.object().keys({
        groupId: Joi.number().required(),
        name: Joi.string().optional(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
        recomendation: Joi.string().optional(),
        message: Joi.string().optional(),
        minDeposit: Joi.string().optional(),
        spread: Joi.string().optional(),
        commission: Joi.string().optional(),
        mt5GroupId: Joi.number().min(1).optional(),
        groupType: Joi.string().valid("DEMO", "REAL").optional(),
        leverage: Joi.number().optional(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};
