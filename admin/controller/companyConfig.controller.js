const { Op } = require("sequelize");
const CompanyBankDetailModel = require("../../models/companyBankDetail.model");
const CurrencyExchangeRateModel = require("../../models/currencyExchangeRate.model");
const PaymentChargeModel = require("../../models/paymentCharge.model");
const AppSettingModel = require("../../models/appSetting.model");
const UserModel = require("../../models/users.model");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.addCompanyBank = async (request, response) => {
    try {
        adminLogger.info('Entering addCompanyBank', { method: request.method || "", route: request.originalUrl || "" });
        const { user, accountHolderName, bankName, accountNo, ifscCode, ibanNo, swiftCode, branchName, bankAddress, country, status } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const existingBank = await CompanyBankDetailModel.findOne({
            where: { accountNo, isDeleted: false },
        });
        if (existingBank) throw CustomErrorHandler.alreadyExist("Account no Already exists!");

        const newCompanyBank = await CompanyBankDetailModel.create({
            accountHolderName,
            bankName,
            accountNo,
            ifscCode,
            ibanNo,
            swiftCode,
            branchName,
            bankAddress,
            country,
            status: status || "ACTIVE",
            createdBy: adminData.id,
            updatedBy: adminData.id,
        });

        adminLogger.info('Exiting addCompanyBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Company bank added.",
            data: newCompanyBank,
        });
    } catch (e) {
        adminLogger.error('Error in addCompanyBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateCompanyBank = async (request, response) => {
    try {
        adminLogger.info('Entering updateCompanyBank', { method: request.method || "", route: request.originalUrl || "" });
        const { user, companyBankId, isDeleted, accountHolderName, bankName, accountNo, ifscCode, ibanNo, swiftCode, branchName, bankAddress, country, status } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const companyBank = await CompanyBankDetailModel.findOne({
            where: { id: companyBankId, isDeleted: false },
        });
        if (!companyBank) throw CustomErrorHandler.notFound("Company bank details not found!");

        const shouldDelete = isDeleted === true || isDeleted === "true" || isDeleted === 1 || isDeleted === "1";

        if (shouldDelete) {
            await companyBank.update({
                isDeleted: true,
                updatedBy: adminData.id,
                deletedAt: new Date(),
            });

            adminLogger.info('Exiting updateCompanyBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
                status: true,
                message: "Company bank deleted.",
                data: null,
            });
        }

        if (accountNo && accountNo !== companyBank.accountNo) {
            const duplicateBank = await CompanyBankDetailModel.findOne({
                where: {
                    accountNo,
                    isDeleted: false,
                    id: { [Op.ne]: companyBank.id },
                },
            });
            if (duplicateBank) throw CustomErrorHandler.alreadyExist("Account no Already exists!");
        }

        const updateData = {};
        if (accountHolderName) updateData.accountHolderName = accountHolderName;
        if (bankName) updateData.bankName = bankName;
        if (accountNo) updateData.accountNo = accountNo;
        if (ifscCode) updateData.ifscCode = ifscCode;
        if (ibanNo) updateData.ibanNo = ibanNo;
        if (swiftCode) updateData.swiftCode = swiftCode;
        if (branchName) updateData.branchName = branchName;
        if (bankAddress) updateData.bankAddress = bankAddress;
        if (country) updateData.country = country;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length === 0) {
            throw CustomErrorHandler.badRequest("No data provided for update!");
        }

        updateData.updatedBy = adminData.id;

        const updatedCompanyBank = await companyBank.update(updateData);

        adminLogger.info('Exiting updateCompanyBank: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Company bank updated.",
            data: updatedCompanyBank,
        });
    } catch (e) {
        adminLogger.error('Error in updateCompanyBank', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.publicCompanyBankList = async (request, response) => {
    try {
        adminLogger.info('Entering publicCompanyBankList', { method: request.method || "", route: request.originalUrl || "" });
        const { status, country } = request.query;

        const whereCondition = { isDeleted: false };
        if (status) whereCondition.status = status;
        if (country) whereCondition.country = country;

        const companyBanks = await CompanyBankDetailModel.findAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
        });

        adminLogger.info('Exiting publicCompanyBankList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Company bank list.",
            data: companyBanks,
        });
    } catch (e) {
        adminLogger.error('Error in publicCompanyBankList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.addCurrencyExchangeRate = async (request, response) => {
    try {
        adminLogger.info('Entering addCurrencyExchangeRate', { method: request.method || "", route: request.originalUrl || "" });
        const { user, baseCurrency, currencyCode, exchangeRate, status } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const normalizedBaseCurrency = (baseCurrency || "USD").toUpperCase();
        const normalizedCurrencyCode = currencyCode.toUpperCase();

        const existingRate = await CurrencyExchangeRateModel.findOne({
            where: {
                baseCurrency: normalizedBaseCurrency,
                currencyCode: normalizedCurrencyCode,
                isDeleted: false,
            },
        });
        if (existingRate) {
            throw CustomErrorHandler.alreadyExist("Exchange rate already exists for this currency!");
        }

        const newRate = await CurrencyExchangeRateModel.create({
            baseCurrency: normalizedBaseCurrency,
            currencyCode: normalizedCurrencyCode,
            exchangeRate,
            status: status || "ACTIVE",
            createdBy: adminData.id,
            updatedBy: adminData.id,
        });

        adminLogger.info('Exiting addCurrencyExchangeRate: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Currency exchange rate added.",
            data: newRate,
        });
    } catch (e) {
        adminLogger.error('Error in addCurrencyExchangeRate', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.updateCurrencyExchangeRate = async (request, response) => {
    try {
        adminLogger.info('Entering updateCurrencyExchangeRate', { method: request.method || "", route: request.originalUrl || "" });
        const { user, exchangeRateId, isDeleted, currencyCode, exchangeRate, status } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        const existingRate = await CurrencyExchangeRateModel.findOne({
            where: { id: exchangeRateId, isDeleted: false },
        });
        if (!existingRate) throw CustomErrorHandler.notFound("Currency exchange rate not found!");

        const shouldDelete = isDeleted === true || isDeleted === "true" || isDeleted === 1 || isDeleted === "1";

        if (shouldDelete) {
            await existingRate.update({
                isDeleted: true,
                updatedBy: adminData.id,
                deletedAt: new Date(),
            });

            adminLogger.info('Exiting updateCurrencyExchangeRate: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
                status: true,
                message: "Currency exchange rate deleted.",
                data: null,
            });
        }

        const updateData = {};
        if (currencyCode) {
            const normalizedCurrencyCode = currencyCode.toUpperCase();

            if (normalizedCurrencyCode !== existingRate.currencyCode) {
                const duplicateRate = await CurrencyExchangeRateModel.findOne({
                    where: {
                        baseCurrency: existingRate.baseCurrency,
                        currencyCode: normalizedCurrencyCode,
                        id: { [Op.ne]: existingRate.id },
                        isDeleted: false,
                    },
                });
                if (duplicateRate) {
                    throw CustomErrorHandler.alreadyExist("Exchange rate already exists for this currency!");
                }
            }

            updateData.currencyCode = normalizedCurrencyCode;
        }
        if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length === 0) {
            throw CustomErrorHandler.badRequest("No data provided for update!");
        }

        updateData.updatedBy = adminData.id;

        const updatedRate = await existingRate.update(updateData);

        adminLogger.info('Exiting updateCurrencyExchangeRate: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Currency exchange rate updated.",
            data: updatedRate,
        });
    } catch (e) {
        adminLogger.error('Error in updateCurrencyExchangeRate', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.publicCurrencyExchangeRateList = async (request, response) => {
    try {
        adminLogger.info('Entering publicCurrencyExchangeRateList', { method: request.method || "", route: request.originalUrl || "" });
        const { baseCurrency, currencyCode, status } = request.query;

        const whereCondition = { isDeleted: false };
        if (baseCurrency) whereCondition.baseCurrency = baseCurrency.toUpperCase();
        if (currencyCode) whereCondition.currencyCode = currencyCode.toUpperCase();
        if (status) whereCondition.status = status;

        const rates = await CurrencyExchangeRateModel.findAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
        });

        adminLogger.info('Exiting publicCurrencyExchangeRateList: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Currency exchange rate list.",
            data: rates,
        });
    } catch (e) {
        adminLogger.error('Error in publicCurrencyExchangeRateList', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.upsertPaymentCharge = async (request, response) => {
    try {
        adminLogger.info('Entering upsertPaymentCharge', { method: request.method || "", route: request.originalUrl || "" });
        const { user, applicableFor, chargeType, chargeValue, status } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: { [Op.in]: ["ADMIN", "SUPER-ADMIN"] }, isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        let charge = await PaymentChargeModel.findOne({ where: { applicableFor, isDeleted: false } });

        if (charge) {
            await charge.update({
                chargeType,
                chargeValue: Number(chargeValue),
                status: status || charge.status,
                updatedBy: adminData.id,
            });
        } else {
            charge = await PaymentChargeModel.create({
                applicableFor,
                chargeType,
                chargeValue: Number(chargeValue),
                status: status || "ACTIVE",
                createdBy: adminData.id,
                updatedBy: adminData.id,
            });
        }

        adminLogger.info('Exiting upsertPaymentCharge: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({ status: true, message: "Payment charge updated.", data: charge });
    } catch (e) {
        adminLogger.error('Error in upsertPaymentCharge', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getPaymentCharges = async (request, response) => {
    try {
        adminLogger.info('Entering getPaymentCharges', { method: request.method || "", route: request.originalUrl || "" });

        const [deposit, withdrawal] = await Promise.all([
            PaymentChargeModel.findOne({ where: { applicableFor: "DEPOSIT", isDeleted: false } }),
            PaymentChargeModel.findOne({ where: { applicableFor: "WITHDRAWAL", isDeleted: false } }),
        ]);

        adminLogger.info('Exiting getPaymentCharges: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Payment charges fetched.",
            data: { deposit: deposit || null, withdrawal: withdrawal || null },
        });
    } catch (e) {
        adminLogger.error('Error in getPaymentCharges', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

module.exports.getFeatureFlags = async (request, response) => {
    try {
        const setting = await AppSettingModel.findOne({ order: [['createdAt', 'ASC']] });
        return response.json({
            status: true,
            message: "Feature flags.",
            data: {
                isPaymentChargesEnabled: setting ? setting.isPaymentChargesEnabled : true,
            },
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

module.exports.updateFeatureFlags = async (request, response) => {
    try {
        const { user, isPaymentChargesEnabled } = request.body;

        const adminData = await UserModel.findOne({
            where: { id: user.id, role: "SUPER-ADMIN", isDeleted: false },
        });
        if (!adminData) throw CustomErrorHandler.notAllowed("Access Denied!");

        let setting = await AppSettingModel.findOne({ order: [['createdAt', 'ASC']] });
        if (!setting) {
            setting = await AppSettingModel.create({
                admin: adminData.id,
                isPaymentChargesEnabled: isPaymentChargesEnabled ?? true,
                isMentnance: false,
                isForceUpdate: false,
                iosVersion: '1.0.0',
                androidVersion: '1.0.0',
            });
        } else {
            if (isPaymentChargesEnabled !== undefined) setting.isPaymentChargesEnabled = isPaymentChargesEnabled;
            await setting.save();
        }

        return response.json({
            status: true,
            message: "Feature flags updated.",
            data: { isPaymentChargesEnabled: setting.isPaymentChargesEnabled },
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};
