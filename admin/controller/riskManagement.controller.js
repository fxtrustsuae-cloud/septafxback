const riskManagementService = require("../../modules/risk-management/riskManagement.service");
const { handleErrorResponse } = require("../../middleware/CustomErrorHandler");
const { adminLogger } = require("../../utils/logger");

module.exports.dashboard = async (request, response) => {
  try {
    const forceRefresh = request.query.refresh === "true";
    adminLogger.info("Risk management dashboard request received", {
      method: request.method || "",
      route: request.originalUrl || "",
      forceRefresh,
    });
    const snapshot = await riskManagementService.ensureFresh(forceRefresh);

    adminLogger.info("Risk management dashboard snapshot served", {
      method: request.method || "",
      route: request.originalUrl || "",
      trackedAccounts: snapshot?.metrics?.trackedAccounts || 0,
      openPositions: snapshot?.metrics?.openPositions || 0,
      recentTrades: snapshot?.metrics?.recentTrades || 0,
      exposuresCount: snapshot?.exposures?.length || 0,
      alertsCount: snapshot?.alerts?.length || 0,
      lastError: snapshot?.lastError || null,
    });

    return response.json({
      status: true,
      message: "Risk management dashboard.",
      data: snapshot,
    });
  } catch (error) {
    handleErrorResponse(error, response);
  }
};

module.exports.profitRiskReport = async (request, response) => {
  try {
    const forceRefresh = request.query.refresh === "true";
    adminLogger.info("Risk management profit-risk report request received", {
      method: request.method || "",
      route: request.originalUrl || "",
      forceRefresh,
    });
    const snapshot = await riskManagementService.ensureFresh(forceRefresh);

    return response.json({
      status: true,
      message: "Profit risk report.",
      data: snapshot.profitRiskReport,
    });
  } catch (error) {
    handleErrorResponse(error, response);
  }
};

module.exports.scalpingReport = async (request, response) => {
  try {
    const forceRefresh = request.query.refresh === "true";
    adminLogger.info("Risk management scalping report request received", {
      method: request.method || "",
      route: request.originalUrl || "",
      forceRefresh,
    });
    const snapshot = await riskManagementService.ensureFresh(forceRefresh);

    return response.json({
      status: true,
      message: "Scalping report.",
      data: snapshot.scalpingReport,
    });
  } catch (error) {
    handleErrorResponse(error, response);
  }
};

module.exports.updateLeverage = async (request, response) => {
  try {
    const { login } = request.params;
    const { leverage } = request.body;
    adminLogger.info("Risk management leverage update request received", {
      method: request.method || "",
      route: request.originalUrl || "",
      login,
      leverage,
    });

    const result = await riskManagementService.updateLeverage(login, leverage);

    return response.json({
      status: true,
      message: result.message,
      data: null,
    });
  } catch (error) {
    handleErrorResponse(error, response);
  }
};

module.exports.closeAllPositions = async (request, response) => {
  try {
    const { login } = request.params;
    adminLogger.info("Risk management close-all request received", {
      method: request.method || "",
      route: request.originalUrl || "",
      login,
    });
    const result = await riskManagementService.closeAllPositions(login);

    return response.json(result);
  } catch (error) {
    handleErrorResponse(error, response);
  }
};
