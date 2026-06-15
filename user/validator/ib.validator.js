const Joi = require("joi");
const { search } = require("../router/user.route");

module.exports.list = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).optional(),
        search: Joi.string().optional(),
        planId: Joi.number().optional()
    });
    const { error } = rules.validate(request.query);
    
    if (error) {
        return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.makeSubIb = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().integer().min(1).required(),
        isSubIb: Joi.boolean().required(),
    });
    const { error } = rules.validate(request.body);
    
    if (error) {
        return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.teamTrxReport = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).optional(),
        transactionType: Joi.string().valid("WALLET-DEPOSIT", "WALLET-WITHDRAW").optional(),
        search: Joi.string().optional(),
        fromDate: Joi.date().optional(),
        toDate: Joi.date().optional(),
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.ibWithdraw = (request, response, next) => {
    const rules = Joi.object().keys({
        amount: Joi.number().min(25).required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.ibKycReport = (request, response, next) => {
    const rules = Joi.object().keys({
        search: Joi.string().optional()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};