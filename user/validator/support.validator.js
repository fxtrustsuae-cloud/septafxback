const Joi = require("joi");

module.exports.createTicket = async (request, response, next) => {
    const rules = Joi.object().keys({
        subject: Joi.string().required(),
        priority: Joi.string().valid("LOW", "MEDIUM", "HIGH").required(),
        message: Joi.string().required()
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
        priority: Joi.string().valid("LOW", "MEDIUM", "HIGH").optional(),
        status: Joi.string().valid("OPEN", "CLOSED", "PROCESSING").optional()
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

module.exports.closeTicket = (request, response, next) => {
    const rules = Joi.object().keys({
        ticketId: Joi.number().integer().min(1).required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.replay = (request, response, next) => {
    const rules = Joi.object().keys({
        ticketId: Joi.number().integer().min(1).required(),
        message: Joi.string().required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};