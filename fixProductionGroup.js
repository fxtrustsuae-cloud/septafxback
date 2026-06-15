const sequelize = require('./config/db.config');
const Mt5GroupModel = require('./models/mt5Group.model');

async function fixGroup() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // 1. Attempt to update using Sequelize Model (safest, handles underscored conversion)
        console.log('Attempting to update group name using Sequelize Model...');
        const [updatedRows] = await Mt5GroupModel.update(
            { mt5GroupName: 'Flexy\\Superfast' },
            { 
                where: { 
                    mt5GroupName: 'FlexyA\\Superfast' 
                },
                silent: true // prevent automatic timestamp updates if undesired, but let it update normally
            }
        );

        console.log(`Sequelize Model Update result: Updated ${updatedRows} row(s).`);

        // 2. Fallback / Raw SQL check & update to be absolutely certain
        console.log('Running raw SQL validation and fallback...');
        
        // Let's check if there are any remaining rows with 'FlexyA\\Superfast' in either standard format
        const [rowsWithA] = await sequelize.query(`
            SELECT id, "mt5_group_name" FROM "Mt5Groups" 
            WHERE "mt5_group_name" = 'FlexyA\\Superfast' OR "mt5_group_name" = 'FlexyA\\\\Superfast'
        `);

        if (rowsWithA && rowsWithA.length > 0) {
            console.log(`Found ${rowsWithA.length} row(s) with raw query that need fixing. IDs:`, rowsWithA.map(r => r.id));
            
            const [rawUpdateResult] = await sequelize.query(`
                UPDATE "Mt5Groups" 
                SET "mt5_group_name" = 'Flexy\\Superfast' 
                WHERE "mt5_group_name" = 'FlexyA\\Superfast' OR "mt5_group_name" = 'FlexyA\\\\Superfast'
            `);
            console.log('Raw SQL Update query executed.');
        } else {
            console.log('No rows with incorrect spelling "FlexyA\\Superfast" found via raw SQL check.');
        }

        // 3. Confirm the final state of the groups
        const [allGroups] = await sequelize.query('SELECT id, "mt5_group_name" FROM "Mt5Groups"');
        console.log('\nCurrent MT5 Groups in database:');
        console.log(JSON.stringify(allGroups, null, 2));

    } catch (error) {
        console.error('An error occurred while updating the group name:', error);
    } finally {
        process.exit(0);
    }
}

fixGroup();
