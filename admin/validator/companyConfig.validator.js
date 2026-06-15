const Joi = require("joi");

module.exports.addCompanyBank = (request, response, next) => {
    const rules = Joi.object().keys({
        accountHolderName: Joi.string().required(),
        bankName: Joi.string().required(),
        accountNo: Joi.string().required(),
        ifscCode: Joi.string().optional(),
        ibanNo: Joi.string().optional(),
        swiftCode: Joi.string().optional(),
        branchName: Joi.string().optional(),
        bankAddress: Joi.string().optional(),
        country: Joi.string().optional(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateCompanyBank = (request, response, next) => {
    const rules = Joi.object().keys({
        companyBankId: Joi.number().integer().min(1).required(),
        isDeleted: Joi.boolean().optional(),
        accountHolderName: Joi.string().optional(),
        bankName: Joi.string().optional(),
        accountNo: Joi.string().optional(),
        ifscCode: Joi.string().optional(),
        ibanNo: Joi.string().optional(),
        swiftCode: Joi.string().optional(),
        branchName: Joi.string().optional(),
        bankAddress: Joi.string().optional(),
        country: Joi.string().optional(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.listCompanyBanks = (request, response, next) => {
    const rules = Joi.object().keys({
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
        country: Joi.string().optional(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response.status(422).json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.addCurrencyExchangeRate = (request, response, next) => {
    const rules = Joi.object().keys({
        baseCurrency: Joi.string().valid("USD").optional(),
        currencyCode: Joi.string().trim().uppercase().min(2).max(10).required(),
        exchangeRate: Joi.number().positive().required(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateCurrencyExchangeRate = (request, response, next) => {
    const rules = Joi.object().keys({
        exchangeRateId: Joi.number().integer().min(1).required(),
        isDeleted: Joi.boolean().optional(),
        currencyCode: Joi.string().trim().uppercase().min(2).max(10).optional(),
        exchangeRate: Joi.number().positive().optional(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.listCurrencyExchangeRates = (request, response, next) => {
    const rules = Joi.object().keys({
        baseCurrency: Joi.string().trim().uppercase().optional(),
        currencyCode: Joi.string().trim().uppercase().optional(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response.status(422).json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.upsertPaymentCharge = (request, response, next) => {
    const rules = Joi.object().keys({
        applicableFor: Joi.string().valid("DEPOSIT", "WITHDRAWAL").required(),
        chargeType: Joi.string().valid("PERCENTAGE", "FIXED").required(),
        chargeValue: Joi.number().min(0).required(),
        status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({ status: false, message: error.message, data: null });
    }
    return next();
};
