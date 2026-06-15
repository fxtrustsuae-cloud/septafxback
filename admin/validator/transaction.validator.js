const Joi = require("joi");

// deposit withdraw
module.exports.metaDeposit = (request, response, next) => {
    let rules = Joi.object().keys({
        userId: Joi.number().required(),
        mt5Login: Joi.number().required(),
        type: Joi.number().valid(2, 3, 6).required(),
        referrenceNo: Joi.string().optional(),
        amount: Joi.number().required(),
        comment: Joi.string().optional(),
        expireDays: Joi.number().integer().optional(),
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

// deposit withdraw
module.exports.walletDeposit = (request, response, next) => {
    let rules = Joi.object().keys({
        userId: Joi.number().required(),
        paymentMethods: Joi.string().valid("BANK", "CASH", "CRYPTO").required(),
        referrenceNo: Joi.string().optional(),
        amount: Joi.number().required(),
        comment: Joi.string().optional(),
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

// for crypto
module.exports.approveRejectWithdraw = (request, response, next) => {
    const rules = Joi.object().keys({
        transactionId: Joi.string().required(),
        status: Joi.string().valid("APPROVED", "REJECTED").required(),
        remark: Joi.string().optional(),
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

// module.exports.internalTransfer = (request, response, next) => {
//     let rules = Joi.object().keys({
//         fromUserId: Joi.number().required(),
//         toUserId: Joi.number().required(),
//         amount: Joi.number().min(100).required(),
//     });
//     const { error } = rules.validate(request.body);
//     if (error) {
//         return response
//             .status(422)
//             .json({ status: false, message: error.message, data: null });
//     } else {
//         next();
//     }
// };

module.exports.transactionList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).max(100).required(),
        transactionType: Joi.string().valid(
            "CLIENT-DEPOSIT",
            "CLIENT-WITHDRAW",
            "INTERNAL-DEPOSIT",
            "INTERNAL-WITHDRAW",
            "CREDIT-DEPOSIT",
            "BONUS-DEPOSIT",
            "CREDIT-WITHDRAW",
            "BONUS-WITHDRAW",
            "WALLET-DEPOSIT",
            "WALLET-WITHDRAW",
            "IB-WITHDRAW",
            "INTERNAL-TRANSFER",
            "DEPOSIT",
            "WITHDRAW").optional(),
        status: Joi.string().valid("PENDING", "COMPLETED", "PROCESSING", "REJECTED"),
        fromDate: Joi.date().iso().optional(),
        toDate: Joi.date().iso().optional(),
        paymentMethods: Joi.string().valid("BANK", "CASH", "CRYPTO").optional(),
        search: Joi.string().optional(),
        userId: Joi.number().optional(),
        isDeleted: Joi.boolean().optional(),
        fileExport: Joi.boolean().optional()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.depositWithdrawList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        transactionType: Joi.string().valid("DEPOSIT", "WITHDRAW").optional(),
        status: Joi.string().valid("APPROVED", "PENDING", "COMPLETED", "PROCESSING", "REJECTED"),
        fromDate: Joi.date().iso().optional(),
        toDate: Joi.date().iso().optional(),
        paymentMethods: Joi.string().valid("BANK", "CASH", "CRYPTO").optional(),
        search: Joi.string().optional(),
        userId: Joi.number().optional(),
        fileExport: Joi.boolean().optional()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.removeBonus = (request, response, next) => {
    const rules = Joi.object().keys({
        bonusId: Joi.number().integer().min(1).required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.singleDepositWithdraw = (request, response, next) => {
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

module.exports.apporveRejectDepositWithdraw = (request, response, next) => {
    const rules = Joi.object().keys({
        depositId: Joi.number().integer().min(1).required(),
        status: Joi.string().valid("APPROVED", "REJECTED").required(),
        remark: Joi.string().required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateDepositWithdrawAmount = (request, response, next) => {
    const rules = Joi.object().keys({
        depositId: Joi.number().integer().min(1).required(),
        amount: Joi.number().positive().required(),
        remark: Joi.string().optional()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.ibWithdraw = (request, response, next) => {
    const rules = Joi.object().keys({
        ibId: Joi.number().integer().min(1).required(),
        amount: Joi.number().required()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};
