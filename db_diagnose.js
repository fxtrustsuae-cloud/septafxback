const sequelize = require('./config/db.config');
const SymbolModel = require('./models/symbol.model');
const Mt5GroupModel = require('./models/mt5Group.model');
const Mt5AccountModel = require('./models/mt5Account.model');
const GroupModel = require('./models/group.model');

async function runDbDiagnose() {
    console.log("==========================================");
    console.log("CRM Database Tables Local Diagnostic (Independent Queries)");
    console.log("==========================================");

    try {
        console.log('1. Connecting to PostgreSQL CRM Database...');
        await sequelize.authenticate();
        console.log('CRM Database connected successfully.\n');

        // Check Mt5Accounts
        console.log("2. Querying Mt5Accounts for login 100023 and 100024...");
        const accounts = await Mt5AccountModel.findAll({
            where: { Login: ['100023', '100024'] }
        });

        console.log(`Found ${accounts.length} account(s) in local CRM DB:`);
        for (const acc of accounts) {
            let groupInfo = null;
            let mt5GroupInfo = null;

            if (acc.groupId) {
                const group = await GroupModel.findByPk(acc.groupId);
                if (group) {
                    groupInfo = {
                        id: group.id,
                        name: group.name,
                        mt5GroupId: group.mt5Group
                    };

                    if (group.mt5Group) {
                        const mt5GroupData = await Mt5GroupModel.findByPk(group.mt5Group);
                        if (mt5GroupData) {
                            mt5GroupInfo = {
                                id: mt5GroupData.id,
                                mt5GroupName: mt5GroupData.mt5GroupName,
                                path: mt5GroupData.path
                            };
                        }
                    }
                }
            }

            console.log(JSON.stringify({
                id: acc.id,
                Login: acc.Login,
                userId: acc.userId,
                accountType: acc.accountType,
                groupId: acc.groupId,
                isDeleted: acc.isDeleted,
                group: groupInfo,
                mt5Group: mt5GroupInfo
            }, null, 2));
        }

        // Check Mt5Groups
        console.log("\n3. Querying Mt5Groups in the database...");
        const mt5Groups = await Mt5GroupModel.findAll({ where: { isDeleted: false } });
        console.log(`Total active MT5 Groups in database: ${mt5Groups.length}`);
        mt5Groups.forEach(grp => {
            console.log(`- ID: ${grp.id} | Name: "${grp.mt5GroupName}" | Paths:`, grp.path);
        });

        // Check Symbols
        console.log("\n4. Checking Symbols count and samples...");
        const symbolsCount = await SymbolModel.count({ where: { isDeleted: false } });
        console.log(`Total active symbols in "Symbols" table: ${symbolsCount}`);

        if (symbolsCount > 0) {
            const samples = await SymbolModel.findAll({
                where: { isDeleted: false },
                limit: 15
            });
            console.log("Sample symbols from database:");
            samples.forEach(s => {
                console.log(`  * Symbol: "${s.symbol}" | Path: "${s.path}"`);
            });
        } else {
            console.log("❌ WARNING: The Symbols table is empty! This is why symbol matching is failing!");
            console.log("Please make sure you have run the sync script successfully or check if updateMt5Symbol inserted records.");
        }

    } catch (error) {
        console.error("❌ Diagnostic Error:", error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

runDbDiagnose();
