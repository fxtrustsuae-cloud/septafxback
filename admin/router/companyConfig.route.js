const express = require("express");
const router = express.Router();

const companyBankValidator = require("../validator/companyConfig.validator");
const companyBankController = require("../controller/companyConfig.controller");
const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const checkAdminPermission = require("../../middleware/adminPermission.middleware");

router.post("/add", companyBankValidator.addCompanyBank, verifyJWTToken, checkAdminPermission("COMPANY-BANK-ADD"), companyBankController.addCompanyBank);
router.put("/update", companyBankValidator.updateCompanyBank, verifyJWTToken, checkAdminPermission("COMPANY-BANK-UPDATE"), companyBankController.updateCompanyBank);
router.get("/list", companyBankValidator.listCompanyBanks, companyBankController.publicCompanyBankList);

router.post("/exchange-rate/add", companyBankValidator.addCurrencyExchangeRate, verifyJWTToken, checkAdminPermission("EXCHANGE-RATE-ADD"), companyBankController.addCurrencyExchangeRate);
router.put("/exchange-rate/update", companyBankValidator.updateCurrencyExchangeRate, verifyJWTToken, checkAdminPermission("EXCHANGE-RATE-UPDATE"), companyBankController.updateCurrencyExchangeRate);
router.get("/exchange-rate/list", companyBankValidator.listCurrencyExchangeRates, companyBankController.publicCurrencyExchangeRateList);

router.put("/payment-charge/upsert", companyBankValidator.upsertPaymentCharge, verifyJWTToken, checkAdminPermission("PAYMENT-CHARGE-MANAGE"), companyBankController.upsertPaymentCharge);
router.get("/payment-charge/list", companyBankController.getPaymentCharges);

router.get("/feature-flags", companyBankController.getFeatureFlags);
router.patch("/feature-flags", verifyJWTToken, companyBankController.updateFeatureFlags);

module.exports = router;
