const { config, httpsAgent, makeRequest, parseResponse } = require("./auth.js");
const configuration = require("../config/config.js");

const MT5_ADD_USER_TIMEOUT_MS = Number(
  process.env.MT5_ADD_USER_TIMEOUT_MS ||
  process.env.MT5_REQUEST_TIMEOUT_MS ||
  15000
);

// maintain connection
module.exports.maintainginConnection = async (login) => {
  try {
    // console.log(`[API] Maintaining Connection`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/test/access`,
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };
  
    const response = await makeRequest(options);
    // console.log("Maintainign Connection")
    return await parseResponse(response);
  } catch (e) {
    console.error('[API] Error While Maintaing connection:', e.message);
    return false;
  }
};

module.exports.addUser = async (userData) => {
  try {
    const payload = {
      Login: Number(userData.login),
      Group: userData.group,
      Name: userData.name,
      Leverage: Number(userData.Leverage),
      PassMain: userData.PassMain,
      PassInvestor: userData.PassInvestor,
      Email: userData.Email,
      Phone: userData.Phone,
      Country: userData.Country,
      City: userData.City,
      State: userData.State,
      ZipCode: userData.ZipCode,
      Address: userData.Address,
      PassPhone: userData.PhonePassword
    };

    // Remove undefined, null, or empty string values from payload
    const body = JSON.stringify(
      Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      )
    );

    console.log('[API] Request body being sent to /api/user/add:', body);

    const options = {
      hostname: config.server,
      port: config.port,
      path: '/api/user/add',
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      // Fail fast so account-creation requests do not block the API for a full minute.
      timeout: MT5_ADD_USER_TIMEOUT_MS
    };

    const response = await makeRequest(options, body);
    const result = await parseResponse(response);
    console.log('[API] User added successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error adding user:', e.message);
    const match = e.message.match(/API error (\d+)/);
    if (match) return { _mt5Error: true, retcode: parseInt(match[1]), message: e.message };
    return false;
  }
};

module.exports.updateUser = async (userData) => {
  try {
    const payload = {
      Login: Number(userData.login),
      Group: userData.group,
      Name: userData.name,
      Leverage: userData.Leverage !== undefined ? Number(userData.Leverage) : undefined,
      PassMain: userData.PassMain,
      PassInvestor: userData.PassInvestor,
      Email: userData.Email,
      Phone: userData.Phone,
      Country: userData.Country,
      City: userData.City,
      State: userData.State,
      ZipCode: userData.ZipCode,
      Address: userData.Address,
      PassPhone: userData.PhonePassword
    };

    // Remove undefined keys from payload
    const body = JSON.stringify(
      Object.fromEntries(Object.entries(payload).filter(([_, v]) => v !== undefined))
    );

    console.log('[API] Request body being sent to /api/user/update:', body);

    const options = {
      hostname: config.server,
      port: config.port,
      path: '/api/user/update',
      method: 'POST',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 60000
    };

    const response = await makeRequest(options, body);
    const result = await parseResponse(response);
    console.log('[API] User updated successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error updating user:', e.message);
    return false;
  }
};

