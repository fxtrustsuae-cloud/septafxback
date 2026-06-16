const axios = require('axios');
const crypto = require('crypto');
const config = require("../../config/config");
const projectId = config.PROJECT_ID;
const apiKey = config.API_KEY;
const apiBaseUrl = config.BASE_URL;
const { actionTracking } = require("../../helpers/index");
const PaymentModel = require("../../models/payment.model");
const Mt5Model = require("../../models/mt5Account.model");
const UserModel = require("../../models/users.model");

const PAYMENT_REQUEST_TIMEOUT_MS = Number(process.env.PAYMENT_REQUEST_TIMEOUT_MS || 20000);
const NETWORK_ALIASES = {
    TRON: "TRC20",
    BINANCE: "BEP20",
    BSC: "BEP20",
    ETH: "ERC20",
};
const ADDRESS_FIELDS = [
    "payment_address",
    "to_address",
    "address",
    "wallet_address",
    "deposit_address",
    "pay_address",
    "paymentAddress",
    "toAddress",
    "walletAddress",
    "depositAddress",
    "payAddress",
];
const PAYMENT_URL_FIELDS = [
    "invoice_payment_url",
    "checkout_url",
    "payment_url",
    "pay_url",
    "redirect_url",
    "payment_link",
    "hosted_url",
    "url",
    "link",
    "checkoutUrl",
    "paymentUrl",
    "payUrl",
    "redirectUrl",
    "paymentLink",
    "hostedUrl",
];

function normalizeNetwork(network) {
    const value = String(network || "").trim().toUpperCase();
    return NETWORK_ALIASES[value] || value;
}

function getCregisToken(network) {
    const normalizedNetwork = normalizeNetwork(network);

    if (normalizedNetwork === "BEP20") return "[\"USDT-BEP20\"]";
    if (normalizedNetwork === "TRC20") return "[\"USDT-TRC20\"]";
    if (normalizedNetwork === "ERC20") return "[\"USDT-ERC20\"]";

    return null;
}

function getTimestamp(value, fallback = Date.now()) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : fallback;
}

function firstPopulatedValue(source, keys) {
    if (!source || typeof source !== "object") return null;

    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }

    return null;
}

function normalizeCregisPaymentData(data, network) {
    const rawPaymentInfo = Array.isArray(data?.payment_info)
        ? data.payment_info[0] || {}
        : {};
    const paymentAddress = firstPopulatedValue(rawPaymentInfo, ADDRESS_FIELDS)
        || firstPopulatedValue(data, ADDRESS_FIELDS);
    const invoicePaymentUrl = firstPopulatedValue(data, PAYMENT_URL_FIELDS)
        || firstPopulatedValue(rawPaymentInfo, PAYMENT_URL_FIELDS);
    const normalizedNetwork = normalizeNetwork(network);

    return {
        ...data,
        invoice_payment_url: invoicePaymentUrl,
        payment_gateway: "CREGIS",
        payment_info: [{
            ...rawPaymentInfo,
            payment_address: paymentAddress,
            token_symbol: rawPaymentInfo.token_symbol || rawPaymentInfo.coinname || data?.token_symbol || "USDT",
            blockchain: rawPaymentInfo.blockchain || rawPaymentInfo.networkname || rawPaymentInfo.Networkname || data?.blockchain || normalizedNetwork,
            token_name: rawPaymentInfo.token_name || rawPaymentInfo.coinname || data?.token_name || "USDT",
            receive_amount: rawPaymentInfo.receive_amount || data?.receive_amount || data?.order_amount,
        }]
    };
}

function normalizePayOnCoinsPaymentData(data, network) {
    const paymentAddress = data.to_address || data.payment_address;
    const invoicePaymentUrl = data.invoice_payment_url;
    const normalizedNetwork = normalizeNetwork(network);

    const createdTimeStr = data.ondate || data.created_time;
    let createdTimeMs = createdTimeStr ? new Date(createdTimeStr.endsWith("Z") ? createdTimeStr : createdTimeStr + "Z").getTime() : Date.now();
    if (isNaN(createdTimeMs)) {
        createdTimeMs = Date.now();
    }
    const expireTimeMs = createdTimeMs + 10 * 60 * 1000; // Make it 10 minutes

    return {
        ...data,
        cregis_id: data.orderno,
        gateway_order_id: data.orderno,
        order_amount: data.amount_usd,
        created_time: createdTimeMs,
        expire_time: expireTimeMs,
        order_currency: "USD",
        payment_gateway: "PAYONCOINS",
        payment_info: [{
            payment_address: paymentAddress,
            token_symbol: "USDT",
            blockchain: normalizedNetwork,
            token_name: "USDT",
            receive_amount: data.amount || data.coinvalue,
            decimals: 6,
        }]
    };
}

