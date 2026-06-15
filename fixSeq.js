const sequelize = require('./config/db.config');

async function fixSequence() {
    try {
        const query = 'SELECT setval(\'"Mt5Accounts_id_seq"\', COALESCE((SELECT MAX(id) FROM "Mt5Accounts"), 1), true);';
        const [results, metadata] = await sequelize.query(query);
        console.log('Sequence updated successfully:', results);
    } catch (err) {
        console.error('Error updating sequence:', err);
    } finally {
        process.exit(0);
    }
}

fixSequence();
