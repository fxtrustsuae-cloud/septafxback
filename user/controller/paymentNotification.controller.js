const axios = require("axios");
const config = require("../../config/config");
const SendMail = require("../../utils/mail");
const AssetModel = require("../../models/asset.model");
const UserModel = require("../../models/users.model");
const { actionTracking } = require("../../helpers/index");
const PaymentModel = require("../../models/payment.model");
const { socketEmitOne } = require("../../config/socketIO");
const TransactionModel = require("../../models/transaction.model");
const DepositWithdrawModel = require("../../models/depositWithdraw.model");
const TradeRequestControllers = require("../../mt5Services/tradeRequest");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");
const { userLogger } = require("../../utils/logger");

function isPayOnCoinsWebhook(body) {
    return Boolean(body?.orderno || body?.invoice_status_code || body?.payment || body?.payments);
}

function isPayOnCoinsConfirmed(body) {
    return Number(body.invoice_status_code) === 100 || body.status === "Confirm";
}

module.exports.paymentNotification = async (request, response) => {
    try {
        userLogger.info('Entering paymentNotification', { method: request.method || "", route: request.originalUrl || "" });

        if (isPayOnCoinsWebhook(request.body)) {
            console.log("PayOnCoins webhook:", request.body);
            if (isPayOnCoinsConfirmed(request.body)) {
                await verifyPayOnCoinsPayment(request.body);
            }

            userLogger.info('Exiting paymentNotification: PayOnCoins processed', { method: request.method || "", route: request.originalUrl || "" });
            return response.status(200).json({
                status_code: 200,
                detail: { code: 'success' },
                headers: null
            });
        }

        const { data, event_type } = request.body;
        console.log(data, event_type);

        if(event_type == "paid" || event_type == "paid_partial" || event_type == "paid_over") {
            await verifyPayment(data, event_type);
        }

        userLogger.info('Exiting paymentNotification: Request Processed', { method: request.method || "", route: request.originalUrl || "" });
        return response.json({
            status: true,
            message: "Received.",
            data: ''
        });
    } catch (e) {
        userLogger.error('Error in paymentNotification', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function verifyPayment(paymentDetails, event_type){
    try {
        const data = JSON.parse(paymentDetails);

        const checkPayment = await PaymentModel.findOne({
            where: { cregisId: data.cregis_id }
        });

        if(!checkPayment) return false;
        if(checkPayment.status != "PENDING") return false;

        // Mark the gateway payment as received (prevents double-processing on repeated webhooks)
        checkPayment.remark = JSON.stringify(data);
        checkPayment.status = "COMPLETED";
        await checkPayment.save();

        // Create a pending deposit record that requires admin approval before balance is credited
        await DepositWithdrawModel.create({
            userId: checkPayment.userId,
            amount: Number(data.pay_amount),
            transactionType: "DEPOSIT",
            paymentMethods: "CRYPTO",
            walletAddress: checkPayment.paymentAddress,
            network: checkPayment.blockchain,
            transactionReference: data.tx_id || null,
            status: "PENDING",
            remark: event_type,
        });

        actionTracking('', checkPayment.userId, "PAYMENT-RECEIVED-PENDING-APPROVAL");
        socketEmitOne("paymentStatus", "PENDING", checkPayment.socketId);
        console.log("Payment received from Cregis. Deposit pending admin approval.");

        const user = await UserModel.findOne({ where: { id: checkPayment.userId } });
        if (user) {
            const txId = data.tx_id || checkPayment.cregisId;
            const txAmount = Number(data.pay_amount);
            const txDate = new Date();
            SendMail.sendPendingTransactionAlertEmail(user.email, user.userName, "USDT-DEPOSIT", txAmount, txId, txDate).catch(() => {});
            SendMail.sendTransactionAlertEmail(config.ALERT_MAIL, user.userName, "USDT-DEPOSIT", txAmount, txId, txDate).catch(() => {});
        }

        return true;
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

async function verifyPayOnCoinsPayment(data){
    try {
        const orderNo = data.orderno || data.order_no || data.orderId;
        const amount = Number(data.invoice_amount_usd ?? data.amount_usd ?? data.coinvalue);
        const payments = data.payment || data.payments || [];
        const transactionHash = payments[0]?.transaction_hash || data.Transaction_hash || orderNo;

        if (!orderNo || !Number.isFinite(amount) || amount <= 0) return false;

        const checkPayment = await PaymentModel.findOne({
            where: { cregisId: orderNo }
        });

        if(!checkPayment) return false;
        if(checkPayment.status != "PENDING") return false;

        const checkAsset = await AssetModel.findOne({
            where: { userId: checkPayment.userId }
        });
        if(!checkAsset) return false;

        checkAsset.mainBalance += amount;
        checkAsset.totalDeposit += amount;
        await checkAsset.save();

        await TransactionModel.create({
            userId: checkPayment.userId,
            amount,
            transactionType: "WALLET-DEPOSIT",
            remark: "PayOnCoins Deposit",
            paymentMethods: "CRYPTO",
            referrenceNo: transactionHash
        });

        checkPayment.remark = JSON.stringify(data);
        checkPayment.status = "COMPLETED";
        await checkPayment.save();

        actionTracking('', checkPayment.userId, "PAYMENT-VERIFIED-PAYONCOINS");
        socketEmitOne("paymentStatus", "SUCCESS", checkPayment.socketId);
        return true;
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

module.exports.cardPaymentNotification = async (request, response) => {
    try {
        userLogger.info('Entering cardPaymentNotification', { method: request.method || "", route: request.originalUrl || "" });
        const reqData = request.body;
        console.log("Callabck Data", reqData)
        const data = { 
            transactionid: reqData.transactionid,
            mid: reqData.mid
        };

        const checkPayment = await PaymentModel.findOne({
            where: { orderId: reqData.orderid, status : "PENDING" }
        }); if(!checkPayment) return;

        const response = await axios.post(
            'https://api.paymentservice.me/v1/auth/getstatus',
            data,
            {
                headers: { 'Content-Type': 'application/json' },
                maxBodyLength: Infinity
            }
        );

        if(response.data.status == "ok") {
            const callBackDetails = response.data.transactionDetail;
            const amount = Number((callBackDetails.amount / 3.67).toFixed(2));

            if(checkPayment.login) {
                await metaDeposit(checkPayment.userId, checkPayment.login, amount, reqData.transactionid);
            } else {
                const checkAsset = await AssetModel.findOne({
                    where: { userId: checkPayment.userId }
                }); if(!checkAsset) return false;

                checkAsset.mainBalance += Number(amount);
                checkAsset.totalDeposit += Number(amount);
                await checkAsset.save();

                await TransactionModel.create({
                    userId: checkPayment.userId,
                    amount,
                    transactionType: "WALLET-DEPOSIT",
                    remark: callBackDetails.status,
                    paymentMethods: "E-PAY", 
                    referrenceNo: reqData.transactionid
                });
            }

            checkPayment.remark = JSON.stringify(data);
            checkPayment.status = "COMPLETED";
            await checkPayment.save();
        }
    } catch (e) {
        userLogger.error('Error in cardPaymentNotification', { stack: e.stack || e, method: request.method || "", route: request.originalUrl || "" });
        handleErrorResponse(e, response);
    }
};

async function metaDeposit(userId, login, amount, referenceId) {
    try {
        const assetData = await AssetModel.findOne({
            where: { userId }
        }); if(!assetData) throw CustomErrorHandler.notFound("Asset Details Not Found!")

        const newDeposit = await TradeRequestControllers.depositWithdraw(login, 2, amount, "DIRECT-DEPOSIT");
        if(!newDeposit) throw CustomErrorHandler.serverError(`Meta Deposit Failed!`);

        assetData.totalMetaDeposit += Number(amount);
        await assetData.save();

        await TransactionModel.create({
            userId,
            mt5Login: login,
            amount,
            transactionType: "INTERNAL-DEPOSIT",
            remark: "Direct Deposite in MT5",
            paymentMethods: "E-PAY",
            referrenceNo: referenceId
        });

        return true
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

module.exports.checkPaymentStatus = async (request, response) => {
    try {
        const { orderNo } = request.params;
        const checkPayment = await PaymentModel.findOne({ where: { cregisId: orderNo } });
        
        if (!checkPayment) {
            return response.status(404).json({ status: false, message: "Payment order not found." });
        }

        if (checkPayment.status === "COMPLETED") {
            return response.json({ status: true, message: "Payment already confirmed." });
        }

        const apiRes = await axios.post(`${config.PAYONCOINS_BASE_URL}/tp/invoice_status`, {
            orderno: checkPayment.cregisId
        }, {
            headers: {
                'Content-Type': 'application/json',
                publickey: config.PAYONCOINS_PUBLIC_KEY,
                privatekey: config.PAYONCOINS_PRIVATE_KEY
            }
        });

        if (apiRes.data && Number(apiRes.data.invoice_status_code) === 100) {
            await verifyPayOnCoinsPayment(apiRes.data);
            return response.json({ status: true, message: "Payment confirmed successfully!" });
        } else if (apiRes.data && Number(apiRes.data.invoice_status_code) === 1) {
             return response.json({ status: false, message: "Payment is still pending on the blockchain." });
        } else {
             return response.json({ status: false, message: apiRes.data?.StatusDesc || "Payment status unknown." });
        }

    } catch (e) {
        userLogger.error('Error in checkPaymentStatus', { stack: e.stack || e });
        handleErrorResponse(e, response);
    }
};
