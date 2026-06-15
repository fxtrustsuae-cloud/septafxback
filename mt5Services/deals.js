const configuration = require("../config/config.js");
const { config, httpsAgent, makeRequest, parseResponse } = require("./auth.js");

function appendQueryParam(params, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  params.set(key, String(value));
}

// Getting a Deal by Ticket
module.exports.getDealByTicket = async (ticket) => {
  try {
    console.log(`[API] Fetching deal by ticket ${ticket}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/deal/get?ticket=${ticket}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Deal fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching deal:', e.message);
    return false;
  }
};

// Getting the Number of Deals
module.exports.getDealsList = async (login, fromDate, toDate) => {
  try {
    console.log(`[API] Fetching deals List.`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/deal/get_total?login=${login}&from=${fromDate}&to=${toDate}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Total deals fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching total deals:', e.message);
    return false;
  }
};

// Getting Deals Page by Page
module.exports.getDealsPage = async (login, fromDate, toDate, offset, total) => {
  try {
    console.log(`[API] Fetching deals by pagination.`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/deal/get_page?login=${login}&from=${fromDate}&to=${toDate}&offset=${offset}&total=${total}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Deals by pagination fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching deals by pagination:', e.message);
    return false;
  }
};

// Get Multiple Deals
module.exports.getDealBatch = async (logins, groups, tickets, fromDate, toDate, symbol) => {
  try {
    console.log(`[API] Fetching multiple deals for logins ${logins}`);
    const params = new URLSearchParams();
    appendQueryParam(params, "login", logins);
    appendQueryParam(params, "group", groups);
    appendQueryParam(params, "ticket", tickets);
    appendQueryParam(params, "from", fromDate);
    appendQueryParam(params, "to", toDate);
    appendQueryParam(params, "symbol", symbol);

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/deal/get_batch?${params.toString()}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Multiple deals fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching multiple deals:', e.message);
    return false;
  }
};

// Deal Update
module.exports.updateDeal = async (deal, data) => {
  try {
    console.log(`[API] Updating deal with ticket ${deal}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/deal/update?deal=${deal}`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json"
      },
      timeout: 30000,
      data: JSON.stringify(data)
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Deal updated successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error updating deal:', e.message);
    return false;
  }
};

// Delete a Deal
module.exports.deleteDeal = async (tickets) => {
  try {
    console.log(`[API] Deleting deals by tickets ${tickets}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/deal/delete?tickets=${tickets}`,
      method: 'DELETE',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Deals deleted successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error deleting deals:', e.message);
    return false;
  }
};

// module.exports.getDealBackupList = async (start, end) => {
//   try {
//  
//     console.log(`[API] Fetching deal backup creation dates from ${start} to ${end}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/deal/backup/list?start=${start}&end=${end}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Deal backup list fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching deal backup list:', e.message);
//     return false;
//   }
// };

// module.exports.getDealBackup = async (backup) => {
//   try {
//  
//     console.log(`[API] Fetching deal backup with ID ${backup}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/deal/backup/get?backup=${backup}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Deal backup fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching deal backup:', e.message);
//     return false;
//   }
// };

// module.exports.restoreDealBackup = async (backup, deal) => {
//   try {
//  
//     console.log(`[API] Restoring deal ${deal} from backup ${backup}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/deal/backup/restore?backup=${backup}&deal=${deal}`,
//       method: 'POST',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Deal restored from backup successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error restoring deal from backup:', e.message);
//     return false;
//   }
// };
