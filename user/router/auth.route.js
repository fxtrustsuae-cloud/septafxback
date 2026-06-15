const express = require("express");
const router = express.Router();

const authController = require("../controller/auth.controller");
const authValidator = require("../validator/auth.validator");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.post("/signup", authValidator.signUp, authController.signUp);
router.get("/referral/info", authValidator.referralInfo, authController.referralInfo);
router.post("/login", authValidator.login, authController.login);
router.get("/login/history", authValidator.loginHistory, verifyJWTToken, authController.loginHistory);
router.post("/logout", verifyJWTToken, authController.logOut);
router.post("/send/otp", authValidator.sendOtp, authController.sendOtp);
router.patch("/verify/otp", authValidator.verifyOtp, authController.verifyOtp);
router.put("/change/login/password", authValidator.changePassword, verifyJWTToken, authController.changePassword);
router.post("/forgot/password/send/otp", authValidator.sendOtp, authController.forgetPasswordSendOtp);
router.patch("/forgot/password/verify/otp", authValidator.verifyOtp, authController.forgetPasswordVerifyOtp);
router.put("/reset/password", authValidator.resetPassword, verifyJWTToken, authController.resetPassword);

router.post("/setup/mfa", verifyJWTToken, authController.setup2fa);


module.exports = router;