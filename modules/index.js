const express = require('express');
const router = express.Router();

const monetizationRoutes = require('./monetization/monetization.routes');
const riskRoutes = require('./risk-engine/risk.routes');
const socialRoutes = require('./social/social.routes');
const analyticsRoutes = require('./analytics/analytics.routes');

// Versioned Modular Router
router.use('/monetization', monetizationRoutes);
router.use('/risk', riskRoutes);
router.use('/social', socialRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
