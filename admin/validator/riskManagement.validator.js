const Joi = require("joi");

module.exports.dashboard = (request, response, next) => {
  const rules = Joi.object().keys({
    refresh: Joi.boolean().optional(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response.status(422).json({
      status: false,
      message: error.message,
      data: null,
    });
  }

  next();
};

module.exports.updateLeverage = (request, response, next) => {
  const paramsRules = Joi.object().keys({
    login: Joi.number().integer().min(1).required(),
  });
  const bodyRules = Joi.object().keys({
    leverage: Joi.number().valid(10, 50, 100, 200, 300, 400, 500, 1000).required(),
  });

  const paramsValidation = paramsRules.validate(request.params);
  if (paramsValidation.error) {
    return response.status(422).json({
      status: false,
      message: paramsValidation.error.message,
      data: null,
    });
  }

  const bodyValidation = bodyRules.validate(request.body);
  if (bodyValidation.error) {
    return response.status(422).json({
      status: false,
      message: bodyValidation.error.message,
      data: null,
    });
  }

  next();
};

module.exports.closeAllPositions = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.number().integer().min(1).required(),
  });

  const { error } = rules.validate(request.params);
  if (error) {
    return response.status(422).json({
      status: false,
      message: error.message,
      data: null,
    });
  }

  next();
};
