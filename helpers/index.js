const config = require("../config/config");
const UserModel = require("../models/users.model");
const TrackingModel = require("../models/tracking.model");
const PermissionModel = require("../models/permission.model");
const AdminPermissionModel = require("../models/adminPermission.model");
const MarketingModel = require("../models/marketingUser.model");
const ErrorTrackingModel = require("../models/errorTracking.model");
const geoip = require("geoip-lite");
const useragent = require("useragent");
const crypto = require("crypto");

async function createUserName(){
    const prefix = config.USER_NAME;
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit random number
    const newUserName = `${prefix}${randomNumber}`;
    
    const isExists = await UserModel.findOne({
        where: { userName: newUserName }
    });
    if(isExists) {
        await createUserName();
    };
    return newUserName;
}

async function createMarketingUserName(){
    const prefix = config.USER_NAME;
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit random number
    const newUserName = `${prefix}${randomNumber}`;

    const isExists = await MarketingModel.findOne({
        where: { userName: newUserName }
    });
    if(isExists) {
        await createUserName();
    };
    return newUserName;
}

function generateNumericString(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength),
        );
    }
    return result;
}

async function seedPermissions(role, userId) {
    const permissions = [
       
        // marketing
        "ADD-MARKETING",
        "MARKETING-LIST",
        "MARKETING-BY-ID",
        "UPDATE-MARKETING",
        "ADD-LEAD",
        "UPLOAD-LEADS",
        "LEAD-LIST",
        "LEAD-BY-ID",
        "UPDATE-LEAD",
        "ASSING-LEAD",
        "PERMISSION-LIST",
        "UPDATE-PERMISSION",

        // USER
        "ADD-USER",
        "USER-LIST",
        "KYC",
        "PASSWORD-LIST",

        // Meta
        "ADD-MT5-ACCOUNT",
        "LIST-MT5-ACCOUNT",
        // "UPDATE-MT5-ACCOUNT",

        // Support
        "SUPPORT",

        // Transaction
        "TRANSACTION-LIST",
        "DEPOSIT-WITHDRAWL-LIST",
        "REFERRAL-LIST"
    ];

    const permissionRecords = permissions.map(permission => ({
        userId,
        role,
        permission,
        isDeleted: true
    }));

    await PermissionModel.bulkCreate(permissionRecords);
}

async function actionTracking(req, userId, api, description){
    try {
        const getClientIp = (req) => {
            if (!req) return "127.0.0.1";
            const xForwardedFor = req.headers && req.headers["x-forwarded-for"];
            if (xForwardedFor) {
              return xForwardedFor.split(",")[0].trim();
            }
            return req.socket?.remoteAddress || req.ip || "127.0.0.1";
          };
      
          let ip = getClientIp(req);
          if (ip.startsWith("::ffff:")) {
            ip = ip.replace("::ffff:", "");
          }
      
          // Check if IP is private/local
          const isPrivateIp = (ip) =>
            ip === "127.0.0.1" ||
            ip === "::1" ||
            ip.startsWith("10.") ||
            ip.startsWith("192.168.") ||
            (ip.startsWith("172.") && parseInt(ip.split(".")[1]) >= 16 && parseInt(ip.split(".")[1]) <= 31);
      
          // Lookup geo-location
          const geo = !isPrivateIp(ip) ? geoip.lookup(ip) : null;
          const location = geo
            ? `${geo.city || ""}, ${geo.region || ""}, ${geo.country || ""}`
            : "Localhost or Private Network";
      
          // Parse User-Agent
          const userAgentString = req.headers["user-agent"] || "unknown";
          const agent = useragent.parse(userAgentString);
          const device =
            agent && agent.family && agent.os
              ? `${agent.family} ${agent.major} on ${agent.os.family} ${agent.os.major || ""}`
              : userAgentString;
            
        const data = await TrackingModel.create({
            userId: userId,
            api,
            description,
            ip,
            device,
            location,
        });
        // console.log(data)
    } catch (error) {
        console.log("Error tracking activity:", error);
    }
}

function generatePassword(length = 6) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.randomBytes(length);
    let password = "";
  
    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length];
    }
  
    return password + "@#sd5";
}

