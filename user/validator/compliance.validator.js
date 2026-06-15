const Joi = require("joi");

module.exports.addBank = (request, response, next) => {
  const rules = Joi.object().keys({
    holderName: Joi.string().required(),
    accountNo: Joi.string().required(),
    ifscCode: Joi.string().optional(),
    ibanNo: Joi.string().optional(),
    bankName: Joi.string().required(),
    bankAddress: Joi.string().optional(),
    country: Joi.string().optional(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.updateBank = (request, response, next) => {
  const rules = Joi.object().keys({
    bankId: Joi.number().integer().required(),
    isDeleted: Joi.boolean().optional(),
    holderName: Joi.string().optional(),
    accountNo: Joi.string().optional(),
    ifscCode: Joi.string().optional(),
    ibanNo: Joi.string().optional(),
    bankName: Joi.string().optional(),
    bankAddress: Joi.string().optional(),
    country: Joi.string().optional(),
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};