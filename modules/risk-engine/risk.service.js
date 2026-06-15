const { pool } = require('../database/index');

class RiskEngineService {
    /**
     * Intercepts a trade and decides if it should be placed
     */
    async evaluateTrade(copierId, masterId, symbol, lotSize) {
        const configQuery = await pool.query(
            `SELECT max_lot_size, allowed_symbols FROM risk_configs WHERE copier_id = $1 AND master_id = $2 AND is_active = true`,
            [copierId, masterId]
        );

        if (!configQuery.rows.length) return { allowed: true }; // No active restriction

        const { max_lot_size, allowed_symbols } = configQuery.rows[0];

        // Asset filtering
        if (allowed_symbols && allowed_symbols.length > 0 && !allowed_symbols.includes(symbol)) {
            return { allowed: false, reason: `Symbol ${symbol} is not allowed.` };
        }

        // Volume cap enforcement
        if (max_lot_size && lotSize > max_lot_size) {
            return { allowed: false, reason: `Lot size ${lotSize} exceeds max allowed ${max_lot_size}.` };
        }

        return { allowed: true };
    }

    /**
     * Monitors equity continuously. Suspends if threshold dropped.
     */
    async checkEquityGuard(copierId, masterId, currentEquity) {
        const configQuery = await pool.query(
            `SELECT min_equity_threshold FROM risk_configs WHERE copier_id = $1 AND master_id = $2 AND is_active = true`,
            [copierId, masterId]
        );

        if (configQuery.rows.length && currentEquity <= configQuery.rows[0].min_equity_threshold) {
            // Take action: close trades + Pause subscription
            return { triggered: true, action: 'CLOSE_TRADES_AND_PAUSE' };
        }

        return { triggered: false };
    }
}

module.exports = new RiskEngineService();