module.exports.deleteUser = async (login) => {
  try {
    console.log(`[API] Deleting user ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/delete?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User deleted successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error deleting user:', e.message);
    return false;
  }
};

module.exports.getUser = async (login) => {
  try {
    console.log(`[API] Get user user ${login}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/get?login=${login}`,
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };
  
    const response = await makeRequest(options);
    return await parseResponse(response);
  } catch (e) {
    console.error('[API] Error get user:', e.message);
    return false;
  }
};

module.exports.multipleUser = async (account) => {
  try {
    console.log(`[API] Fetching multiple users for group ${account}`);
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/get_batch?group=${account}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Multiple users fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching multiple users:', e.message);
    return false;
  }
};

module.exports.changePassword = async (login, type, newPassword) => {
  try {
    console.log('[API] Changing password');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/change_password?login=${login}&type=${type}&password=${newPassword}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Password changed successfully:', result);
    return result;
  } catch (e) {
    // console.error('[API] Error changing password:', e.message);
    return false;
  }
};

module.exports.getTradeStatus = async (login) => {
  try {
    console.log('[API] Fetching trade account');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/account/get?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    // console.log('[API] Trade account fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching trade account:', e.message);
    return false;
  }
};

module.exports.getMultipleTrade = async (logins) => {
  try {
    console.log('[API] Fetching multiple trade accounts');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/account/get_batch?login=${logins}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Multiple trade accounts fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching multiple trade accounts:', e.message);
    return false;
  }
};

module.exports.getUserList = async (group) => {
  try {
    console.log('[API] Fetching user list');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/logins?group=${group}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User list fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching user list:', e.message);
    return false;
  }
};

module.exports.getTotalUser = async () => {
  try {
    console.log('[API] Fetching total users');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/total`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Total users fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching total users:', e.message);
    return false;
  }
};

module.exports.getGroupByLogin = async (login) => {
  try {
    console.log('[API] Fetching group by login');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/group?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Group by login fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching group by login:', e.message);
    return false;
  }
};

module.exports.getUserCertificate = async (login) => {
  try {
    console.log('[API] Fetching user certificate');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/certificate/get?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User certificate fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching user certificate:', e.message);
    return false;
  }
};

module.exports.deleteUserCertificate = async (login) => {
  try {
    console.log('[API] Deleting user certificate');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/certificate/delete?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User certificate deleted successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error deleting user certificate:', e.message);
    return false;
  }
};

module.exports.confirmUserCertificate = async (login) => {
  try {
    console.log('[API] Confirming user certificate');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/certificate/confirm?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User certificate confirmed successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error confirming user certificate:', e.message);
    return false;
  }
};

module.exports.getOtpSecret = async (login) => {
  try {
    console.log('[API] Fetching OTP secret');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/otp_secret/get?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] OTP secret fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching OTP secret:', e.message);
    return false;
  }
};

module.exports.setOtpSecret = async (data) => {
  try {
    console.log('[API] Setting OTP secret');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/otp_secret/set?login=${data.login}&otp_secret=${data.key}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] OTP secret set successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error setting OTP secret:', e.message);
    return false;
  }
};

module.exports.checkUserBalance = async (login, flag) => {
  try {
    console.log('[API] Checking user balance');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/check_balance?login=${login}&fixflag=${flag}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User balance checked successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error checking user balance:', e.message);
    return false;
  }
};

module.exports.moveUserToArchive = async (login) => {
  try {
    console.log('[API] Moving user to archive');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/archive/add?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User moved to archive successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error moving user to archive:', e.message);
    return false;
  }
};

module.exports.getUserFromArchive = async (login) => {
  try {
    console.log('[API] Fetching user from archive');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/archive/get?login=${login}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User fetched from archive successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching user from archive:', e.message);
    return false;
  }
};

module.exports.getUserListFromArchive = async (data) => {
  try {
    console.log('[API] Fetching user list from archive');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/user/archive/get_batch?login=${data.login}&group=${data.group}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] User list from archive fetched successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error fetching user list from archive:', e.message);
    return false;
  }
};

module.exports.sendPushNotification = async (data) => {
  try {
    console.log('[API] Sending push notification');
    const options = {
      hostname: config.server,
      port: config.port,
      path: `/api/notification/send?login=${data.login}&text=${data.message}`,
      method: 'GET',
      agent: httpsAgent,
      headers: {
        "Connection": "keep-alive",
      },
      timeout: 30000
    };

    const response = await makeRequest(options);
    const result = await parseResponse(response);
    console.log('[API] Push notification sent successfully:', result);
    return result;
  } catch (e) {
    console.error('[API] Error sending push notification:', e.message);
    return false;
  }
};
