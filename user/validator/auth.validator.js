const Joi = require("joi");

module.exports.referralInfo = async (request, response, next) => {
    const rules = Joi.object().keys({
        referralCode: Joi.string().required(),
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.signUp = async (request, response, next) => {
    const rules = Joi.object({
        country: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).max(20).required(),
        referralCode: Joi.string().optional(),
        isMarketing: Joi.boolean().optional(),
    });
    
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};

module.exports.login = async (request, response, next) => {
    const rules = Joi.object().keys({
        userName: Joi.string().required(),
        password: Joi.string().required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.loginHistory = async (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.sendOtp = async (request, response, next) => {
    const rules = Joi.object().keys({
        email: Joi.string().email(),
        mobile: Joi.string(),
    }).or('email', 'mobile');
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};

module.exports.verifyOtp = async (request, response, next) => {
    const rules = Joi.object().keys({
        email: Joi.string().email(),
        mobile: Joi.string(),
        otp: Joi.number().required(),
    }).or('email', 'mobile');
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};

module.exports.changePassword = async (request, response, next) => {
    const rules = Joi.object().keys({
        oldPassword: Joi.string().min(8).max(20).required(),
        newPassword: Joi.string().min(8).max(20).required(),
        cnfPassword: Joi.string().min(8).max(20).required(),
    });
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};

module.exports.resetPassword = async (request, response, next) => {
    const rules = Joi.object().keys({
        newPassword: Joi.string().required(),
        cnfPassword: Joi.string().required(),
    });
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};