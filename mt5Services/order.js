const configuration = require("../config/config.js");
const { config, httpsAgent, makeRequest, parseResponse } = require("./auth.js");

// Getting an Open Order by Ticket
module.exports.getOpenTradeByTicket = async (ticket) => {
  try {
    console.log(`[API] Fetching open order by ticket ${ticket}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/get?ticket=${ticket}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Open order fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching open order:', e.message);
    return false;
  }
};

// Getting the Number of Open Orders
module.exports.getOpenOrderTotal = async (login) => {
  try {
    console.log(`[API] Fetching total open orders for login ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/get_total?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Total open orders fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching total open orders:', e.message);
    return false;
  }
};

// Getting Open Orders Page by Page
module.exports.getOpenOrderPage = async (login, offset, total) => {
  try {
    console.log(`[API] Fetching open orders by pagination for login ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/get_page?login=${login}&offset=${offset}&total=${total}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Open orders pagination fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching open orders pagination:', e.message);
    return false;
  }
};

// Get Multiple Open Orders
module.exports.getMultipleOrders = async (login, group, ticket, symbol) => {
  try {
    console.log(`[API] Fetching multiple open orders for login ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/get_batch?login=${login}&group=${group}&ticket=${ticket}&symbol=${symbol}`,
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

// Update an Open Order
module.exports.updateOrder = async (login, order, externalId) => {
  try {
    const payload = {
      Order: order,
      ExternalID: externalId,
      Login: parseInt(login),
    };

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/update`,
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
    console.log('[API] Open order updated successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error updating open order:', e.message);
    throw e;
  }
};

// Delete an Open Order
module.exports.deleteOrder = async (ticket) => {
  try {
    console.log(`[API] Deleting open order by ticket ${ticket}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/delete?ticket=${ticket}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Open order deleted successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error deleting open order:', e.message);
    return false;
  }
};

// Cancel an Open Order
module.exports.cancelOpenOrder = async (tickets) => {
  try {
    console.log(`[API] Canceling open order by ticket ${tickets}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/cancel?ticket=${tickets}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Open order canceled successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error canceling open order:', e.message);
    return false;
  }
};

// Getting a Closed Order by Ticket
module.exports.getClosedOrder = async (ticket) => {
  try {
    console.log(`[API] Fetching closed order by ticket ${ticket}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/history/get?ticket=${ticket}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Closed order fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching closed order:', e.message);
    return false;
  }
};

// Getting the Number of Closed Orders
module.exports.closeOrderList = async (login, fromDate, toDate) => {
  try {
    console.log(`[API] Fetching total closed orders for login ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/history/get_total?login=${login}&from=${fromDate}&to=${toDate}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Total closed orders fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching total closed orders:', e.message);
    return false;
  }
};

// Getting Closed Orders Page by Page
module.exports.closeOrderListPagination = async (login, fromDate, toDate, offset, total) => {
  try {
    console.log(`[API] Fetching closed orders by pagination for login ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/history/get_page?login=${login}&from=${fromDate}&to=${toDate}&offset=${offset}&total=${total}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Closed orders pagination fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching closed orders pagination:', e.message);
    return false;
  }
};

// Get Multiple Closed Orders
module.exports.multipleClosedOrder = async (logins, groups, tickets, fromDate, toDate, symbol) => {
  try {
    console.log(`[API] Fetching multiple closed orders for logins ${logins}`);
    const path = `/api/history/get_batch?login=${logins}&group=${groups}&ticket=${tickets}&from=${fromDate}&to=${toDate}&symbol=${symbol}`;
    const options = {
      hostname: config.server,
      port: config.port,
      path,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Multiple closed orders fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching multiple closed orders:', e.message);
    return false;
  }
};

// Update a Closed Order
module.exports.updateClosedOrder = async (login, order, externalId) => {
  try {
    const payload = {
      Order: order,
      ExternalID: externalId,
      Login: parseInt(login),
    };

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/history/update`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
      },
      timeout: 30000
    };

    const response = await makeRequest(options, JSON.stringify(payload));
    console.log('[API] Closed order updated successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error updating closed order:', e.message);
    throw e;
  }
};

// Delete a Closed Order
module.exports.deleteClosedOrder = async (tickets) => {
  try {
    console.log(`[API] Deleting closed orders by tickets ${tickets}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/history/delete?ticket=${tickets}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Closed orders deleted successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error deleting closed orders:', e.message);
    return false;
  }
};

// Get the List of Backups
module.exports.backupList = async (beginning, end, identifier) => {
  try {
    console.log(`[API] Fetching list of order backups from ${beginning} to ${end}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/backup/list?from=${beginning}&to=${end}&server=${identifier}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Order backups list fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching order backups list:', e.message);
    return false;
  }
};

// Get Orders from Backup
module.exports.ordersFromBackup = async (login, ticket, beginning, end, identifier) => {
  try {
    console.log(`[API] Fetching orders from backup for login ${login}`);
    const path = `/api/order/backup/get?backup={date}&login=${login}&ticket=${ticket}&from=${beginning}&to=${end}&server=${identifier}`;
    const options = {
      hostname: config.server,
      port: config.port,
      path,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Orders from backup fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching orders from backup:', e.message);
    return false;
  }
};

// Restore Order from Archive
module.exports.restoreOrderFromArchive = async (login, order, externalId) => {
  try {
    const payload = {
      Order: order,
      ExternalID: externalId,
      Login: parseInt(login),
    };

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/backup/restore`,
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
    console.log('[API] Order restored from archive successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error restoring order from archive:', e.message);
    throw e;
  }
};

// Reopen an Order
module.exports.orderReopen = async (ticket) => {
  try {
    console.log(`[API] Reopening order by ticket ${ticket}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/order/reopen?ticket=${ticket}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Order reopened successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error reopening order:', e.message);
    return false;
  }
};