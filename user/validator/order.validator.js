const Joi = require('joi');

// Validate getOpenTradeByTicket
module.exports.getOpenTradeByTicket = (request, response, next) => {
  const rules = Joi.object().keys({
    ticket: Joi.string().required().min(1)
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate getOpenOrderTotal
module.exports.getOpenOrderTotal = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1)
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate getOpenOrderPage
module.exports.getOpenOrderPage = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
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

// Validate getMultipleOrders
module.exports.getMultipleOrders = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
    group: Joi.string().optional(),
    ticket: Joi.string().optional(),
    symbol: Joi.string().optional()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate updateOrder
module.exports.updateOrder = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
    order: Joi.string().required().min(1),
    externalId: Joi.string().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate deleteOrder
module.exports.deleteOrder = (request, response, next) => {
  const rules = Joi.object().keys({
    ticket: Joi.string().required().min(1)
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate cancelOpenOrder
module.exports.cancelOpenOrder = (request, response, next) => {
  const rules = Joi.object().keys({
    tickets: Joi.string().required().min(1)
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate getClosedOrder
module.exports.getClosedOrder = (request, response, next) => {
  const rules = Joi.object().keys({
    ticket: Joi.string().required().min(1)
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate closeOrderList
module.exports.closeOrderList = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
    fromDate: Joi.string().required(),
    toDate: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate closeOrderListPagination
module.exports.closeOrderListPagination = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
    fromDate: Joi.string().required(),
    toDate: Joi.string().required(),
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

// Validate multipleClosedOrder
module.exports.multipleClosedOrder = (request, response, next) => {
  const rules = Joi.object().keys({
    logins: Joi.string().required().min(1),
    groups: Joi.string().optional(),
    tickets: Joi.string().optional(),
    fromDate: Joi.string().required(),
    toDate: Joi.string().required(),
    symbol: Joi.string().optional()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate updateClosedOrder
module.exports.updateClosedOrder = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
    order: Joi.string().required().min(1),
    externalId: Joi.string().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate deleteClosedOrder
module.exports.deleteClosedOrder = (request, response, next) => {
  const rules = Joi.object().keys({
    tickets: Joi.string().required().min(1)
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate backupList
module.exports.backupList = (request, response, next) => {
  const rules = Joi.object().keys({
    beginning: Joi.string().required(),
    end: Joi.string().required(),
    identifier: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate ordersFromBackup
module.exports.ordersFromBackup = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
    ticket: Joi.string().optional(),
    beginning: Joi.string().required(),
    end: Joi.string().required(),
    identifier: Joi.string().required()
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate restoreOrderFromArchive
module.exports.restoreOrderFromArchive = (request, response, next) => {
  const rules = Joi.object().keys({
    login: Joi.string().required().min(1),
    order: Joi.string().required().min(1),
    externalId: Joi.string().optional()
  });

  const { error } = rules.validate(request.body);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};

// Validate orderReopen
module.exports.orderReopen = (request, response, next) => {
  const rules = Joi.object().keys({
    ticket: Joi.string().required().min(1)
  });

  const { error } = rules.validate(request.query);
  if (error) {
    return response
      .status(422)
      .json({ status: false, message: error.message, data: null });
  }
  next();
};