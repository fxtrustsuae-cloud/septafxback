const express = require('express');
const router = express.Router();
const riskService = require('./risk.service');
const { pool } = require('../database/index');

router.post('/evaluate-trade', async (req, res) => {
    try {
        const { copierId, masterId, symbol, lotSize } = req.body;
        const result = await riskService.evaluateTrade(copierId, masterId, symbol, lotSize);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/configure', async (req, res) => {
    try {
        const { copierId, masterId, maxDrawdown, minEquity, maxLotSize, allowedSymbols } = req.body;
        
        await pool.query(
            `INSERT INTO risk_configs (copier_id, master_id, max_drawdown_percentage, min_equity_threshold, max_lot_size, allowed_symbols)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (copier_id, master_id) DO UPDATE SET 
             max_drawdown_percentage = EXCLUDED.max_drawdown_percentage,
             min_equity_threshold = EXCLUDED.min_equity_threshold,
             max_lot_size = EXCLUDED.max_lot_size,
             allowed_symbols = EXCLUDED.allowed_symbols,
             is_active = true`,
            [copierId, masterId, maxDrawdown, minEquity, maxLotSize, allowedSymbols]
        );

        res.status(200).json({ success: true, message: 'Risk configuration updated.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
