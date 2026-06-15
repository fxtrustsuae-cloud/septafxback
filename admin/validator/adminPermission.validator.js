const Joi = require("joi");

module.exports.createAdmin = (request, response, next) => {
    const rules = Joi.object().keys({
        name: Joi.string().min(2).max(100).required(),
        email: Joi.string().email().required(),
        mobile: Joi.string().min(7).max(15).required(),
        userName: Joi.string().alphanum().min(3).max(50).required(),
        password: Joi.string().min(6).required(),
        country: Joi.string().optional(),
        countryCode: Joi.string().optional(),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    next();
};

module.exports.getAdminPermission = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().integer().min(1).required(),
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    next();
};

module.exports.updateAdminPermission = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().integer().min(1).required(),

        // Dashboard
        "DASHBOARD": Joi.boolean().optional(),
        "TRANSACTION-DASHBOARD": Joi.boolean().optional(),
        "USER-DASHBOARD": Joi.boolean().optional(),
        "APP-SETTING": Joi.boolean().optional(),

        // User Management
        "ADD-USER": Joi.boolean().optional(),
        "UPDATE-USER": Joi.boolean().optional(),
        "USER-LIST": Joi.boolean().optional(),
        "USER-BY-ID": Joi.boolean().optional(),
        "ASSET-LIST": Joi.boolean().optional(),
        "MT5-ADD-USER": Joi.boolean().optional(),
        "MT5-USER-LIST": Joi.boolean().optional(),
        "MT5-USER-BY-ID": Joi.boolean().optional(),
        "ADD-BANK": Joi.boolean().optional(),
        "BANK-LIST": Joi.boolean().optional(),
        "BANK-BY-ID": Joi.boolean().optional(),
        "UPDATE-BANK": Joi.boolean().optional(),
        "APPROVE-BANK": Joi.boolean().optional(),
        "UPLOAD-DOCUMENT": Joi.boolean().optional(),
        "DOCUMENT-LIST": Joi.boolean().optional(),
        "APPROVE-KYC": Joi.boolean().optional(),
        "PASSWORD-LIST": Joi.boolean().optional(),
        "CHANGE-PASSWORD": Joi.boolean().optional(),
        "UPDATE-MT5": Joi.boolean().optional(),
        "BANK-DEPOSIT-LIST": Joi.boolean().optional(),
        "ACTION-TRACKING": Joi.boolean().optional(),
        "SEND-EMAIL": Joi.boolean().optional(),
        "REFERRAL-LIST": Joi.boolean().optional(),
        "REFERRAL-TREE": Joi.boolean().optional(),

        // Transaction
        "CLIENT-DEPOSIT": Joi.boolean().optional(),
        "CLIENT-WITHDRAW": Joi.boolean().optional(),
        "WALLET-TO-META-DEPOSIT": Joi.boolean().optional(),
        "META-TO-WALLET-WITHDRAW": Joi.boolean().optional(),
        "WALLET-DEPOSIT": Joi.boolean().optional(),
        "WALLET-WITHDRAW": Joi.boolean().optional(),
        "REMOVE-BONUS": Joi.boolean().optional(),
        "TRANSACTION-LIST": Joi.boolean().optional(),
        "DEPOSIT-WITHDRAW-LIST": Joi.boolean().optional(),
        "DEPOSIT-WITHDRAW-BY-ID": Joi.boolean().optional(),
        "APPROVE-REJECT-DEPOSIT-WITHDRAW": Joi.boolean().optional(),
        "UPDATE-DEPOSIT-WITHDRAW-AMOUNT": Joi.boolean().optional(),
        "IB-WITHDRAW": Joi.boolean().optional(),

        // MT5 Accounts
        "MT5-GET-USER": Joi.boolean().optional(),
        "MT5-ADD": Joi.boolean().optional(),
        "MT5-UPDATE": Joi.boolean().optional(),
        "MT5-DELETE": Joi.boolean().optional(),
        "MT5-CHANGE-PASSWORD": Joi.boolean().optional(),
        "MT5-TRADE-STATUS": Joi.boolean().optional(),
        "MT5-CHECK-BALANCE": Joi.boolean().optional(),
        "MT5-DEPOSIT-BALANCE": Joi.boolean().optional(),
        "MT5-WITHDRAW-BALANCE": Joi.boolean().optional(),
        "MT5-MOVE-USER": Joi.boolean().optional(),
        "MT5-IMPORT-ACCOUNT": Joi.boolean().optional(),
        "MT5-REQUESTED-LIST": Joi.boolean().optional(),
        "MT5-APPROVE-REJECT-REQUESTED": Joi.boolean().optional(),

        // IB Management
        "IB-LIST": Joi.boolean().optional(),
        "IB-UPDATE": Joi.boolean().optional(),
        "IB-ADD-PLAN-NAME": Joi.boolean().optional(),
        "IB-PLAN-NAME-LIST": Joi.boolean().optional(),
        "IB-ADD-PLAN": Joi.boolean().optional(),
        "IB-PLAN-LIST": Joi.boolean().optional(),
        "IB-UPDATE-PLAN": Joi.boolean().optional(),
        "IB-SET-SUB-COMMISSION": Joi.boolean().optional(),
        "IB-UPDATE-SUB-COMMISSION": Joi.boolean().optional(),
        "IB-SUB-COMMISSION-LIST": Joi.boolean().optional(),
        "IB-MOVE-USER": Joi.boolean().optional(),
        "IB-REMOVE-USER": Joi.boolean().optional(),
        "IB-COMMISSION-TRX-LIST": Joi.boolean().optional(),
        "IB-REPORT": Joi.boolean().optional(),

        // Deals
        "DEAL-BY-TICKET": Joi.boolean().optional(),
        "DEAL-LIST": Joi.boolean().optional(),
        "DEAL-PAGE": Joi.boolean().optional(),
        "DEAL-BATCH": Joi.boolean().optional(),
        "DEAL-UPDATE": Joi.boolean().optional(),
        "DEAL-DELETE": Joi.boolean().optional(),

        // Positions
        "POSITION-SYMBOL": Joi.boolean().optional(),
        "POSITION-LIST": Joi.boolean().optional(),
        "OPEN-ORDER-LIST": Joi.boolean().optional(),
        "CLOSE-POSITION": Joi.boolean().optional(),
        "CLOSE-LIMIT-ORDER": Joi.boolean().optional(),
        "CLOSED-ORDER-LIST": Joi.boolean().optional(),

        // Groups
        "MT5-GROUP-LIST": Joi.boolean().optional(),
        "GROUP-CREATE": Joi.boolean().optional(),
        "GROUP-LIST": Joi.boolean().optional(),
        "GROUP-BY-ID": Joi.boolean().optional(),
        "GROUP-UPDATE": Joi.boolean().optional(),

        // Banners
        "BANNER-UPLOAD": Joi.boolean().optional(),
        "BANNER-DELETE": Joi.boolean().optional(),

        // Company Config
        "COMPANY-BANK-ADD": Joi.boolean().optional(),
        "COMPANY-BANK-UPDATE": Joi.boolean().optional(),
        "EXCHANGE-RATE-ADD": Joi.boolean().optional(),
        "EXCHANGE-RATE-UPDATE": Joi.boolean().optional(),

        // Support
        "SUPPORT-LIST": Joi.boolean().optional(),
        "SUPPORT-BY-ID": Joi.boolean().optional(),
        "SUPPORT-CLOSE": Joi.boolean().optional(),
        "SUPPORT-REPLAY": Joi.boolean().optional(),

        // Marketing
        "MARKETING-ADD-MEMBER": Joi.boolean().optional(),
        "MARKETING-MEMBER-LIST": Joi.boolean().optional(),
        "MARKETING-MEMBER-BY-ID": Joi.boolean().optional(),
        "MARKETING-UPDATE-MEMBER": Joi.boolean().optional(),
        "MARKETING-ASSIGN-MANAGER": Joi.boolean().optional(),
        "MARKETING-INCENTIVE-LIST": Joi.boolean().optional(),
        "MARKETING-INCENTIVE-BY-ID": Joi.boolean().optional(),
        "MARKETING-BULK-UPLOAD": Joi.boolean().optional(),
        "MARKETING-ADD-LEAD": Joi.boolean().optional(),
        "MARKETING-LEAD-LIST": Joi.boolean().optional(),
        "MARKETING-LEAD-BY-ID": Joi.boolean().optional(),
        "MARKETING-ASSIGN-TO": Joi.boolean().optional(),
        "MARKETING-UPDATE-LEAD": Joi.boolean().optional(),
        "MARKETING-PERMISSION-LIST": Joi.boolean().optional(),
        "MARKETING-UPDATE-PERMISSION": Joi.boolean().optional(),
        "MARKETING-ASSIGN-USER": Joi.boolean().optional(),
        "MARKETING-ASSIGN-USER-LIST": Joi.boolean().optional(),
        "MARKETING-ASSIGN-IB": Joi.boolean().optional(),

        // Master Trader
        "MASTER-TRADER-CREATE": Joi.boolean().optional(),
        "MASTER-TRADER-LIST": Joi.boolean().optional(),
        "MASTER-TRADER-BY-ID": Joi.boolean().optional(),
        "MASTER-TRADER-TRADE-LIST": Joi.boolean().optional(),
        "MASTER-TRADER-WATCHERS-LIST": Joi.boolean().optional(),
        "MASTER-TRADER-COPIERS-LIST": Joi.boolean().optional(),
        "MASTER-TRADER-WATCHERS-ANALYTICS": Joi.boolean().optional(),
        "MASTER-TRADER-UPDATE": Joi.boolean().optional(),

        // Copy Trade
        "COPY-TRADE-SUBSCRIPTIONS-LIST": Joi.boolean().optional(),
        "COPY-TRADE-SUBSCRIPTION-BY-ID": Joi.boolean().optional(),
        "COPY-TRADE-PAUSE": Joi.boolean().optional(),
        "COPY-TRADE-RESUME": Joi.boolean().optional(),
        "COPY-TRADE-DELETE": Joi.boolean().optional(),
        "COPY-TRADE-STATS": Joi.boolean().optional(),

        // Lots Calculation
        "LOTS-CALCULATION-UPLOAD": Joi.boolean().optional(),
        "LOTS-CALCULATION-EXPORT": Joi.boolean().optional(),

        // Admin Permission
        "ADMIN-PERMISSION-LIST": Joi.boolean().optional(),
        "ADMIN-UPDATE-PERMISSION": Joi.boolean().optional(),
    });

    const { error } = rules.validate(request.body, { allowUnknown: true });
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    next();
};

module.exports.seedPermissions = (request, response, next) => {
    const rules = Joi.object().keys({
        userId: Joi.number().integer().min(1).required(),
    });

    const { error } = rules.validate(request.body, { allowUnknown: true });
    if (error) {
        return response.status(422).json({
            status: false,
            message: error.message,
            data: null,
        });
    }
    next();
};
