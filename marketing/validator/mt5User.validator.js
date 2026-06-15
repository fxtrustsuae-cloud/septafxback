const Joi = require('joi');

module.exports.importMt5toUser = (request, response, next) => {
  const rules = Joi.object().keys({
    userId: Joi.number().required(),
    groupId: Joi.number().required(),
    login: Joi.string().required(),
    PassMain: Joi.string().required(),
    PassInvestor: Joi.string().required(),
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.addUser = (request, response, next) => {
  const rules = Joi.object().keys({
    userId: Joi.number().required(),
    login: Joi.string().required(),
    group: Joi.string().required(),
    name: Joi.string().required(),
    Leverage: Joi.number().integer().min(1).required(),
    PassMain: Joi.string().required(),
    PassInvestor: Joi.string().required(),
    Email: Joi.string().email().optional(),
    Phone: Joi.string().optional(),
    Country: Joi.string().optional(),
    City: Joi.string().optional(),
    State: Joi.string().optional(),
    ZipCode: Joi.string().optional(),
    Address: Joi.string().optional(),
    PhonePassword: Joi.string().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.updateUser = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    group: Joi.string().optional(),
    name: Joi.string().optional(),
    Leverage: Joi.number().integer().min(1).optional(),
    PassMain: Joi.string().optional(),
    PassInvestor: Joi.string().optional(),
    Email: Joi.string().email().optional().optional(),
    Phone: Joi.string().optional().optional(),
    Country: Joi.string().optional().optional(),
    City: Joi.string().optional().optional(),
    State: Joi.string().optional().optional(),
    ZipCode: Joi.string().optional().optional(),
    Address: Joi.string().optional().optional(),
    PhonePassword: Joi.string().optional().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.deleteUser = (request, response, next) => {
    const rules = Joi.object().keys({
        login: Joi.string().required().min(1),
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.getUser = (request, response, next) => {
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

module.exports.validateMultipleUser = (request, response, next) => {
  const rules = Joi.object().keys({
    group: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.changePassword = (request, response, next) => {
    const rules = Joi.object().keys({
        login: Joi.string().required(),
        type: Joi.string().valid('main', 'investor').required(),
        newPassword: Joi.string().min(6).required()
    });

    const { error } = rules.validate(request.body);
    if (error) {
        return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.tradeStatus = (request, response, next) => {
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

module.exports.validateGetMultipleTrade = (request, response, next) => {
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

module.exports.validateGetUserList = (request, response, next) => {
  const rules = Joi.object().keys({
    group: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.validateGetTotalUser = (request, response, next) => {
  const rules = Joi.object().keys({});

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.validateGetGroupByLogin = (request, response, next) => {
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

module.exports.validateGetUserCertificate = (request, response, next) => {
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

module.exports.validateDeleteUserCertificate = (request, response, next) => {
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

module.exports.validateConfirmUserCertificate = (request, response, next) => {
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

module.exports.validateGetOtpSecret = (request, response, next) => {
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

module.exports.validateSetOtpSecret = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    otp_secret: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
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
        flag: Joi.number().valid(0, 1).required()
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};

module.exports.metaDeposit = (request, response, next) => {
    const rules = Joi.object().keys({
        login: Joi.string().required(),
        // type: Joi.number().valid(2, 3, 4, 5, 6).required(),
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

module.exports.validateMoveUserToArchive = (request, response, next) => {
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

module.exports.validateGetUserFromArchive = (request, response, next) => {
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

module.exports.validateGetUserListFromArchive = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    group: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.validateSendPushNotification = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    text: Joi.string().min(1).required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};
