const express = require('express');
const router = express.Router();
const monetizationService = require('./monetization.service');

router.post('/settle-performance-fee', async (req, res) => {
    try {
        const { copierId, masterId, currentEquity } = req.body;
        const result = await monetizationService.calculatePerformanceFee(copierId, masterId, currentEquity);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/renew-subscriptions', async (req, res) => {
    try {
        const { masterId } = req.body;
        const result = await monetizationService.processSubscriptionRenewals(masterId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
