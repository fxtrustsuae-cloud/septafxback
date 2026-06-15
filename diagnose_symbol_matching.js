const sequelize = require('./config/db.config');
const SymbolModel = require('./models/symbol.model');
const Mt5GroupModel = require('./models/mt5Group.model');
const MetaControllers = require('./mt5Services/user');
const { authenticate, config, resetAgent } = require("./mt5Services/auth.js");
const configuration = require("./config/config.js");

async function diagnose() {
    console.log("==========================================");
    console.log("MT5 Symbol Allowed Mappings Diagnostic");
    console.log("==========================================");

    try {
        console.log('1. Connecting to CRM Database...');
        await sequelize.authenticate();
        console.log('CRM Database connected successfully.\n');

        // Authenticate with MT5 API
        resetAgent();
        console.log("2. Authenticating with MT5 Server...");
        await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
        console.log("MT5 Authentication Successful!\n");

        const login = 100023;
        const testSymbol = 'XAUUSD';

        console.log(`3. Querying MT5 Server for user login: ${login}...`);
        const mt5AccountData = await MetaControllers.getUser(login);
        console.log("MT5 Server Response:", JSON.stringify(mt5AccountData, null, 2));

        if (!mt5AccountData || !mt5AccountData.answer || !mt5AccountData.answer.Group) {
            console.log("❌ ERROR: MT5 Account not found on server or missing Group attribute!");
            return;
        }

        const mt5Group = mt5AccountData.answer.Group;
        console.log(`\n4. Finding MT5 Group [${mt5Group}] in CRM Database...`);
        const mt5GroupData = await Mt5GroupModel.findOne({
            where: { mt5GroupName: mt5Group }
        });

        if (!mt5GroupData) {
            console.log(`❌ ERROR: MT5 Group [${mt5Group}] is NOT found in "Mt5Groups" table!`);
            console.log("Please run: node sync_mt5_db.js");
            return;
        }

        console.log("Found MT5 Group in CRM DB:", {
            id: mt5GroupData.id,
            mt5GroupName: mt5GroupData.mt5GroupName,
            path: mt5GroupData.path
        });

        const groupPaths = mt5GroupData.path || [];
        const isWildcardAll = groupPaths.includes('*');

        console.log(`\n5. Checking active symbols in "Symbols" table matching the paths:`, groupPaths);
        const totalSymbolsCount = await SymbolModel.count({ where: { isDeleted: false } });
        console.log(`Total active symbols in Symbols table: ${totalSymbolsCount}`);

        let symbolsData;
        if (isWildcardAll) {
            console.log("Group contains absolute wildcard '*'. Fetching all active symbols...");
            symbolsData = await SymbolModel.findAll({
                where: { isDeleted: false }
            });
        } else {
            console.log("Fetching and filtering active symbols based on paths...");
            const allSymbols = await SymbolModel.findAll({
                where: { isDeleted: false }
            });
            symbolsData = allSymbols.filter(sym => {
                const sPath = sym.path || "";
                return groupPaths.some(gPath => {
                    if (gPath === "*") return true;
                    if (sPath === gPath) return true;
                    if (sPath.startsWith(gPath + "\\")) return true;
                    if (sPath.startsWith(gPath + "/")) return true;
                    return false;
                });
            });
        }

        console.log(`Found ${symbolsData.length} allowed symbol(s) for this group.`);
        if (symbolsData.length > 0) {
            console.log("Sample allowed symbols:", symbolsData.slice(0, 10).map(s => `${s.symbol} (Path: ${s.path})`));
        }

        console.log(`\n6. Performing matching check for symbol [${testSymbol}]...`);
        const symbolList = symbolsData.map(item => item.symbol);
        const matchedSymbol = symbolList.find(s => {
            const baseSymbol = s.split('.')[0];
            return baseSymbol === testSymbol;
        });

        if (matchedSymbol) {
            console.log(`✅ SUCCESS: Symbol [${testSymbol}] is allowed! Matched as: ${matchedSymbol}`);
        } else {
            console.log(`❌ FAILURE: Symbol [${testSymbol}] is NOT allowed for this user group.`);
            const closeMatches = symbolList.filter(s => s.toLowerCase().includes(testSymbol.toLowerCase()));
            if (closeMatches.length > 0) {
                console.log(`Close matches found in allowed list:`, closeMatches);
            } else {
                console.log("No close matches found in the allowed symbols list.");
            }
        }

    } catch (err) {
        console.error("❌ An error occurred during diagnosis:", err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

diagnose();