async function seedAdminPermissions(userId) {
    const permissions = [
        // Dashboard
        "DASHBOARD",
        "TRANSACTION-DASHBOARD",
        "USER-DASHBOARD",
        "APP-SETTING",

        // User Management
        "ADD-USER",
        "UPDATE-USER",
        "USER-LIST",
        "USER-BY-ID",
        "ASSET-LIST",
        "MT5-ADD-USER",
        "MT5-USER-LIST",
        "MT5-USER-BY-ID",
        "ADD-BANK",
        "BANK-LIST",
        "BANK-BY-ID",
        "UPDATE-BANK",
        "APPROVE-BANK",
        "UPLOAD-DOCUMENT",
        "DOCUMENT-LIST",
        "APPROVE-KYC",
        "PASSWORD-LIST",
        "CHANGE-PASSWORD",
        "UPDATE-MT5",
        "BANK-DEPOSIT-LIST",
        "ACTION-TRACKING",
        "SEND-EMAIL",
        "REFERRAL-LIST",
        "REFERRAL-TREE",

        // Transaction
        "CLIENT-DEPOSIT",
        "CLIENT-WITHDRAW",
        "WALLET-TO-META-DEPOSIT",
        "META-TO-WALLET-WITHDRAW",
        "WALLET-DEPOSIT",
        "WALLET-WITHDRAW",
        "REMOVE-BONUS",
        "TRANSACTION-LIST",
        "DEPOSIT-WITHDRAW-LIST",
        "DEPOSIT-WITHDRAW-BY-ID",
        "APPROVE-REJECT-DEPOSIT-WITHDRAW",
        "UPDATE-DEPOSIT-WITHDRAW-AMOUNT",
        "IB-WITHDRAW",

        // MT5 Accounts
        "MT5-GET-USER",
        "MT5-ADD",
        "MT5-UPDATE",
        "MT5-DELETE",
        "MT5-CHANGE-PASSWORD",
        "MT5-TRADE-STATUS",
        "MT5-CHECK-BALANCE",
        "MT5-DEPOSIT-BALANCE",
        "MT5-WITHDRAW-BALANCE",
        "MT5-MOVE-USER",
        "MT5-IMPORT-ACCOUNT",
        "MT5-REQUESTED-LIST",
        "MT5-APPROVE-REJECT-REQUESTED",

        // IB Management
        "IB-LIST",
        "IB-UPDATE",
        "IB-ADD-PLAN-NAME",
        "IB-PLAN-NAME-LIST",
        "IB-ADD-PLAN",
        "IB-PLAN-LIST",
        "IB-UPDATE-PLAN",
        "IB-SET-SUB-COMMISSION",
        "IB-UPDATE-SUB-COMMISSION",
        "IB-SUB-COMMISSION-LIST",
        "IB-MOVE-USER",
        "IB-REMOVE-USER",
        "IB-COMMISSION-TRX-LIST",
        "IB-REPORT",
        "IB-MANUAL-DISTRIBUTION",

        // Deals
        "DEAL-BY-TICKET",
        "DEAL-LIST",
        "DEAL-PAGE",
        "DEAL-BATCH",
        "DEAL-UPDATE",
        "DEAL-DELETE",

        // Positions
        "POSITION-SYMBOL",
        "POSITION-LIST",
        "OPEN-ORDER-LIST",
        "CLOSE-POSITION",
        "CLOSE-LIMIT-ORDER",
        "CLOSED-ORDER-LIST",

        // Groups
        "MT5-GROUP-LIST",
        "GROUP-CREATE",
        "GROUP-LIST",
        "GROUP-BY-ID",
        "GROUP-UPDATE",

        // Banners
        "BANNER-UPLOAD",
        "BANNER-DELETE",

        // Company Config
        "COMPANY-BANK-ADD",
        "COMPANY-BANK-UPDATE",
        "EXCHANGE-RATE-ADD",
        "EXCHANGE-RATE-UPDATE",

        // Support
        "SUPPORT-LIST",
        "SUPPORT-BY-ID",
        "SUPPORT-CLOSE",
        "SUPPORT-REPLAY",

        // Marketing
        "MARKETING-ADD-MEMBER",
        "MARKETING-MEMBER-LIST",
        "MARKETING-MEMBER-BY-ID",
        "MARKETING-UPDATE-MEMBER",
        "MARKETING-ASSIGN-MANAGER",
        "MARKETING-INCENTIVE-LIST",
        "MARKETING-INCENTIVE-BY-ID",
        "MARKETING-BULK-UPLOAD",
        "MARKETING-ADD-LEAD",
        "MARKETING-LEAD-LIST",
        "MARKETING-LEAD-BY-ID",
        "MARKETING-ASSIGN-TO",
        "MARKETING-UPDATE-LEAD",
        "MARKETING-PERMISSION-LIST",
        "MARKETING-UPDATE-PERMISSION",
        "MARKETING-ASSIGN-USER",
        "MARKETING-ASSIGN-USER-LIST",
        "MARKETING-ASSIGN-IB",

        // Master Trader
        "MASTER-TRADER-CREATE",
        "MASTER-TRADER-LIST",
        "MASTER-TRADER-BY-ID",
        "MASTER-TRADER-TRADE-LIST",
        "MASTER-TRADER-WATCHERS-LIST",
        "MASTER-TRADER-COPIERS-LIST",
        "MASTER-TRADER-WATCHERS-ANALYTICS",
        "MASTER-TRADER-UPDATE",

        // Copy Trade
        "COPY-TRADE-SUBSCRIPTIONS-LIST",
        "COPY-TRADE-SUBSCRIPTION-BY-ID",
        "COPY-TRADE-PAUSE",
        "COPY-TRADE-RESUME",
        "COPY-TRADE-DELETE",
        "COPY-TRADE-STATS",

        // Lots Calculation
        "LOTS-CALCULATION-UPLOAD",
        "LOTS-CALCULATION-EXPORT",

        // Admin Permission (only SUPER-ADMIN uses these)
        "ADMIN-PERMISSION-LIST",
        "ADMIN-UPDATE-PERMISSION",
    ];

    const permissionRecords = permissions.map(permission => ({
        userId,
        permission,
        isDeleted: true,
    }));

    await AdminPermissionModel.bulkCreate(permissionRecords);
}