function assertPayableInvoice(data, gatewayName) {
    const paymentInfo = Array.isArray(data?.payment_info) ? data.payment_info[0] : null;
    const paymentAddress = firstPopulatedValue(paymentInfo, ADDRESS_FIELDS)
        || firstPopulatedValue(data, ADDRESS_FIELDS);
    const invoicePaymentUrl = firstPopulatedValue(data, PAYMENT_URL_FIELDS)
        || firstPopulatedValue(paymentInfo, PAYMENT_URL_FIELDS);

    if (!paymentAddress && !invoicePaymentUrl) {
        throw new Error(`${gatewayName} created an invoice but did not return a deposit address or checkout link.`);
    }
}

function assertPayOnCoinsReady() {
    if (!config.PAYONCOINS_BASE_URL || !config.PAYONCOINS_PUBLIC_KEY || !config.PAYONCOINS_PRIVATE_KEY) {
        throw new Error("PayOnCoins gateway is not configured.");
    }
}

function assertCregisReady() {
    if (!projectId || !apiKey || !apiBaseUrl) {
        throw new Error("Cregis primary gateway is not configured.");
    }
}

// Step 2: Generate a random nonce
function generateNonce(length = 6) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < length; i++) {
        nonce += characters[Math.floor(Math.random() * characters.length)];
    }
    return nonce;
}

// Step 3: Generate signature
function generateSignature(params, apiKey) {
    const filteredParams = { ...params };
    delete filteredParams.sign;
    for (const key in filteredParams) {
        if (filteredParams[key] === null || filteredParams[key] === '') {
        delete filteredParams[key];
        }
    }

    const sortedKeys = Object.keys(filteredParams).sort();
    let signatureString = '';
    for (const key of sortedKeys) {
        signatureString += key + filteredParams[key];
    }

    signatureString = apiKey + signatureString;
    return crypto.createHash('md5').update(signatureString).digest('hex');
}

async function createCregisPaymentOrder(socketId, userId, amount, network) {
    assertCregisReady();

    const cregisToken = getCregisToken(network);
    if (!cregisToken) {
        throw new Error("Cregis does not support the selected network.");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();

    const params = {
        pid: parseInt(projectId),
        nonce,
        timestamp,
        order_id: socketId,
        order_amount: amount,
        order_currency: "USD",
        payer_id: userId,
        valid_time: 10,
        success_url: config.CALL_BACK,
        cancel_url: config.CALL_BACK,
        callback_url: `${config.CALL_BACK}/user/notifiaction`,
        remark: "USDT Deposit on CRM",
        tokens: cregisToken,
    };

    // Add the signature
    params.sign = generateSignature(params, apiKey);

    const response = await axios.post(`${apiBaseUrl}/api/v2/checkout`, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: PAYMENT_REQUEST_TIMEOUT_MS
    });

    if (!response.data?.data) {
        console.error("❌ Cregis raw response:", JSON.stringify(response.data, null, 2));
        throw new Error(response.data?.message || response.data?.msg || `Cregis did not return payment details. (code: ${response.data?.code ?? "unknown"})`);
    }

    const normalizedData = normalizeCregisPaymentData(response.data.data, network);
    assertPayableInvoice(normalizedData, "Cregis");

    return {
        ...response.data,
        data: normalizedData
    };
}

