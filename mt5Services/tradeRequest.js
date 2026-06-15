const { config, httpsAgent, makeRequest, parseResponse } = require("./auth.js");
const configuration = require("../config/config.js");

// module.exports.getOpenTradeByTicket = async (ticket) => {
//   try {
//     console.log(`[API] Fetching open trade by ticket ${ticket}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/order/get?ticket=${ticket}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Open trade fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching open trade:', e.message);
//     return false;
//   }
// };

// module.exports.getPositionBySymbol = async (login, name) => {
//   try {
//     console.log(`[API] Fetching open position by login ${login} and symbol ${name}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/position/get?login=${login}&symbol=${name}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Open position fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching open position:', e.message);
//     return false;
//   }
// };

// module.exports.positionList = async (login) => {
//   try {
//     console.log(`[API] Fetching position list for login ${login}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/position/get_total?login=${login}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Position list fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching position list:', e.message);
//     return false;
//   }
// };

// module.exports.getPositionList = async (login, index, number) => {
//   try {
//     console.log(`[API] Fetching position list with pagination for login ${login}, offset ${index}, total ${number}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/position/get_page?login=${login}&offset=${index}&total=${number}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Position list pagination fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching position list pagination:', e.message);
//     return false;
//   }
// };

// module.exports.openOrderList = async (logins, groups, tickets, symbols) => {
//   try {
//     console.log(`[API] Fetching multiple positions for logins ${logins}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/position/get_batch?login=${logins}&group=${groups || ''}&ticket=${tickets || ''}&symbol=${symbols || ''}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Multiple positions fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching multiple positions:', e.message);
//     return false;
//   }
// };

// module.exports.getDailyReports = async (login, from, to) => {
//   try {
//     console.log(`[API] Fetching daily reports for login ${login} from ${from} to ${to}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/daily_get?from=${from}&to=${to}&login=${login}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Daily reports fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching daily reports:', e.message);
//     return false;
//   }
// };

// module.exports.getDailyLightReports = async (login, from, to) => {
//   try {
//     console.log(`[API] Fetching daily light reports for login ${login} from ${from} to ${to}`);
//     const options = {
//       hostname: config.server,
//       port: config.port,
//       path: `/api/daily_get_light?from=${from}&to=${to}&login=${login}`,
//       method: 'GET',
//       agent: httpsAgent,
//       headers: {
//         "Connection": "keep-alive",
//       },
//       timeout: 30000
//     };

//     const response = await makeRequest(options);
//     const result = await parseResponse(response);
//     console.log('[API] Daily light reports fetched successfully:', result);
//     return result;
//   } catch (e) {
//     console.error('[API] Error fetching daily light reports:', e.message);
//     return false;
//   }
// };

module.exports.depositWithdraw = async (login, type, balance, comment) => {
  try {
    console.log(`[API] Performing deposit/withdrawal for login ${login}, type ${type}, balance ${balance}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/trade/balance?login=${login}&type=${type}&balance=${balance}&comment=${encodeURIComponent(comment || '')}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Deposit/withdrawal processed successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error processing deposit/withdrawal:', e.message);
    return false;
  }
};

module.exports.currencyConversionRate = async (type=buy, base, currency, group, symbol, price) => {
  try {
    console.log(`[API] Calculating conversion rate for base ${base}, currency ${currency}, group ${group}, symbol ${symbol}, price ${price}`);
    
    const path = `/api/trade/calc_rate_${type}?base=${base}&currency=${currency}&group=${encodeURIComponent(group || '')}&symbol=${encodeURIComponent(symbol || '')}&price=${price || ''}`;
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
    console.log('[API] Conversion rate calculated successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error calculating conversion rate:', e.message);
    return false;
  }
};

module.exports.checkMargin = async (login, symbol, type, volume, price) => {
  try {
    // console.log(`[API] Checking margin for login ${login}, symbol ${symbol}, type ${type}, volume ${volume}, price ${price}`);
    
    const path = `/api/trade/check_margin?login=${login}&symbol=${encodeURIComponent(symbol || '')}&type=${type}&volume=${volume}&price=${price || ''}`;
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
    // console.log('[API] Margin checked successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error checking margin:', e.message);
    return false;
  }
};

module.exports.positionProfit = async (group, symbol, type, volume, open_price, close_price) => {
  try {
    console.log(`[API] Checking profit for login ${login}, symbol ${symbol}, type ${type}, volume ${volume}, price ${price}`);
    
    const path = `/api/trade/calc_profit?group=${group}&symbol=${symbol}&type=${type}&volume=${volume}&price_open=${open_price}&price_close=${close_price}`;
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
    console.log('[API] Check profit position success:', result);
    return result;
  } catch (e) {
    console.error('[API] Error checking Position profit:', e.message);
    return false;
  }
};

// Open Trade
module.exports.sendTradeRequest = async (tradeRequest) => {
  try {
    console.log(`[API] Sending trade request for login ${tradeRequest.login}, action ${tradeRequest.action}`);
    const payload = {
      Action: parseInt(tradeRequest.action),
      Login: parseInt(tradeRequest.login),
      Symbol: tradeRequest.mt5Symbol,
      Volume: parseInt(tradeRequest.volume),
      TypeFill: parseInt(tradeRequest.typeFill),
      Type: parseInt(tradeRequest.type),
      PriceOrder: Number(tradeRequest.priceOrder),
      Digits: parseInt(tradeRequest.digits),
      PriceSL: Number(tradeRequest.priceSl),
      PriceTP: Number(tradeRequest.priceTp),
    };
    console.log('[API] Open Trade request payload:', payload);

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/dealer/send_request`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(payload)),
      },
      timeout: 30000
    };

    const response = await makeRequest(options, JSON.stringify(payload));
    const result = await parseResponse(response);
    console.log('[API] Trade request sent successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error sending trade request:', e.message);
    return false; // Consistent with other functions like getOpenTradeByTicket
  }
};

