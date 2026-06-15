const { config, httpsAgent, makeRequest, parseResponse } = require("./auth.js");

module.exports.quotes = async (symbols, id) => {
  try {
    // console.log(`[API] Fetching Quotes`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/tick/last?symbol=${symbols}&trans_id=${id}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Quotes fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Quotes:', e.message);
    return false;
  }
};

module.exports.getGroupByIndex = async (index) => {
  try {
    console.log(`[API] Fetching Group by Index`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/group/next?index=${index}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Group by Index fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Group by Index:', e.message);
    return false;
  }
};

module.exports.symbolList = async () => {
  try {
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/symbol/list`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Symbols:', e.message);
    return false;
  }
};

module.exports.symbolChart = async (symbol, from, to, period = 5) => {
  try {
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/chart/get?symbol=${symbol}&period=${period}&from=${from}&to=${to}&data=dohlc`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Quotes:', e.message);
    return false;
  }
};