const Joi = require('joi');

module.exports.metaDeposit = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.string().required(),
      amount: Joi.number().min(10).required()
  });

  const { error } = rules.validate(request.body);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.sendTrade = (request, response, next) => {
  const rules = Joi.object().keys({
      // action: Joi.string().required(),
      login: Joi.number().required(),
      symbol: Joi.string().required(),
      volume: Joi.string().required(),
      typeFill: Joi.number().required(),
      type: Joi.number().required(),
      // priceOrder: Joi.string().required(),
      // digits: Joi.string().required(),
      priceSl: Joi.number().optional(),
      priceTp: Joi.number().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.closePosition = (request, response, next) => {
  const rules = Joi.object().keys({
      // action: Joi.string().required(),
      login: Joi.number().required(),
      symbol: Joi.string().optional(),
      volume: Joi.string().optional(),
      typeFill: Joi.number().optional(),
      type: Joi.number().optional(),
      priceOrder: Joi.any().optional(),
      digits: Joi.any().optional(),
      position: Joi.number().required()
  });

  const { error } = rules.validate(request.body);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.limitTradeRequest = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.number().required(),
      symbol: Joi.string().required(),
      volume: Joi.string().required(),
      type: Joi.number().required(),
      priceOrder: Joi.number().required(),
      priceSl: Joi.number().optional(),
      priceTp: Joi.number().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.modifyTradeRequest = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.number().required(),
      order: Joi.number().required(),
      symbol: Joi.string().required(),
      volume: Joi.string().required(),
      type: Joi.number().required(),
      priceOrder: Joi.number().required(),
      priceSl: Joi.number().optional(),
      priceTp: Joi.number().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.closeLimitTradeRequest = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.number().required(),
      order: Joi.number().required(),
      symbol: Joi.string().required(),
      type: Joi.number().required(),
  });

  const { error } = rules.validate(request.body);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.checkBalance = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.string().required(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.closedOrderList = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.string().required(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.botList = (request, response, next) => {
  const rules = Joi.object().keys({
      page: Joi.number().integer().optional(),
      sizePerPage: Joi.number().integer().optional(),
      status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
      search: Joi.string().optional(),
      botId: Joi.number().optional(),
  });
  const { error } = rules.validate(request.query);

  if (error) {
      return response
          .status(422)
          .json({ status: false, message: error.message, data: null });
  }
  return next();
};

module.exports.updateWatchList = (request, response, next) => {
    const rules = Joi.object().keys({
        symbol: Joi.string().trim().min(3).required(),
        action: Joi.string().valid("ADD", "REMOVE").required(),
    });
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};
