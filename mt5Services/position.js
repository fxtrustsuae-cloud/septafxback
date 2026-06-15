const { config, httpsAgent, makeRequest, parseResponse } = require("./auth.js");
const configuration = require("../config/config.js");

function appendQueryParam(params, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
}

module.exports.getPositionBySymbol = async (login, symbolName) => {
  try {
    console.log(`[API] Fetching open position by login ${login} and symbol ${symbolName}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/position/get?login=${login}&symbol=${symbolName}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Open position fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching open position:', e.message);
    return false;
  }
};

module.exports.positionList = async (login) => {
  try {
    console.log(`[API] Fetching position list for login ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/position/get_batch?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Position list fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching position list:', e.message);
    return false;
  }
};

module.exports.getPositionByTicket = async (login, ticket) => {
  try {
    console.log(`[API] Fetching open position by login ${login} and ticket ${ticket}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/position/get_batch?login=${encodeURIComponent(login)}&ticket=${encodeURIComponent(ticket)}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Open position by ticket fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching open position by ticket:', e.message);
    return false;
  }
};

module.exports. getPositionList = async (login, index, number) => {
  try {
    // console.log(login, index, number)
    // console.log(`[API] Fetching position list with pagination for login ${login}, offset ${index}, total ${number}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/position/get_page?login=${login}&offset=${index}&total=${number}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Position list pagination fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching position list pagination:', e.message);
    return false;
  }
};

module.exports.openOrderList = async (logins, groups, tickets, symbols) => {
  try {
    console.log(`[API] Fetching multiple open orders for logins ${logins}`);
    const params = new URLSearchParams();
    appendQueryParam(params, "login", logins);
    appendQueryParam(params, "group", groups);
    appendQueryParam(params, "ticket", tickets);
    appendQueryParam(params, "symbol", symbols);

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/get_batch?${params.toString()}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Multiple open orders fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching multiple open orders:', e.message);
    return false;
  }
};

module.exports.getMultiplePositions = async (logins, groups, tickets, symbols) => {
  try {
    console.log(`[API] Fetching multiple positions for logins ${logins}`);
    const params = new URLSearchParams();
    appendQueryParam(params, "login", logins);
    appendQueryParam(params, "group", groups);
    appendQueryParam(params, "ticket", tickets);
    appendQueryParam(params, "symbol", symbols);

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/position/get_batch?${params.toString()}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Multiple positions fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching multiple positions:', e.message);
    return false;
  }
};

module.exports.updatePosition = async (data) => {
  try {
    const payload = data;
    console.log(payload)
    // return
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/position/update`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
      },
      timeout: 30000
    };

    const response = await makeRequest(options, JSON.stringify(payload));
    const result = await parseResponse(response);
    console.log('[API] Position updated successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error while updating position:', e.message);
    throw e;
  }
};

module.exports.deletePosition = async (ticketArray) => {
    try {
      console.log(`[API] Dleting Positions ${ticketArray}`);
      const payload = ticketArray;
  
      const options = {
        hostname: config.server,
        port: config.port,
        path: `/api/position/delete`,
        method: 'POST',
        agent: httpsAgent,
        headers: {
          "Connection": "keep-alive",
          "Content-Type": "application/json",
        },
        timeout: 30000
      };
  
      const response = await makeRequest(options, JSON.stringify(payload));
      const result = await parseResponse(response);
      console.log('[API] Position deleted successfully:', result);
      return result;
    } catch (e) {
      console.error('[API] Error Deleting position:', e.message);
      throw e;
    }
};

module.exports.positions = async (login) => {
  try {
    // console.log(`[API] Fetching positions for logins ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/position/check?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] positions fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching positions:', e.message);
    return false;
  }
};
