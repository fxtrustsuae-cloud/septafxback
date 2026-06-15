const sequelize = require('./config/db.config');
const Mt5GroupModel = require('./models/mt5Group.model');

async function fixDemoGroup() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // 1. Update the Mt5GroupName from 'demo\STD' or 'demo\\STD' to 'Flexy\DEMO'
        console.log('Attempting to update demo group name in Mt5Groups table...');
        
        const [updatedRows] = await Mt5GroupModel.update(
            { mt5GroupName: 'Flexy\\DEMO' },
            { 
                where: { 
                    mt5GroupName: ['demo\\STD', 'demo\\\\STD', 'demo\\std', 'demo\\\\std']
                },
                silent: true
            }
        );

        console.log(`Sequelize Model Update result: Updated ${updatedRows} row(s).`);

        // 2. Fallback / Raw SQL check & update to be absolutely certain
        console.log('Running raw SQL validation and fallback...');
        const [rowsToFix] = await sequelize.query(`
            SELECT id, "mt5_group_name" FROM "Mt5Groups" 
            WHERE "mt5_group_name" IN ('demo\\STD', 'demo\\\\STD', 'demo\\std', 'demo\\\\std')
        `);

        if (rowsToFix && rowsToFix.length > 0) {
            console.log(`Found ${rowsToFix.length} row(s) with raw query that need fixing. IDs:`, rowsToFix.map(r => r.id));
            
            await sequelize.query(`
                UPDATE "Mt5Groups" 
                SET "mt5_group_name" = 'Flexy\\DEMO' 
                WHERE "mt5_group_name" IN ('demo\\STD', 'demo\\\\STD', 'demo\\std', 'demo\\\\std')
            `);
            console.log('Raw SQL Update query executed.');
        } else {
            console.log('No rows with incorrect spelling "demo\\STD" found via raw SQL check.');
        }

        // 3. Confirm the final state of active CRM Groups and their MT5 Mappings
        const [groups] = await sequelize.query(`
            SELECT g.id, g.name, g.type, g.leverage, g.status, m.id as "mt5GroupId", m.mt5_group_name 
            FROM "Groups" g 
            LEFT JOIN "Mt5Groups" m ON g.mt5_group = m.id
            WHERE g.is_deleted = false
        `);
        console.log('\n--- Active CRM Groups and their MT5 Mappings ---');
        console.log(JSON.stringify(groups, null, 2));

    } catch (error) {
        console.error('An error occurred while updating the group name:', error);
    } finally {
        process.exit(0);
    }
}

fixDemoGroup();
