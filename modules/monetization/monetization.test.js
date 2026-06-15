const assert = require('assert');

// 1. Mock the DB Pool and Client
let executedQueries = [];

const mockClient = {
    query: async (queryText, params) => {
        executedQueries.push({ queryText, params });
        
        // Mock HWM logic response
        if (queryText.includes('SELECT hwm_value')) {
            return { rows: [{ hwm_value: 1000 }] }; // Mock Previous HWM = $1000
        }
        // Mock Config logic response
        if (queryText.includes('SELECT performance_fee_percentage')) {
            return { rows: [{ performance_fee_percentage: 20 }] }; // Mock 20% Fee Schedule
        }
        return { rows: [] };
    },
    release: () => {}
};

const mockPool = {
    connect: async () => mockClient,
    query: async () => ({ rows: [] })
};

// 2. Inject DB Mock via Node require Cache
const dbPath = require.resolve('../database/index');
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { pool: mockPool }
};

// 3. Load the Target Module
const monetizationService = require('./monetization.service');

// 4. Test Suite Execution
async function runTests() {
    console.log('\n--- 🏃 Running Monetization & High-Water Mark (HWM) Unit Tests ---\n');
    try {
        // ---- TEST 1: Profitable Scenario (Equity > HWM) ----
        executedQueries = []; // Reset capture
        const result1 = await monetizationService.calculatePerformanceFee(1, 2, 1500); 
        // Logic: Started with 1000 HWM. Now Equity is 1500. Profit = 500. Fee = 20% of 500 = 100.

        assert.strictEqual(result1.success, true);
        assert.strictEqual(result1.profit, 500, 'Profit calculation incorrect'); 
        assert.strictEqual(result1.fee, 100, 'Fee calculation incorrect'); 
        
        // Validate DB queries executed
        const insertFeeQuery = executedQueries.find(q => q.queryText.includes('INSERT INTO performance_fees'));
        assert.ok(insertFeeQuery, 'Fee insert should be called in database');
        assert.deepStrictEqual(insertFeeQuery.params.slice(0, 4), [1, 2, 500, 100], "DB payload parameters mismatch");
        console.log('✅ TEST 1 PASSED: Charging 20% performance fee correctly on new profits.');


        // ---- TEST 2: Losing/Drawdown Scenario (Equity < HWM) ----
        executedQueries = []; 
        const result2 = await monetizationService.calculatePerformanceFee(1, 2, 800);
        // Logic: Started with 1000 HWM. Equity is 800. No fee should be charged.
        
        assert.strictEqual(result2.success, true);
        assert.strictEqual(result2.fee, 0); 
        assert.strictEqual(result2.profit, 0); 
        assert.strictEqual(result2.message, 'No new high water mark reached.');
        
        const feeInsertAttempt = executedQueries.find(q => q.queryText.includes('INSERT INTO performance_fees'));
        assert.strictEqual(feeInsertAttempt, undefined, "System attempted to insert fee when it shouldn't!");
        console.log('✅ TEST 2 PASSED: HWM correctly blocked fees from being charged on drawdown equity.');

        console.log('\n🎉 All Monetization Engine tests passed successfully!');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

runTests();
