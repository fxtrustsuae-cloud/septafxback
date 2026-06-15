const Joi = require('joi');

module.exports.validateGetOpenTradeByTicket = (request, response, next) => {
  const rules = Joi.object().keys({
    ticket: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.validateGetOpenOrderTotal = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.validateGetOpenOrderPage = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    offset: Joi.number().integer().min(0).required(),
    total: Joi.number().integer().min(1).required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.validateGetMultipleOrders = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    group: Joi.string().allow('').optional(),
    ticket: Joi.string().allow('').optional(),
    symbol: Joi.string().allow('').optional()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};