const sequelize = require('./config/db.config');

async function syncAllSequences() {
    try {
        const query = `
            DO $$ 
            DECLARE 
                r RECORD;
            BEGIN 
                FOR r IN 
                    SELECT table_name, column_name 
                    FROM information_schema.columns 
                    WHERE column_default LIKE 'nextval%' 
                    AND table_schema = 'public'
                LOOP 
                    EXECUTE 'SELECT setval(pg_get_serial_sequence(' || quote_literal(r.table_name) || ', ' || quote_literal(r.column_name) || '), COALESCE((SELECT MAX(' || quote_ident(r.column_name) || ') FROM ' || quote_ident(r.table_name) || '), 1), true)';
                END LOOP; 
            END $$;
        `;
        await sequelize.query(query);
        console.log('All sequences synchronized successfully.');
    } catch (err) {
        console.error('Error syncing sequences:', err);
    } finally {
        process.exit(0);
    }
}

syncAllSequences();
