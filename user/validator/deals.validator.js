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
    offset: Joi.number().integer().min(0).required(),
    total: Joi.number().integer().min(1).required(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};
