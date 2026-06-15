const cron = require('node-cron');
const monetizationService = require('../monetization/monetization.service');
const analyticsService = require('../analytics/analytics.service');
const { pool } = require('../database/index');

function setupCronJobs() {
    // 1. Monthly Fee Settlement: Runs at 00:00 on the 1st of every month
    cron.schedule('0 0 1 * *', async () => {
        console.log("[CRON] Running Monthly Performance Fee Settlement...");
        try {
            // Find all active copiers and masters, and their current equity...
            const subscriptions = await pool.query(`SELECT copier_id, master_id FROM high_water_marks`); // simplistic abstraction
            for (let sub of subscriptions.rows) {
                // Fetch current equity dynamically from MT5 or Tracking table
                const currentEquity = 10000; // Stub
                await monetizationService.calculatePerformanceFee(sub.copier_id, sub.master_id, currentEquity);
            }
            console.log("[CRON] Fees successfully processed.");
        } catch (error) {
            console.error("[CRON] Fee settlement failed", error);
        }
    });

    // 2. Daily Analytics & Leaderboards: Runs at 00:00 every day
    cron.schedule('0 0 * * *', async () => {
        console.log("[CRON] Generating Daily Risk Metrics and Leaderboards...");
        await analyticsService.updateLeaderboards();
    });

    console.log("Social Trading Extension CRON jobs registered successfully.");
}

module.exports = { setupCronJobs };
