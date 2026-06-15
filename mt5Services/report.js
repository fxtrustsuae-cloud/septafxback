// Get Daily Reports / any time
async function getDailyReports(config, login) {
    console.log(`[API] Get daily reports api`);
    
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/daily_get?from=date&to=date&login=${login}`, // from=1585904106&to=1586768106
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        ...(authToken && { "Authorization": `Bearer ${authToken}` })
      },
      timeout: 30000
    };
  
    const response = await makeRequest(options);
    return await parseResponse(response);
}

// Get light daily reports // light don't include openOrders & positions
async function getDailyLightReports(config, login) {
    console.log(`[API] Get daily reports api`);
    
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/daily_get_light?from=date&to=date&login=${login}`, // from=1585904106&to=1586768106
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        ...(authToken && { "Authorization": `Bearer ${authToken}` })
      },
      timeout: 30000
    };
  
    const response = await makeRequest(options);
    return await parseResponse(response);
}