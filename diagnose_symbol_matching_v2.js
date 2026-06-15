const sequelize = require('./config/db.config');
const SymbolModel = require('./models/symbol.model');
const Mt5GroupModel = require('./models/mt5Group.model');
const MetaControllers = require('./mt5Services/user');
const { authenticate, config, resetAgent } = require("./mt5Services/auth.js");
const configuration = require("./config/config.js");

async function diagnose() {
    console.log("==========================================");
    console.log("MT5 Symbol Allowed Mappings Diagnostic V2");
    console.log("Targeting login: 100024 | Symbol: AUDCAD");
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

        const login = 100024;
        const testSymbol = 'AUDCAD';

        console.log(`3. Querying MT5 Server for user login: ${login}...`);
        const mt5AccountData = await MetaControllers.getUser(login);
        console.log("MT5 Server Response:", JSON.stringify(mt5AccountData, null, 2));

        if (!mt5AccountData || !mt5AccountData.answer || !mt5AccountData.answer.Group) {
            console.log("❌ ERROR: MT5 Account not found on server or missing Group attribute!");
            return;
        }

        const mt5Group = mt5AccountData.answer.Group;
        console.log(`\n4. Finding MT5 Group [${mt5Group}] in CRM Database...`);
        
        // Fetch all active groups to perform robust case-insensitive and slash-normalized matching
        const allGroups = await Mt5GroupModel.findAll({
            where: { isDeleted: false }
        });

        const normalizePath = (p) => {
            return (p || "")
                .toLowerCase()
                .replace(/\\+/g, "/")
                .replace(/\/+/g, "/")
                .trim()
                .replace(/\/+$/, ""); // Strip trailing slashes!
        };

        const normalizedTarget = normalizePath(mt5Group);
        const mt5GroupData = allGroups.find(g => normalizePath(g.mt5GroupName) === normalizedTarget);

        if (!mt5GroupData) {
            console.log(`❌ ERROR: MT5 Group [${mt5Group}] is NOT found in "Mt5Groups" table!`);
            console.log("Current active MT5 groups in database are:");
            allGroups.forEach(g => console.log(`  - ${g.mt5GroupName} (id: ${g.id})`));
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

        const allSymbols = await SymbolModel.findAll({
            where: { isDeleted: false }
        });

        if (allSymbols.length === 0) {
            console.log("❌ ERROR: The Symbols table is empty on this environment!");
            return;
        }

        // Let's print some sample symbols
        console.log("\nSample symbols in DB (first 10):");
        allSymbols.slice(0, 10).forEach(s => {
            console.log(`  - ${s.symbol} (Path: ${s.path})`);
        });

        const symbolsData = allSymbols.filter(sym => {
            const sPath = normalizePath(sym.path);
            return groupPaths.some(gPath => {
                const gp = normalizePath(gPath);
                if (gp === "*") return true;
                if (sPath === gp) return true;
                if (sPath.startsWith(gp + "/")) return true;

                // MT5 Symbol Path Translation / Substitution Mapping
                if (gp === "forex") {
                    return sPath.includes("forex") || sPath.includes("cfd-fx") || sPath.includes("fx");
                }
                if (gp === "metals") {
                    return sPath.includes("metals") || sPath.includes("gold") || sPath.includes("silver");
                }
                if (gp === "crypto") {
                    return sPath.includes("crypto");
                }
                if (gp === "energies" || gp === "spot oil") {
                    return sPath.includes("energies") || sPath.includes("oil") || sPath.includes("gas");
                }
                if (gp === "indices") {
                    return sPath.includes("indices") || sPath.includes("index");
                }
                if (gp === "cfd-equities(usd)") {
                    return sPath.includes("cfd-equities") || sPath.includes("equities") || sPath.includes("shares") || sPath.includes("stocks");
                }
                if (gp === "vip") {
                    return sPath.includes("vip");
                }

                return false;
            });
        });

        console.log(`\nFound ${symbolsData.length} allowed symbol(s) for this group after filtering.`);
        
        console.log(`\n6. Performing matching check for symbol [${testSymbol}]...`);
        const symbolList = symbolsData.map(item => item.symbol);
        console.log("Allowed symbol list count:", symbolList.length);

        // Case-insensitive base symbol matching
        const matchedSymbol = symbolList.find(s => {
            const baseSymbol = s.split('.')[0].toLowerCase();
            return baseSymbol === testSymbol.toLowerCase();
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

            // Let's print all symbols in database that contain 'AUDCAD' (case-insensitive) to see their path
            const dbMatches = allSymbols.filter(s => s.symbol.toLowerCase().includes(testSymbol.toLowerCase()));
            console.log(`\nAll symbols in the DB containing "${testSymbol}":`);
            if (dbMatches.length > 0) {
                dbMatches.forEach(s => {
                    console.log(`  - Symbol: ${s.symbol} | Path: ${s.path} (Normalized Path: ${normalizePath(s.path)})`);
                });
            } else {
                console.log(`❌ No symbol containing "${testSymbol}" was found in the database at all!`);
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
