const sequelize = require('./config/db.config');

async function inspectDb() {
    try {
        const [groups] = await sequelize.query('SELECT * FROM "Groups"');
        console.log('--- Groups Table ---');
        console.log(JSON.stringify(groups, null, 2));

        const [mt5Groups] = await sequelize.query('SELECT * FROM "Mt5Groups"');
        console.log('\n--- Mt5Groups Table ---');
        console.log(JSON.stringify(mt5Groups, null, 2));
    } catch (err) {
        console.error('Error querying tables:', err);
    } finally {
        process.exit(0);
    }
}

inspectDb();
