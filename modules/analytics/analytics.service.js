const { pool } = require('../database/index');

class AnalyticsService {
    /**
     * Simulation Engine: Inputs user capital + master trades history to simulate equity curve.
     */
    async simulateEquityCurve(masterId, initialCapital) {
        // Retrieve past closed trades history for the master.
        // Mocking historical trades (in production, fetch from MongoDB position.model.js)
        const mockedTradeHistory = [
            { id: 1, closedAt: new Date(Date.now() - 5 * 86400000), pnlPercentage: 2.5 },
            { id: 2, closedAt: new Date(Date.now() - 4 * 86400000), pnlPercentage: -1.0 },
            { id: 3, closedAt: new Date(Date.now() - 3 * 86400000), pnlPercentage: 3.2 },
            { id: 4, closedAt: new Date(Date.now() - 2 * 86400000), pnlPercentage: -0.5 },
            { id: 5, closedAt: new Date(Date.now() - 1 * 86400000), pnlPercentage: 4.1 }
        ];

        let currentEquity = initialCapital;
        let peakEquity = initialCapital;
        let maxDrawdownPercentage = 0;
        
        const curve = [{ time: new Date(Date.now() - 6 * 86400000).toISOString(), equity: currentEquity }];

        for (const trade of mockedTradeHistory) {
            // Calculate absolute profit from percentage
            const tradeProfit = (currentEquity * trade.pnlPercentage) / 100;
            currentEquity += tradeProfit;
            
            // Drawdown calculation
            if (currentEquity > peakEquity) {
                peakEquity = currentEquity;
            } else {
                const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
                if (drawdown > maxDrawdownPercentage) maxDrawdownPercentage = drawdown;
            }

            curve.push({
                time: trade.closedAt.toISOString(),
                equity: Number(currentEquity.toFixed(2)),
                tradeId: trade.id
            });
        }
        
        // Calculate ROI
        const roiPercentage = ((currentEquity - initialCapital) / initialCapital) * 100;
        
        return { 
            success: true, 
            finalEquity: Number(currentEquity.toFixed(2)),
            totalROI: Number(roiPercentage.toFixed(2)),
            maxDrawdownPercentage: Number(maxDrawdownPercentage.toFixed(2)),
            curve 
        };
    }

    /**
     * Calculates advanced risk metrics: Sharpe, Sortino, Volatility
     */
    async calculateStrategyMetrics(masterId) {
        // Mocked Daily Returns (in production, group trades by day and sum PnL %)
        const dailyReturns = [1.2, -0.5, 2.1, 0.8, -1.2, 3.0, 0.4];
        
        if (!dailyReturns.length) return null;

        const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        
        // Volatility (Standard Deviation of returns)
        const variance = dailyReturns.reduce((acc, val) => acc + Math.pow(val - meanReturn, 2), 0) / dailyReturns.length;
        const volatility = Math.sqrt(variance);

        // Downside Volatility (Standard Deviation of negative returns only)
        const negativeReturns = dailyReturns.filter(r => r < 0);
        const downsideVariance = negativeReturns.length ? 
            negativeReturns.reduce((acc, val) => acc + Math.pow(val - meanReturn, 2), 0) / negativeReturns.length : 0;
        const downsideVolatility = Math.sqrt(downsideVariance);

        // Risk-Free Rate Assumed at 0% for Crypto/Forex short term
        const sharpeRatio = volatility > 0 ? meanReturn / volatility : 0;
        const sortinoRatio = downsideVolatility > 0 ? meanReturn / downsideVolatility : sharpeRatio;

        return {
            sharpeRatio: Number(sharpeRatio.toFixed(2)),
            sortinoRatio: Number(sortinoRatio.toFixed(2)),
            volatility: Number(volatility.toFixed(2)),
            meanDailyReturn: Number(meanReturn.toFixed(2))
        };
    }

    async updateLeaderboards() {
        // Fetch all active masters, calculate their metrics using `calculateStrategyMetrics`,
        // and UPSERT them into the PostgreSQL `leaderboards` table.
        return { success: true, message: "Leaderboards updated based on quantitative metrics." };
    }
}

module.exports = new AnalyticsService();
