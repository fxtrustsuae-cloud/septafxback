const Joi = require("joi");

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
