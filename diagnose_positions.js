const sequelize = require('./config/db.config');
const PositionControllers = require('./mt5Services/position');
const { authenticate, config, resetAgent } = require("./mt5Services/auth.js");
const configuration = require("./config/config.js");

async function diagnose() {
    console.log("==========================================");
    console.log("MT5 Live Active Positions Diagnostic");
    console.log("==========================================");

    // Read login from command line arguments, default to 100024
    const login = parseInt(process.argv[2]) || 100024;
    console.log(`Targeting MT5 Login: ${login}\n`);

    try {
        // Authenticate with MT5 API
        resetAgent();
        console.log("1. Authenticating with MT5 Server...");
        await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
        console.log("MT5 Authentication Successful!\n");

        console.log(`2. Querying MT5 Server for live open positions on login: ${login}...`);
        const positionsResult = await PositionControllers.getPositionList(login, 0, 100);

        if (!positionsResult) {
            console.log("❌ ERROR: Failed to query position list from MT5 server!");
            return;
        }

        const positions = positionsResult.answer || [];
        console.log(`Found ${positions.length} active position(s) on the MT5 server:\n`);

        if (positions.length > 0) {
            console.table(positions.map(p => ({
                PositionID: p.Position,
                Symbol: p.Symbol,
                Type: p.Type === "0" ? "BUY" : p.Type === "1" ? "SELL" : p.Type,
                Volume: parseFloat(p.VolumeInitial) / 10000, // standard conversion if applicable, otherwise keep raw
                OpenPrice: p.PriceOpen,
                CurrentPrice: p.PriceCurrent,
                Profit: p.Profit,
                TimeSetup: p.TimeSetup ? new Date(parseInt(p.TimeSetup) * 1000).toISOString() : 'N/A'
            })));
            
            console.log("\nRaw Position Data (First Position):");
            console.log(JSON.stringify(positions[0], null, 2));
        } else {
            console.log("ℹ️ No active open positions found on MT5 for this account.");
            console.log("Ensure the account has open trades running or perform a trade in the frontend.");
        }

    } catch (err) {
        console.error("❌ An error occurred during positions diagnosis:", err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

diagnose();
