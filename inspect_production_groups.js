const sequelize = require('./config/db.config');

async function inspectDb() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        const [groups] = await sequelize.query(`
            SELECT g.id, g.name, g.type, g.leverage, g.status, m.id as "mt5GroupId", m.mt5_group_name 
            FROM "Groups" g 
            LEFT JOIN "Mt5Groups" m ON g.mt5_group = m.id
            WHERE g.is_deleted = false
        `);
        console.log('\n--- Active CRM Groups and their MT5 Mappings ---');
        console.log(JSON.stringify(groups, null, 2));

        const [allMt5Groups] = await sequelize.query(`
            SELECT id, mt5_group_name FROM "Mt5Groups" WHERE is_deleted = false
        `);
        console.log('\n--- Active MT5 Groups in CRM DB ---');
        console.log(JSON.stringify(allMt5Groups, null, 2));

    } catch (err) {
        console.error('Error querying tables:', err);
    } finally {
        process.exit(0);
    }
}

inspectDb();
