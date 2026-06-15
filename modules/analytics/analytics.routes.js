const express = require('express');
const router = express.Router();
const analyticsService = require('./analytics.service');

router.get('/simulate/:masterId', async (req, res) => {
    try {
        const { masterId } = req.params;
        const { capital } = req.query;
        
        const simulation = await analyticsService.simulateEquityCurve(masterId, parseFloat(capital));
        res.status(200).json(simulation);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/metrics/:masterId', async (req, res) => {
    try {
        const { masterId } = req.params;
        const metrics = await analyticsService.calculateStrategyMetrics(masterId);
        res.status(200).json({ success: true, metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
