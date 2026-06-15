const Joi = require('joi');

module.exports.list = (request, response, next) => {
  const rules = Joi.object().keys({
      page: Joi.number().integer().min(1).required(),
      sizePerPage: Joi.number().integer().min(1).required(),
      search: Joi.string().optional(),
      type: Joi.string().valid("REAL", "DEMO").optional()
  });
  const { error } = rules.validate(request.query);

  if (error) {
      return response
          .status(422)
          .json({ status: false, message: error.message, data: null });
  }
  return next();
};

module.exports.mt5AccountById = (request, response, next) => {
  const rules = Joi.object().keys({
      id: Joi.number().integer().min(1).required(),
  });
  const { error } = rules.validate(request.params);

  if (error) {
      return response
          .status(422)
          .json({ status: false, message: error.message, data: null });
  }
  return next();
};

module.exports.addMt5Account = (request, response, next) => {
  const rules = Joi.object().keys({
    groupId: Joi.number().min(1).required(),
    Leverage: Joi.number().integer().min(1).required(),
    PassMain: Joi.string().required(),
    // PassInvestor: Joi.string().required(),
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.demoAddBalance = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.number().required(),
    amount: Joi.number().integer().min(1).required(),
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.updateMt5User = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    Leverage: Joi.number().integer().min(1).optional(),
    groupId: Joi.number().integer().min(1).optional(),
    Email: Joi.string().email().optional().optional(),
    Phone: Joi.string().optional().optional(),
    Country: Joi.string().optional().optional(),
    City: Joi.string().optional().optional(),
    State: Joi.string().optional().optional(),
    ZipCode: Joi.string().optional().optional(),
    Address: Joi.string().optional().optional(),
    defaultSymbol: Joi.string().optional().optional(),
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

module.exports.updateMt5Password = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required(),
    PassMain: Joi.string().optional(),
    PassInvestor: Joi.string().optional(),
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
        flag: Joi.number().valid(0, 1, 2).required()
    });

    const { error } = rules.validate(request.query);
    if (error) {
        return response
        .status(422)
        .json({ status: false, message: error.message, data: null });
    }
    next();
};


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
        groups: Joi.string().required(),
        tickets: Joi.string().required(),
        symbols: Joi.string().required(),
    });

    const { error } = rules.validate(request.query);
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
