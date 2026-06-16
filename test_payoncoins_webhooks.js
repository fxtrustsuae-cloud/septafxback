const dotenv = require('dotenv');
dotenv.config();

const sequelize = require('./config/db.config');
const UserModel = require('./models/users.model');
const AssetModel = require('./models/asset.model');
const PaymentModel = require('./models/payment.model');
const TransactionModel = require('./models/transaction.model');
const DepositWithdrawModel = require('./models/depositWithdraw.model');
const { paymentNotification, withdrawNotification } = require('./user/controller/paymentNotification.controller');

// Helper to simulate request/response for Express middleware
function mockResponse() {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.body = data;
        return res;
    };
    return res;
}

async function runTests() {
    console.log("=== PayOnCoins Webhooks Integration Tests ===");

    try {
        // 1. Authenticate with Database
        await sequelize.authenticate();
        console.log("✅ Database connected successfully.");

        // 2. Find or create a test user
        let user = await UserModel.findByPk(1);
        if (!user) {
            console.log("⚠️ Test User with ID 1 does not exist. Finding first user...");
            user = await UserModel.findOne();
            if (!user) {
                console.error("❌ No users found in database. Please run seed or create a user.");
                process.exit(1);
            }
        }
        console.log(`✅ Using Test User: ID=${user.id}, Username=${user.userName}, Email=${user.email}`);

        // Find or create asset
        let asset = await AssetModel.findOne({ where: { userId: user.id } });
        if (!asset) {
            asset = await AssetModel.create({
                userId: user.id,
                mainBalance: 1000.0,
                totalDeposit: 1000.0
            });
        }
        console.log(`Initial User Balance: ${asset.mainBalance}`);

        // ==========================================
        // TEST 1: PayOnCoins Invoice Webhook
        // ==========================================
        console.log("\n--- Running Test 1: Invoice Webhook (Deposit) ---");
        const orderNo = `INV_${Date.now()}`;
        
        // Create a pending payment model record
        const payment = await PaymentModel.create({
            userId: user.id,
            socketId: 'test_socket_id',
            cregisId: orderNo,
            orderId: orderNo,
            amount: 50.0,
            status: 'PENDING',
            paymentAddress: '0xAddress',
            blockchain: 'BSC',
            remark: ''
        });
        console.log(`Created PENDING Payment in DB: cregisId (orderno) = ${orderNo}`);

        const invoiceReq = {
            body: {
                orderno: orderNo,
                invoice_status_code: 100, // Success
                amount_usd: 50.0,
                coinvalue: "50",
                payment: [{ transaction_hash: `tx_${Date.now()}`, amount: "50" }]
            },
            method: 'POST',
            originalUrl: '/api/payments/payoncoins/invoice/webhook'
        };
        const invoiceRes = mockResponse();

        const balanceBeforeDeposit = Number((await AssetModel.findOne({ where: { userId: user.id } })).mainBalance);
        await paymentNotification(invoiceReq, invoiceRes);
        
        console.log(`Invoice Webhook response status code: ${invoiceRes.statusCode || 200}`);
        console.log("Invoice Webhook response body:", JSON.stringify(invoiceRes.body, null, 2));

        const updatedPayment = await PaymentModel.findOne({ where: { cregisId: orderNo } });
        const balanceAfterDeposit = Number((await AssetModel.findOne({ where: { userId: user.id } })).mainBalance);
        
        console.log(`Updated Payment Status: ${updatedPayment.status} (expected: COMPLETED)`);
        console.log(`Balance before: ${balanceBeforeDeposit}, after: ${balanceAfterDeposit} (expected increase of 50.0)`);
        
        if (updatedPayment.status === 'COMPLETED' && balanceAfterDeposit === balanceBeforeDeposit + 50.0) {
            console.log("✅ Test 1 Passed!");
        } else {
            console.error("❌ Test 1 Failed!");
        }

        // ==========================================
        // TEST 2: PayOnCoins Withdraw Webhook (Success/Completion)
        // ==========================================
        console.log("\n--- Running Test 2: Withdraw Webhook (Success) ---");
        const withdrawRefSuccess = `WD_SUC_${Date.now()}`;
        
        // Create a pending withdrawal request
        const withdrawalSuccess = await DepositWithdrawModel.create({
            userId: user.id,
            amount: 30.0,
            transactionType: 'WITHDRAW',
            paymentMethods: 'CRYPTO',
            network: 'BSC',
            walletAddress: '0xWithdrawAddress',
            status: 'PENDING',
            transactionReference: withdrawRefSuccess,
            remark: 'Awaiting webhook'
        });
        console.log(`Created PENDING Withdrawal in DB: transactionReference = ${withdrawRefSuccess}`);

        const withdrawSucReq = {
            body: {
                orderno: withdrawRefSuccess,
                withdraw_status_code: 100, // Success code
                transaction_hash: `tx_wd_${Date.now()}`,
                remark: 'Withdraw successful'
            },
            method: 'POST',
            originalUrl: '/api/payments/payoncoins/withdraw/webhook'
        };
        const withdrawSucRes = mockResponse();

        const balanceBeforeWdSuc = Number((await AssetModel.findOne({ where: { userId: user.id } })).mainBalance);
        await withdrawNotification(withdrawSucReq, withdrawSucRes);

        console.log(`Withdraw Success Webhook response status code: ${withdrawSucRes.statusCode || 200}`);
        console.log("Withdraw Success Webhook response body:", JSON.stringify(withdrawSucRes.body, null, 2));

        const updatedWithdrawSuccess = await DepositWithdrawModel.findOne({ where: { transactionReference: withdrawRefSuccess } });
        const balanceAfterWdSuc = Number((await AssetModel.findOne({ where: { userId: user.id } })).mainBalance);

        console.log(`Updated Withdrawal Status: ${updatedWithdrawSuccess.status} (expected: COMPLETED)`);
        console.log(`Balance before: ${balanceBeforeWdSuc}, after: ${balanceAfterWdSuc} (expected: no change, balance was already deducted when withdrawal request was created)`);

        if (updatedWithdrawSuccess.status === 'COMPLETED' && balanceAfterWdSuc === balanceBeforeWdSuc) {
            console.log("✅ Test 2 Passed!");
        } else {
            console.error("❌ Test 2 Failed!");
        }

        // ==========================================
        // TEST 3: PayOnCoins Withdraw Webhook (Fail/Refund)
        // ==========================================
        console.log("\n--- Running Test 3: Withdraw Webhook (Failure / Refund) ---");
        const withdrawRefFail = `WD_FAIL_${Date.now()}`;

        // Create a pending withdrawal request
        const withdrawalFail = await DepositWithdrawModel.create({
            userId: user.id,
            amount: 40.0,
            transactionType: 'WITHDRAW',
            paymentMethods: 'CRYPTO',
            network: 'BSC',
            walletAddress: '0xWithdrawAddress',
            status: 'PENDING',
            transactionReference: withdrawRefFail,
            remark: 'Awaiting webhook'
        });
        console.log(`Created PENDING Withdrawal in DB: transactionReference = ${withdrawRefFail}`);

        const withdrawFailReq = {
            body: {
                orderno: withdrawRefFail,
                withdraw_status_code: 4, // Failure code (could be 4 or -1)
                remark: 'Withdraw rejected'
            },
            method: 'POST',
            originalUrl: '/api/payments/payoncoins/withdraw/webhook'
        };
        const withdrawFailRes = mockResponse();

        const balanceBeforeWdFail = Number((await AssetModel.findOne({ where: { userId: user.id } })).mainBalance);
        await withdrawNotification(withdrawFailReq, withdrawFailRes);

        console.log(`Withdraw Fail Webhook response status code: ${withdrawFailRes.statusCode || 200}`);
        console.log("Withdraw Fail Webhook response body:", JSON.stringify(withdrawFailRes.body, null, 2));

        const updatedWithdrawFail = await DepositWithdrawModel.findOne({ where: { transactionReference: withdrawRefFail } });
        const balanceAfterWdFail = Number((await AssetModel.findOne({ where: { userId: user.id } })).mainBalance);

        console.log(`Updated Withdrawal Status: ${updatedWithdrawFail.status} (expected: REJECTED)`);
        console.log(`Balance before: ${balanceBeforeWdFail}, after: ${balanceAfterWdFail} (expected increase of 40.0 refund)`);

        if (updatedWithdrawFail.status === 'REJECTED' && balanceAfterWdFail === balanceBeforeWdFail + 40.0) {
            console.log("✅ Test 3 Passed!");
        } else {
            console.error("❌ Test 3 Failed!");
        }

    } catch (err) {
        console.error("❌ Test script error:", err);
    } finally {
        await sequelize.close();
        console.log("\n=== Testing Session Concluded ===");
    }
}

runTests();
