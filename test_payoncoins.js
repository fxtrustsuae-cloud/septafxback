const dotenv = require('dotenv');
dotenv.config();

const sequelize = require('./config/db.config');
const UserModel = require('./models/users.model');
const AssetModel = require('./models/asset.model');
const PaymentModel = require('./models/payment.model');
const TransactionModel = require('./models/transaction.model');
const { createPaymentOrder, savePyamentDetails } = require('./user/controller/payment.controller');
const { checkPaymentStatus } = require('./user/controller/paymentNotification.controller');

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
    console.log("=== PayOnCoins Gateway Integration Tests ===");

    try {
        // 1. Authenticate with Database
        await sequelize.authenticate();
        console.log("✅ Database connected successfully.");

        // 2. Ensure User and Asset record exist
        const user = await UserModel.findByPk(1);
        if (!user) {
            console.error("❌ Test User with ID 1 does not exist in DB.");
            process.exit(1);
        }
        console.log(`✅ Found Test User: ID=${user.id}, Username=${user.userName}, Email=${user.email}`);

        let asset = await AssetModel.findOne({ where: { userId: user.id } });
        if (!asset) {
            console.log("⚠️ Asset record not found. Creating one for test...");
            asset = await AssetModel.create({
                userId: user.id,
                mainBalance: 100.0,
                totalDeposit: 100.0
            });
            console.log("✅ Created Asset record.");
        } else {
            console.log(`✅ Found Asset record. Current Balance: ${asset.mainBalance}`);
        }

        // 3. Test createPaymentOrder (PayOnCoins)
        const socketId = `test_sock_${Date.now()}`;
        const amount = 10.0;
        const network = 'TRC20';
        
        console.log(`\n--- Test 1: Creating PayOnCoins Invoice for $${amount} on ${network} ---`);
        const orderRes = await createPaymentOrder(socketId, user.id, amount, network);
        console.log("✅ createPaymentOrder returned response:", JSON.stringify(orderRes, null, 2));

        if (!orderRes || orderRes.code !== "success" || !orderRes.data) {
            throw new Error("createPaymentOrder response did not indicate success");
        }

        const normalizedData = orderRes.data;
        const cregisId = normalizedData.cregis_id;
        console.log(`Generated Cregis ID (Order No): ${cregisId}`);

        // 4. Test savePyamentDetails
        console.log(`\n--- Test 2: Saving Payment Details in DB ---`);
        const savedPayment = await savePyamentDetails(user.id, socketId, normalizedData);
        if (!savedPayment) {
            throw new Error("Failed to save payment details to database");
        }
        console.log(`✅ Saved Payment to DB with ID: ${savedPayment.id}, Status: ${savedPayment.status}`);

        // 5. Test checkPaymentStatus endpoint (via simulated Express middleware)
        console.log(`\n--- Test 3: Checking Payment Status via checkPaymentStatus Middleware ---`);
        const req = {
            params: { orderNo: cregisId }
        };
        const res = mockResponse();

        await checkPaymentStatus(req, res);
        console.log(`✅ checkPaymentStatus Response Code: ${res.statusCode || 200}`);
        console.log("Response Body:", JSON.stringify(res.body, null, 2));

        // 6. Test Webhook callback (verifyPayOnCoinsPayment) via simulated POST /paymentNotification
        console.log(`\n--- Test 4: Simulating Webhook Callback to confirm payment ---`);
        const { paymentNotification } = require('./user/controller/paymentNotification.controller');

        // Build a simulated PayOnCoins confirmation callback request body
        const webhookBody = {
            orderno: cregisId,
            invoice_status_code: 100, // 100 means completed/confirmed
            amount_usd: amount,
            coinvalue: normalizedData.coinvalue || "10",
            payment: [
                {
                    transaction_hash: `mock_tx_hash_${Date.now()}`,
                    amount: normalizedData.coinvalue || "10"
                }
            ]
        };

        const webhookReq = {
            body: webhookBody,
            method: 'POST',
            originalUrl: '/user/notification'
        };
        const webhookRes = mockResponse();

        // Check initial state before webhook
        const balanceBefore = (await AssetModel.findOne({ where: { userId: user.id } })).mainBalance;
        console.log(`User balance BEFORE webhook: ${balanceBefore}`);

        await paymentNotification(webhookReq, webhookRes);
        console.log(`✅ paymentNotification Response Code: ${webhookRes.statusCode || 200}`);
        console.log("Response Body:", JSON.stringify(webhookRes.body, null, 2));

        // Validate state changes in DB
        const updatedPayment = await PaymentModel.findOne({ where: { cregisId } });
        console.log(`Payment Status AFTER webhook: ${updatedPayment.status} (expected: COMPLETED)`);
        
        const balanceAfter = (await AssetModel.findOne({ where: { userId: user.id } })).mainBalance;
        console.log(`User balance AFTER webhook: ${balanceAfter} (expected: ${balanceBefore + amount})`);

        if (updatedPayment.status === 'COMPLETED' && balanceAfter === balanceBefore + amount) {
            console.log("\n⭐️ ALL TESTS PASSED SUCCESSFULLY! ⭐️");
        } else {
            console.error("\n❌ Database state check failed. Some values did not match expectations.");
        }

    } catch (error) {
        console.error("❌ Test failed with error:", error);
    } finally {
        // Clean up database connection
        await sequelize.close();
        process.exit(0);
    }
}

runTests();
