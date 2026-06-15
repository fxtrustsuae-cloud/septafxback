const express = require("express");
const router = express.Router();

const authController = require("../controller/auth.controller");
const authValidator = require("../validator/auth.validator");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");

router.post("/login", authValidator.login,  authController.marketingLogin);

module.exports = router;