async function createPayOnCoinsPaymentOrder(socketId, userId, amount, network) {
    assertPayOnCoinsReady();

    const user = await UserModel.findByPk(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    const params = {
        username: user.userName || user.name || "Client",
        networkname: normalizeNetwork(network),
        coinname: "USDT",
        request_number: socketId,
        amount_usd: amount.toString(),
        useremail: user.email,
    };

    const response = await axios.post(`${config.PAYONCOINS_BASE_URL}/tp/create_invoice`, params, {
        headers: {
            'Content-Type': 'application/json',
            publickey: config.PAYONCOINS_PUBLIC_KEY,
            privatekey: config.PAYONCOINS_PRIVATE_KEY
        },
        timeout: PAYMENT_REQUEST_TIMEOUT_MS
    });

    if (!response.data || response.data.code !== "success") {
        console.error("❌ PayOnCoins raw response:", JSON.stringify(response.data, null, 2));
        throw new Error(response.data?.message || "PayOnCoins did not return a successful invoice.");
    }

    const normalizedData = normalizePayOnCoinsPaymentData(response.data, network);
    assertPayableInvoice(normalizedData, "PayOnCoins");

    return {
        code: "success",
        message: "Invoice generated successfully",
        data: normalizedData
    };
}

async function createPaymentOrder(socketId, userId, amount, network) {
    try {
        const result = await createPayOnCoinsPaymentOrder(socketId, userId, amount, network);
        actionTracking("", userId, "DEPOSIT-REQUEST-PAYONCOINS");
        return result;
    } catch (error) {
        console.error("❌ PayOnCoins payment order failed:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error(error.response?.data?.message || error.message || "PayOnCoins payment request failed.");
    }
}

async function savePyamentDetails(userId, socketId, data){
    try {
        const payment = data.payment_info[0];

        const newPayment = await PaymentModel.create({
            userId,
            socketId,
            cregisId: data.cregis_id,
            orderId: data.gateway_order_id || data.cregis_id,
            amount: data.order_amount,
            startTime: data.created_time,
            expireTime: data.expire_time,
            currency: data.order_currency,
            paymentAddress: payment.payment_address || payment.address || payment.to_address,
            tokenSymbol: payment.token_symbol || payment.coinname || "USDT",
            blockchain: payment.blockchain || payment.networkname || payment.Networkname,
            tokenName: payment.token_name || payment.coinname || "USDT",
            tokenDecimal: payment.token_decimals || payment.decimals,
            paymentType: "CRYPTO",
            status: "PENDING",
            remark: data.payment_gateway ? JSON.stringify({ gateway: data.payment_gateway }) : null
        });

        console.log(newPayment)
        return newPayment;
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

async function depositWithCard(socketId, amount, userData, login) {
    try {
        // console.log(userData)
        const orderID = generateNonce(15);
        const data = {
            channelId: "WEB",
            customerId: userData.userName,
            merchantId: "1695802795200",
            merchantType: "ECOMMERCE",
            orderID,
            email: userData.email,
            countrycode: userData.countryCode,
            mobilenumber: userData.mobile,
            orderDescription: login ? `Achiver MT5 ${login} Direct deposit` : "Achiver Deposit",
            orderAmount: amount * 3.67,
            user_name: userData.userName,
            orderCurrency: "AED",
            success_url: "https://client.achieverfinancials.com/client/transactions/transactionsList",
            failure_url: "https://client.achieverfinancials.com/client/myAccount"
        };
    
        const response = await axios.post(
            'https://api.paymentservice.me/v1/auth/create-new-order',
            data,
            {
                headers: { 'Content-Type': 'application/json' },
                maxBodyLength: Infinity
            }
        );
        const redirectUrl = response?.data?.redirectUrl;

        if(login){
            const checkLogin = await Mt5Model.findOne({
                where: { Login: `${login}`, accountType: "REAL", userId: userData.id }
            }); if(!checkLogin) return false;
        }

        // Parse query params
        const url = new URL(redirectUrl);
        const merchantId = url.searchParams.get("merchantId");

        await PaymentModel.create({
            userId: userData.id,
            socketId,
            amount: amount,
            currency: "USD",
            paymentType: "CARD",
            orderId: orderID,
            merchantId,
            login: login ? login : null,
            remark: login ? `Achiver Deposit for MT5 Account ${login}` : "Achiver deposit",
            customerId: userData.userName
        });

        console.log("✅ Order Response:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error creating order:", error);
        return false
    }
}

module.exports = {
    createPaymentOrder,
    savePyamentDetails,
    depositWithCard
};
