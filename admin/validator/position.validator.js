const Joi = require("joi");

module.exports.getSymbolPosition = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.string().required(),
      symbol: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.positionList = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.string().required(),
      page: Joi.number().min(1).required(),
      limit: Joi.number().min(10).required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.getOpenOrderList = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.string().required(),
      groups: Joi.string().optional(),
      tickets: Joi.string().optional(),
      symbols: Joi.string().optional(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.closeTradeByPosition = (request, response, next) => {
  const rules = Joi.object().keys({
      login: Joi.number().required(),
      symbol: Joi.string().optional(),
      volume: Joi.string().optional(),
      typeFill: Joi.number().optional(),
      type: Joi.number().optional(),
      position: Joi.number().required(),
      priceOrder: Joi.number().optional(),
      digits: Joi.number().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
      return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.closeLimitTradeOrder = (request, response, next) => {
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
