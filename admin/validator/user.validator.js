const Joi = require("joi");

// Admin Add New user
module.exports.addUser = async (request, response, next) => {
    const rules = Joi.object().keys({
        name: Joi.string().min(3).max(40).optional(),
        email: Joi.string().email().optional(),
        mobile: Joi.string().optional(),
        country: Joi.string().optional(),
        countryCode: Joi.string().optional(),
        password: Joi.string().min(6).max(20).required(),
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

module.exports.updateUser = async (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().min(1).required(),
        name: Joi.string().min(3).max(40).optional(),
        email: Joi.string().email().optional(),
        mobile: Joi.string().optional(),
        country: Joi.string().optional(),
        countryCode: Joi.string().optional(),
        password: Joi.string().min(6).max(20).optional(),
        isIb: Joi.boolean().optional(),
        isSubIb: Joi.boolean().optional(),
        dob: Joi.date().optional(),
        gender: Joi.string().valid("M", "F", "T").optional(),
        address: Joi.string().optional(),
        isDeleted: Joi.boolean().optional(),
        isMt5WithdrawlAllowed: Joi.boolean().optional(),
        isMt5DepositAllowed: Joi.boolean().optional(),
        isIbWithdrawlAllowed: Joi.boolean().optional(),
        isTransferAllowed: Joi.boolean().optional(),
        isWithdrawlAllowed: Joi.boolean().optional(),
        isDepositeAllowed: Joi.boolean().optional(),
        isMobileVerified: Joi.boolean().optional(),
        isEmailVerified: Joi.boolean().optional(),
        isKycVerified: Joi.boolean().optional(),
        isBankVerified: Joi.boolean().optional(),
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
        sizePerPage: Joi.number().integer().min(1).max(100000).optional(),
        marketingId: Joi.number().integer().min(1).optional(),
        search: Joi.string().optional(),
        searchWithLogin: Joi.string().optional(),
        isIb: Joi.boolean().optional(),
        isSubIb: Joi.boolean().optional(),
        isKycVerified: Joi.boolean().optional(),
        userId: Joi.number().optional(),
        fromDate: Joi.date().iso().optional(),
        toDate: Joi.date().iso().optional(),
        type: Joi.string().valid("REAL", "DEMO").optional(),
        country: Joi.string().optional(),
        status: Joi.string().valid("PENDING", "APPROVED", "REJECTED").optional(),
        fileExport: Joi.boolean().optional(),
        exportType: Joi.string().valid("IB_USER").optional()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.referralList = (request, response, next) => {
    const rules = Joi.object().keys({
        ibId: Joi.number().integer().min(1).required()
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
        id: Joi.number().min(1).required()
    });
    const { error } = rules.validate(request.params);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.addMT5User = (request, response, next) => {
    const rules = Joi.object().keys({
      userId: Joi.number().required(),
      groupId: Joi.number().min(1).required(),
      Leverage: Joi.number().integer().min(1).required(),
      PassMain: Joi.string().required(),
    });
  
    const { error } = rules.validate(request.body);
    if (error) {
      return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.addBank = (request, response, next) => {
    const rules = Joi.object().keys({
      userId: Joi.number().required(),
      holderName: Joi.string().required(),
      accountNo: Joi.string().required(),
      ifscCode: Joi.string().optional(),
      ibanNo: Joi.string().optional(),
      bankName: Joi.string().required(),
      bankAddress: Joi.string().optional(),
      country: Joi.string().optional(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
      return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.approveBank = (request, response, next) => {
    const rules = Joi.object().keys({
        bankId: Joi.number().required(),
        status: Joi.string().valid("APPROVED", "REJECTED").required(),
        remark: Joi.string().optional()
    });

    const { error } = rules.validate(request.body);
    if (error) {
      return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.updateBank = (request, response, next) => {
    const rules = Joi.object().keys({
        bankId: Joi.number().required(),
        isDeleted: Joi.boolean().optional(),
        holderName: Joi.string().optional(),
        accountNo: Joi.string().optional(),
        ifscCode: Joi.string().optional(),
        ibanNo: Joi.string().optional(),
        bankName: Joi.string().optional(),
        bankAddress: Joi.string().optional(),
        country: Joi.string().optional(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
      return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.uploadDocument = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().required(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
      return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.approveKyc = (request, response, next) => {
    const rules = Joi.object().keys({
        documentId: Joi.number().required(),
        status: Joi.string().valid("APPROVED", "REJECTED").required(),
        poi: Joi.number().valid(0, 1).optional(),
        poa: Joi.number().valid(0, 1).optional(),
        remark: Joi.string().optional()
    });

    const { error } = rules.validate(request.body);
    if (error) {
      return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.changePassword = async (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().min(1).required(),
        newPassword: Joi.string().min(6).max(20).required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateMt5 = async (request, response, next) => {
    const rules = Joi.object().keys({
        mt5Login: Joi.number().min(1).required(),
        PassMain: Joi.string().optional(),
        PassInvestor: Joi.string().optional(),
        Leverage: Joi.number().valid(10, 50, 100, 200, 300, 400, 500, 1000).optional(),
        groupId: Joi.number().optional()
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.updateUserProfile = async (request, response, next) => {
    const rules = Joi.object().keys({
        name: Joi.string().min(3).max(40).optional(),
        country: Joi.string().optional(),
        countryCode: Joi.string().optional(),
        email: Joi.string().email().optional(),
        mobile: Joi.string().min(10).max(15).optional(),
        tradingMt5AcNo: Joi.string().optional(),
        compoundingMT5AcNo: Joi.string().optional(),
        walletAddress: Joi.string().optional()
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
        ifscCode: Joi.string().min(11).max(11).optional(),
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

module.exports.transactionList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).optional(),
        sizePerPage: Joi.number().integer().min(1).optional(),
        status: Joi.string().valid("PENDING", "COMPLETED", "PROCESSING", "REJECTED").optional(),
        transactionType: Joi.string().valid(
            "REFERRAL-INCOME", 
            "GENERATION-INCOME", 
            "RANK-REWARD",
            "MATCHING-BONUS",
            "CLUB-INCOME",
            "TRADING-PROFIT-INCOME",
            "IB-INCOME",
            "CREATE-ROBOT"
        ).optional(),
        userId: Joi.number().optional()
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
        amount: Joi.number().min(100).required(),
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

module.exports.bankDepositList = (request, response, next) => {
    const rules = Joi.object().keys({
        page: Joi.number().integer().min(1).required(),
        sizePerPage: Joi.number().integer().min(1).required(),
        userId: Joi.number().optional()
    });
    const { error } = rules.validate(request.query);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};
