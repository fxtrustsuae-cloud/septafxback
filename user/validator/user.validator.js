const Joi = require("joi");
const config = require("../../config/config");

module.exports.transactionList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        transactionType: Joi.string().valid("CLIENT-DEPOSIT", "CLIENT-WITHDRAW", "INTERNAL-DEPOSIT", "INTERNAL-WITHDRAW", "WALLET-DEPOSIT", "WALLET-WITHDRAW", 
            "IB-WITHDRAW", "INTERNAL-TRANSFER", "CREDIT-DEPOSIT", "BONUS-DEPOSIT", "CREDIT-WITHDRAW", "BONUS-WITHDRAW").optional(),
        status: Joi.string().valid("PENDING", "COMPLETED", "PROCESSING", "REJECTED"),
        fromDate: Joi.date().optional(),
        toDate: Joi.date().optional(),
        login: Joi.string().optional(),
        paymentMethods: Joi.string().valid("BANK", "CASH", "CRYPTO").optional(),
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

module.exports.bankDeposit = (request, response, next) => {
    let rules = Joi.object().keys({
        amount: Joi.number().min(10).required(),
        transactionReference: Joi.string().required(),
        remark: Joi.string().required()
    });
    const { error } = rules.validate(request.query);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        next();
    }
};

module.exports.bankWithdraw = (request, response, next) => {
    let rules = Joi.object().keys({
        bankId: Joi.number().integer().required(),
        amount: Joi.number().min(25).required(),
        remark: Joi.string().required(),
        // otpMethod: Joi.string().valid("MOBILE", "EMAIL", "GOOGLE-AUTH").required(),
        code: Joi.number().optional()
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

module.exports.depositWithdrawList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        transactionType: Joi.string().valid("DEPOSIT", "WITHDRAW").optional(),
        status: Joi.string().valid("PENDING", "COMPLETED", "PROCESSING", "REJECTED"),
        fromDate: Joi.date().iso().optional(),
        toDate: Joi.date().iso().optional(),
        paymentMethods: Joi.string().valid("BANK", "CASH", "CRYPTO").optional(),
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

module.exports.metaDeposit = (request, response, next) => {
    let rules = Joi.object().keys({
        mt5Login: Joi.number().required(),
        type: Joi.number().valid(2, 3, 6).required(),
        amount: Joi.number().required(),
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

module.exports.withdrawUsdt = (request, response, next) => {
    const rules = Joi.object().keys({
        amount: Joi.number().required().min(25),
        code: Joi.number().optional(),
        walletAddress: Joi.string().required(),
        network: Joi.string().valid("ETH", "BSC", "TRON").required()
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

module.exports.updateUserProfile = (request, response, next) => {
    const rules = Joi.object().keys({
        name: Joi.string().min(3).max(40).optional(),
        countryCode: Joi.string().optional(),
        mobile: Joi.string().optional(),
        dob: Joi.date().optional(),
        gender: Joi.string().valid("M", "F", "T").optional(),
        address: Joi.string().optional(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.createTransactionPassword = (request, response, next) => {
    const rules = Joi.object().keys({
        securityQuestion: Joi.string().valid(
            "What was the first trip you went on without your family?", 
            "What was the model of your first mobile phone?",
            "What is the name of your favorite teacher?",
            "What was your childhood nickname?",
            "What is your favorite sports team?",
            "What is your favorite book?",
            "What is your favorite movie?",
            "What was the name of your first pet?",
            "What is your favorite hobby?",
            "What is your best friend's first name?",
            "What city were you born in?",
            "What is your favorite food?",
            "What is your favorite color?"
        ).required(),
        answer: Joi.string().min(3).required(),
        password: Joi.string().min(8).max(30)
            .pattern(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/) // At least one digit, one lowercase, and one uppercase letter
            .message('Password must contain at least one digit, one lowercase letter, one uppercase letter, and one special character.')
            .required(),
        cnfPassword: Joi.string().valid(Joi.ref('password')).required(),
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

module.exports.changeTransactionPassword = (request, response, next) => {
    let rules = Joi.object().keys({
        currPassword: Joi.string().min(8).max(30)
            .pattern(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/) // At least one digit, one lowercase, and one uppercase letter
            .message('Password must contain at least one digit, one lowercase letter, one uppercase letter, and one special character.')
            .required(),
        newPassword: Joi.string().min(8).max(30)
            .pattern(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/) // At least one digit, one lowercase, and one uppercase letter
            .message('New Password must contain at least one digit, one lowercase letter, one uppercase letter, and one special character.')
            .required(),
        cnfPassword: Joi.string().min(8).max(30)
            .pattern(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/) // At least one digit, one lowercase, and one uppercase letter
            .message('Confirm Password must contain at least one digit, one lowercase letter, one uppercase letter, and one special character.')
            .required(),
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

module.exports.addBankDetails = (request, response, next) => {
    let rules = Joi.object().keys({
        holderName: Joi.string().min(3).max(30).required(),
        bankName: Joi.string().required(),
        accountNo: Joi.string().min(10).max(20).required(),
        ifscCode: Joi.string().min(11).max(11).required(),
        branchName: Joi.string().min(3).max(30).required(),
        // address: Joi.string().min(3).max(100).required(),
        accountType: Joi.string().valid("SAVING", "CURRENT", "BUSINESS").required(),
        panNumber: Joi.string().required()
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

module.exports.updateSecuriyMethod = (request, response, next) => {
    let rules = Joi.object().keys({
        securityMentod: Joi.string().valid("EMAIL", "MOBILE", "GOOGLE-AUTH").required(),
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

module.exports.requestIb = (request, response, next) => {
    const rules = Joi.object({
        userId: Joi.number().integer().optional(),
        name: Joi.string().trim().min(2).max(100).optional(),
        email: Joi.string().email().optional(),
        mobile: Joi.string().pattern(/^[0-9+\-()\s]{6,20}$/).optional().messages({"string.pattern.base": "Mobile number must be a valid format."}),
        country: Joi.string().trim().optional(),
        tradingExperienceLevel: Joi.string().valid("BEGINER", "INTERMEDIATE", "ADVANCED", "EXPRET").optional(),
        expectedClintsPerMonths: Joi.string().valid("1-5 CLIENTS", "6-10 CLIENTS", "11-20 CLIENTS", "21-50 CLIENTS", "50+ CLIENTS").optional(),
        networkSize: Joi.string().valid("SMALL", "MEDIUM", "LARGE", "MASSIVE").optional(),
        monthlyIncomeGoal: Joi.string().valid("1000-5000", "5000-10000", "10000-25000", "25000-50000", "50000+").optional(),
        instagram: Joi.string().uri().optional(),
        facebook: Joi.string().uri().optional(),
        linkedin: Joi.string().uri().optional(),
        tweeterX: Joi.string().uri().optional(),
        youtube: Joi.string().uri().optional(),
        tiktok: Joi.string().uri().optional(),
        whyWantToBecomeIb: Joi.string().max(1000).optional(),
        howYouAcquireClients: Joi.string().max(1000).optional(),
        whatsYourDreamLuxuryReward: Joi.string().max(255).optional(),
        status: Joi.string().valid("PENDING", "APPROVED", "PROCESSING", "REJECTED").optional(),
        remark: Joi.string().max(255).optional(),
        isDeleted: Joi.boolean().optional(),
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
