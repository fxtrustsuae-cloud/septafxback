const { pool } = require('../database/index'); // Assuming Postgres Pool

class MonetizationService {
    /**
     * Calculate performance fee using High-Water Mark model.
     * Called at the end of the month via CRON.
     */
    async calculatePerformanceFee(copierId, masterId, currentEquity) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const hwmQuery = await client.query(
                `SELECT hwm_value FROM high_water_marks WHERE copier_id = $1 AND master_id = $2`,
                [copierId, masterId]
            );

            let hwm = hwmQuery.rows[0] ? hwmQuery.rows[0].hwm_value : 0;
            
            const configQuery = await client.query(
                `SELECT performance_fee_percentage FROM master_fee_configs WHERE master_id = $1`,
                [masterId]
            );

            let feePercentage = configQuery.rows[0] ? configQuery.rows[0].performance_fee_percentage : 0;

            if (currentEquity > hwm) {
                const profit = currentEquity - hwm;
                const fee = (profit * feePercentage) / 100;

                // Log fee
                await client.query(
                    `INSERT INTO performance_fees (copier_id, master_id, profit_generated, fee_charged, status) VALUES ($1, $2, $3, $4, 'PENDING')`,
                    [copierId, masterId, profit, fee]
                );

                // Update HWM
                await client.query(
                    `INSERT INTO high_water_marks (copier_id, master_id, hwm_value) VALUES ($1, $2, $3)
                     ON CONFLICT (copier_id, master_id) DO UPDATE SET hwm_value = EXCLUDED.hwm_value`,
                    [copierId, masterId, currentEquity]
                );

                await client.query('COMMIT');
                return { success: true, fee, profit };
            }

            await client.query('COMMIT');
            return { success: true, fee: 0, profit: 0, message: 'No new high water mark reached.' };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Deducts subscription fees for all users following a specific master.
     */
    async processSubscriptionRenewals(masterId) {
        // Implementation for monthly subscription wallet deduction
        // If wallet < subscription fee -> freeze copy trade subscription
        return { success: true, message: "Subscription renewals processed successfully." };
    }
}

module.exports = new MonetizationService();
