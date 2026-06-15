const sequelize = require('./config/db.config');
const { updateMt5Group, updateMt5Symbol } = require('./admin/controller/group.controller');
const { authenticate, config, resetAgent } = require("./mt5Services/auth.js");
const configuration = require("./config/config.js");

async function runManualSync() {
    console.log("==========================================");
    console.log("MT5 CRM Database Group & Symbol Synchronizer");
    console.log("==========================================");
    
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // Authenticate with MT5 API
        resetAgent();
        console.log("\n[AUTH] Authenticating with MT5 Server...");
        await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
        console.log("[AUTH] MT5 Authentication Successful!");

        // 1. Sync MT5 Groups
        console.log('\n[1/2] Synchronizing MT5 Groups from server to CRM DB...');
        const groupSyncResult = await updateMt5Group();
        console.log('Group Sync Result:', JSON.stringify(groupSyncResult, null, 2));

        // 2. Sync MT5 Symbols
        console.log('\n[2/2] Synchronizing MT5 Symbols from server to CRM DB...');
        const symbolSyncResult = await updateMt5Symbol();
        console.log('Symbol Sync Result:', JSON.stringify(symbolSyncResult, null, 2));

        console.log('\n✅ Database Synchronization Complete!');
        
        // 3. Print mapping check
        const [groupsCheck] = await sequelize.query(`
            SELECT count(*) as total_groups FROM "Mt5Groups" WHERE is_deleted = false
        `);
        const [symbolsCheck] = await sequelize.query(`
            SELECT count(*) as total_symbols FROM "Symbols" WHERE is_deleted = false
        `);
        console.log(`\nCRM Database Summary:`);
        console.log(`- Total MT5 Groups in DB: ${groupsCheck[0].total_groups}`);
        console.log(`- Total Symbols in DB: ${symbolsCheck[0].total_symbols}`);

    } catch (error) {
        console.error('\n❌ An error occurred during manual sync:', error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

runManualSync();