// Close Trade
module.exports.closeTrade = async (tradeRequest) => {
  try {
    console.log(`[API] Close trade request for login ${tradeRequest.login}, action ${tradeRequest.action}`);

    const payload = {
      Action: 200,
      Login: parseInt(tradeRequest.login),
      TypeFill: parseInt(tradeRequest.typeFill),
      Type: parseInt(tradeRequest.type),
      Symbol: tradeRequest.symbol,
      Flags: parseInt(tradeRequest.flags ?? 1),
      Position: parseInt(tradeRequest.position),
      Volume: parseInt(tradeRequest.volume),
      PriceOrder: Number(tradeRequest.priceOrder),
      Digits: parseInt(tradeRequest.digits),
      TypeTime: parseInt(tradeRequest.typeTime ?? 0),
    };

    console.log('[API] Close Trade request payload:', payload);
    // return
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/dealer/send_request`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(payload)),
      },
      timeout: 30000
    };

    const response = await makeRequest(options, JSON.stringify(payload));
    const result = await parseResponse(response);
    console.log('[API] Close Trade request sent successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error sending Close trade request:', e.message);
    return false; // Consistent with other functions like getOpenTradeByTicket
  }
};

module.exports.symbolInfo = async (symbol) => {
  try {
    console.log(`[API] Fetching symbol info for ${symbol}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/symbol/get?symbol=${encodeURIComponent(symbol || '')}`,
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
    console.error('[API] Error fetching symbol info:', e.message);
    return false;
  }
};

module.exports.limitTradeOrder = async (tradeRequest) => {
  try {
    console.log(`[API] Limit trade request for login ${tradeRequest.login}, action ${tradeRequest.action}`);

    const payload = {
      Action: 201,
      Login: parseInt(tradeRequest.login),
      Symbol: tradeRequest.symbol,
      Volume: parseInt(tradeRequest.volume),
      Type: parseInt(tradeRequest.type),
      PriceOrder: Number(tradeRequest.priceOrder),
      TypeTime: parseInt(1),
      TimeExpiration: parseInt(0),
      TypeFill: parseInt(2),
      PriceTrigger: parseInt(tradeRequest.typeFill),
      PriceSL: Number(tradeRequest.priceSl),
      PriceTP: Number(tradeRequest.priceTp),
    };

    console.log('[API] Limit Trade request payload:', payload);

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/dealer/send_request`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(payload)),
      },
      timeout: 30000
    };

    const response = await makeRequest(options, JSON.stringify(payload));
    const result = await parseResponse(response);
    console.log('[API] Limit Trade request sent successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error sending Limit trade request:', e.message);
    return false;
  }
};

module.exports.modifyTradeOrder = async (tradeRequest) => {
  try {
    console.log(`[API] Modify trade request for login ${tradeRequest.login}, action ${tradeRequest.action}`);

    const payload = {
      Action: 203,
      Login: parseInt(tradeRequest.login),
      Order: parseInt(tradeRequest.order),
      Symbol: tradeRequest.symbol,
      Volume: parseInt(tradeRequest.volume),
      Type: parseInt(tradeRequest.type),
      PriceOrder: Number(tradeRequest.priceOrder),
      TypeTime: parseInt(1),
      TimeExpiration: parseInt(0),
      TypeFill: parseInt(2),
      PriceTrigger: parseInt(tradeRequest.typeFill),
      PriceSL: Number(tradeRequest.priceSl),
      PriceTP: Number(tradeRequest.priceTp),
    };

    console.log('[API] Modify Trade request payload:', payload);

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/dealer/send_request`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(payload)),
      },
      timeout: 30000
    };

    const response = await makeRequest(options, JSON.stringify(payload));
    const result = await parseResponse(response);
    console.log('[API] Modify Trade request sent successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error sending Modify trade request:', e.message);
    return false;
  }
};

module.exports.closeLimitOrder = async (tradeRequest) => {
  try {
    console.log(`[API] Close Limit trade request for login ${tradeRequest.login}, action ${tradeRequest.action}`);

    const payload = {
      Action: 204,
      Login: parseInt(tradeRequest.login),
      Order: parseInt(tradeRequest.order),
      Symbol: tradeRequest.symbol,
      Type: parseInt(tradeRequest.type),
      // Volume: parseInt(tradeRequest.volume),
      // PriceOrder: parseInt(tradeRequest.priceOrder),
      // TypeTime: parseInt(1),
      // TimeExpiration: parseInt(0),
      // TypeFill: parseInt(2),
      // PriceTrigger: parseInt(tradeRequest.typeFill),
      // PriceSL: parseInt(tradeRequest.priceSl),
      // PriceTP: parseInt(tradeRequest.priceTp),
    };

    console.log('[API] Close Limit Trade request payload:', payload);

    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/dealer/send_request`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(payload)),
      },
      timeout: 30000
    };

    const response = await makeRequest(options, JSON.stringify(payload));
    const result = await parseResponse(response);
    console.log('[API] Close Limit Trade request sent successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error sending Close Limit trade request:', e.message);
    return false;
  }
};

module.exports.symbolPrice = async (symbols, transactionId = 0) => {
  try {
    console.log(`[API] Fetching price of symbols ${symbols}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/tick/last?symbol=${symbols}&trans_id=${transactionId}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Symbol Price fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching symbol price:', e.message);
    return false;
  }
};
      
module.exports.getExecutedTrade = async (id) => {
  try {
    console.log(`[API] Fetching executed Trade.`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/dealer/get_request_result?id=${id}`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] executed trade fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching executed trade:', e.message);
    return false;
  }
};
