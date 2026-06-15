const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const config = {
    PORT: process.env.PORT,
    JWT_AUTH_TOKEN: process.env.JWT_SECRET_KEY,
    JWT_TOKEN_EXPIRES: process.env.JWT_TOKEN_EXPIRES,
    PASSWORD_ENCRYPTION_KEY: process.env.PASSWORD_ENCRYPTION_KEY,
    SALT_ROUND: Number(process.env.SALT_ROUNDS),

    STAKING_CRON_TIME: process.env.STAKING_CRON_TIME,
    RANK_REWARD_TIME: process.env.RAND_REWARD_TIME,
    
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SERVICE_ID: process.env.TWILIO_SERVICE_ID,

    USER_NAME: process.env.USER_NAME,

    MT5_LOGIN: process.env.LOGIN,
    MT5_PASSWORD: process.env.PASSWORD,
    MT5_URL: process.env.MT5_URL,
    MT5_PORT: process.env.MT5_PORT,
    DEMO_SERIES: process.env.DEMO_SERIES,
    REAL_SERIES: process.env.REAL_SERIES,
    MT5_PROXY: process.env.MT5_PROXY,
    GLOBAL_PLAN_TYPE: process.env.GLOBAL_PLAN_TYPE,      // if true don't include group, if false include group and sumbol with suffix

    // Email SMTP
    HOST: process.env.HOST,
    HOSTMAIL: process.env.HOSTMAIL,
    SUPPORTMAIL: process.env.SUPPORTMAIL,
    COPYRIGHT_NAME: process.env.COPYRIGHT_NAME,
    MAIL_PASSWORD: process.env.MAIL_PASSWORD,
    SMTP_MAX_CONNECTIONS: process.env.SMTP_MAX_CONNECTIONS,
    SMTP_MAX_MESSAGES: process.env.SMTP_MAX_MESSAGES,
    SMTP_RATE_DELTA_MS: process.env.SMTP_RATE_DELTA_MS,
    SMTP_RATE_LIMIT: process.env.SMTP_RATE_LIMIT,
    SMTP_RETRY_ATTEMPTS: process.env.SMTP_RETRY_ATTEMPTS,
    SMTP_RETRY_BASE_DELAY_MS: process.env.SMTP_RETRY_BASE_DELAY_MS,
    SMTP_RETRY_MAX_DELAY_MS: process.env.SMTP_RETRY_MAX_DELAY_MS,
    EMAIL_BATCH_SIZE: process.env.EMAIL_BATCH_SIZE,
    EMAIL_BATCH_DELAY_MS: process.env.EMAIL_BATCH_DELAY_MS,

    BCC_MAIL: process.env.BCC_MAIL,
    ALERT_MAIL: process.env.ALERT_MAIL,
    COMPANY_NAME: process.env.COMPANY_NAME,
    COMPANY_LOGO: process.env.COMPANY_LOGO,
    FRONTEND_URL: process.env.FRONTEND_URL,
    SERVER: process.env.SERVER,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    DASHBOARD_LINK: process.env.DASHBOARD_LINK,
    COMPANY_ADDRESS: process.env.COMPANY_ADDRESS,

    PROJECT_ID: process.env.PROJECT_ID,
    API_KEY: process.env.API_KEY,
    BASE_URL: process.env.BASE_URL,
    CALL_BACK: process.env.CALL_BACK,

    PAYONCOINS_PUBLIC_KEY: process.env.PAYONCOINS_PUBLIC_KEY,
    PAYONCOINS_PRIVATE_KEY: process.env.PAYONCOINS_PRIVATE_KEY,
    PAYONCOINS_BASE_URL: process.env.PAYONCOINS_BASE_URL,

    YOPIPS_TOKEN: process.env.YOPIPS_TOKEN,

    MIN_WITHDRAW: process.env.MIN_WITHDRAW,
    MAX_WITHDRAW: process.env.MAX_WITHDRAW,
    KYC_DOCUMENT_MAX_UPLOAD_MB: process.env.KYC_DOCUMENT_MAX_UPLOAD_MB,
    REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT,
    MIN_DEPOSIT: process.env.MIN_DEPOSIT,
    
    RPC_URL: process.env.RPC_URL,
    USDT_CONTRACT_ADDRESS: process.env.USDT_CONTRACT_ADDRESS,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    SENDER_ADDRESS: process.env.SENDER_ADDRESS,

    T4B_BASE_URL: process.env.T4B_BASE_URL,
    T4B_FEED_USERNAME: process.env.T4B_FEED_USERNAME,
    T4B_FEED_PASSWORD: process.env.T4B_FEED_PASSWORD,

    T4B_TRADE_USERNAME: process.env.T4B_TRADE_USERNAME,
    T4B_TRADE_PASSWORD: process.env.T4B_TRADE_PASSWORD,

    QUOTE_TIME: process.env.QUOTE_TIME,
};

module.exports = config;
