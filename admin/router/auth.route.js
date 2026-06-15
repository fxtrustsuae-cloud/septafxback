const express = require("express");
const router = express.Router();

const authController = require("../controller/auth.controller");
const authValidator = require("../validator/auth.validator");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.post("/login", authValidator.login,  authController.login);
router.post("/marketing/login", authValidator.login,  authController.marketingLogin);
router.get("/login/history", authValidator.loginHistory, verifyJWTToken, authController.loginHistory);

module.exports = router;