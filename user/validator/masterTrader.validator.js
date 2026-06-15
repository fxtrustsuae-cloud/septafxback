const Joi = require('joi');

module.exports.masterTraderList = (request, response, next) => {
  const rules = Joi.object().keys({
    page: Joi.number().integer().min(1).optional(),
    sizePerPage: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().optional(),
    minWinRate: Joi.number().min(0).max(100).optional(),
    maxDrawdown: Joi.number().min(0).max(100).optional(),
    minReturn: Joi.number().optional(),
    sortBy: Joi.string().valid('roi', 'winRate', 'copiers', 'drawdown', 'trending', 'newest').optional(),
    chartTimeframe: Joi.string().valid('30D', '90D', '365D').optional(),
    timeframe: Joi.string().valid('30D', '90D', '365D').optional()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getMasterTraderDetail = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required(),
    chartTimeframe: Joi.string().valid('30D', '90D', '365D').optional(),
    timeframe: Joi.string().valid('30D', '90D', '365D').optional()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getMasterTraderById = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.params);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getMasterTraderCopiers = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required(),
    status: Joi.string().valid('ACTIVE', 'PAUSED', 'STOPPED').optional(),
    page: Joi.number().integer().min(1).optional(),
    sizePerPage: Joi.number().integer().min(1).max(100).optional()
  });

  const payload = { ...request.params, ...request.query };
  const { error } = rules.validate(payload);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.submitMasterTraderReview = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(1000).optional().allow('')
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.deleteMasterTraderReview = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.params);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getMasterTraderReviews = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.params);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.watchMasterTrader = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required(),
    notificationsEnabled: Joi.boolean().default(true)
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.unwatchMasterTrader = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.params);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getMyWatchlist = (request, response, next) => {
  const rules = Joi.object().keys({
    page: Joi.number().integer().min(1).optional(),
    sizePerPage: Joi.number().integer().min(1).max(100).optional()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.toggleWatchlistNotifications = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required(),
    notificationsEnabled: Joi.boolean().required()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.subscribeMasterTrader = (request, response, next) => {
  const rules = Joi.object().keys({
    masterTraderId: Joi.number().integer().min(1).required(),
    mt5Login: Joi.string().required()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.unsubscribeMasterTrader = (request, response, next) => {
  const rules = Joi.object().keys({
    subscriptionId: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getMySubscriptions = (request, response, next) => {
  const rules = Joi.object().keys({
    page: Joi.number().integer().min(1).optional(),
    sizePerPage: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'PAUSED', 'PENDING').optional()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.updateSubscriptionSettings = (request, response, next) => {
  const rules = Joi.object().keys({
    subscriptionId: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.pauseSubscription = (request, response, next) => {
  const rules = Joi.object().keys({
    subscriptionId: Joi.number().integer().min(1).required(),
    reason: Joi.string().max(255).optional().allow('')
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.resumeSubscription = (request, response, next) => {
  const rules = Joi.object().keys({
    subscriptionId: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.updateSubscription = (request, response, next) => {
  const rules = Joi.object().keys({
    subscriptionId: Joi.number().integer().min(1).required(),
    pauseSubscription: Joi.boolean().optional(),
    resumeSubscription: Joi.boolean().optional(),
    unsubscribe: Joi.boolean().optional(),
    reason: Joi.string().max(255).optional().allow('')
  }).or(
    'pauseSubscription',
    'resumeSubscription',
    'unsubscribe'
  );

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getMyMasterTraderProfile = (_request, _response, next) => {
  next();
};

module.exports.updateMyMasterTraderProfile = (request, response, next) => {
  const rules = Joi.object().keys({
    displayName: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(1000).optional().allow(''),
    riskLevel: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').optional(),
    tradingStyle: Joi.string().valid('SCALPING', 'SWING', 'DAY', 'POSITION').optional().allow(null),
    instruments: Joi.array().items(Joi.string().valid('FOREX', 'INDICES', 'COMMODITIES', 'CRYPTO', 'STOCKS')).optional(),
    avgTradeDuration: Joi.string().valid('MINUTES', 'HOURS', 'DAYS', 'WEEKS').optional().allow(null),
    minimumCopyBalance: Joi.number().min(0).optional(),
    maxCopiers: Joi.number().integer().min(1).optional(),
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};
