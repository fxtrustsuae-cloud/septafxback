const sequelize = require('./config/db.config');

async function checkDb() {
    try {
        const [results] = await sequelize.query('SELECT id, "Login", "userId" FROM "Mt5Accounts" ORDER BY id DESC LIMIT 5');
        console.log('Results:', results);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkDb();
