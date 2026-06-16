const sequelize = require('./config/db.config');

async function test() {
    try {
        const [res] = await sequelize.query('SELECT id, email, "user_name" FROM "Users" LIMIT 5');
        console.log("Users in DB:", res);
    } catch (e) {
        console.error("Query failed:", e.message);
    } finally {
        process.exit();
    }
}
test();
