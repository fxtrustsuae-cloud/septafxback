const Joi = require("joi");

// Validate getDealByTicket
module.exports.getDealByTicket = (request, response, next) => {
  const rules = Joi.object().keys({
    ticket: Joi.string().required(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate getDealsList
module.exports.getDealsList = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.number().required().min(1),
    fromDate: Joi.string().required(),
    toDate: Joi.string().required(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate getDealsPage
module.exports.getDealsPage = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.number().required().min(1),
    fromDate: Joi.string().required(),
    toDate: Joi.string().required(),
    page: Joi.number().integer().min(1).required(),
    limit: Joi.number().integer().min(10).required(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate getDealBatch
module.exports.getDealBatch = (request, response, next) => {
  const rules = Joi.object().keys({
    logins: Joi.number().required().min(1),
    groups: Joi.string().optional(),
    tickets: Joi.string().optional(),
    fromDate: Joi.string().required(),
    toDate: Joi.string().required(),
    symbol: Joi.string().optional(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate updateDeal
module.exports.updateDeal = (request, response, next) => {
  const rules = Joi.object().keys({
    deal: Joi.string().required().min(1),
    data: Joi.object().required(),
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate deleteDeal
module.exports.deleteDeal = (request, response, next) => {
  const rules = Joi.object().keys({
    tickets: Joi.string().required().min(1),
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};