async function errorTracking(req, description, api){
    try {
        const getClientIp = (req) => {
            const xForwardedFor = req.headers["x-forwarded-for"];
            if (xForwardedFor) {
              return xForwardedFor.split(",")[0].trim();
            }
            return req.socket?.remoteAddress || req.ip;
          };
      
          let ip = getClientIp(req);
          if (ip.startsWith("::ffff:")) {
            ip = ip.replace("::ffff:", "");
          }
      
          // Check if IP is private/local
          const isPrivateIp = (ip) =>
            ip === "127.0.0.1" ||
            ip === "::1" ||
            ip.startsWith("10.") ||
            ip.startsWith("192.168.") ||
            (ip.startsWith("172.") && parseInt(ip.split(".")[1]) >= 16 && parseInt(ip.split(".")[1]) <= 31);
      
          // Lookup geo-location
          const geo = !isPrivateIp(ip) ? geoip.lookup(ip) : null;
          const location = geo
            ? `${geo.city || ""}, ${geo.region || ""}, ${geo.country || ""}`
            : "Localhost or Private Network";
      
          // Parse User-Agent
          const userAgentString = req.headers["user-agent"] || "unknown";
          const agent = useragent.parse(userAgentString);
          const device =
            agent && agent.family && agent.os
              ? `${agent.family} ${agent.major} on ${agent.os.family} ${agent.os.major || ""}`
              : userAgentString;
            
        // Authenticated user ID
        const { user } = req.body;

        await ErrorTrackingModel.create({
            userId: user.id,
            description,
            ip,
            api,
            device,
            location,
        });
    } catch (error) {
        console.log("Error tracking activity:", error);
    }
}

module.exports.createUserName = createUserName;
module.exports.createMarketingUserName = createMarketingUserName;
module.exports.seedPermissions = seedPermissions;
module.exports.seedAdminPermissions = seedAdminPermissions;
module.exports.generateNumericString = generateNumericString;
module.exports.actionTracking = actionTracking;
module.exports.generatePassword = generatePassword;
module.exports.errorTracking = errorTracking;