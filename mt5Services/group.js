const { config, httpsAgent, makeRequest, parseResponse } = require("./auth.js");
const configuration = require("../config/config.js");

module.exports.getTotalGroup = async () => {
  try {
    console.log(`[API] Fetching Total Group`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/group/total`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Total Group fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Total Group:', e.message);
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

module.exports.getGroupByName = async (groupName) => {
  try {
    console.log(`[API] Fetching Group by Name`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/group/get?group=${groupName}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Group by Name fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Group by Name:', e.message);
    return false;
  }
};

module.exports.getGroupByMask = async () => {
  try {
    console.log(`[API] Fetching Group by Name`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/symbol/get?mask=*`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Group by Mask fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Group by Mask:', e.message);
    return false;
  }
};

module.exports.getGroupByName = async (name) => {
  try {
    console.log(`[API] Fetching Group by Name`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/group/get?group=${name}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Group by Mask fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching Group by Mask:', e.message);
    return false;
  }
};

