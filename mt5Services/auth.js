const https = require("https");
const crypto = require("crypto");
const buffer = require("buffer");
const configuration = require("../config/config");
const { HttpsProxyAgent } = require("https-proxy-agent");

let httpsAgent = null;
let authToken = null; // Global auth token to be set after authentication

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function shouldRejectUnauthorized() {
  if (process.env.MT5_TLS_REJECT_UNAUTHORIZED !== undefined) {
    return parseBoolean(process.env.MT5_TLS_REJECT_UNAUTHORIZED, true);
  }

  return !parseBoolean(process.env.MT5_ALLOW_SELF_SIGNED, false);
}

// Initialize MT5 connection and export as a function
function initializeMT5(server, port) {
  console.log(`[MT5] Initializing connection to ${server}:${port}`);
  const rejectUnauthorized = shouldRejectUnauthorized();

  if (!rejectUnauthorized) {
    console.warn("[MT5] TLS certificate verification disabled for MT5 Web API.");
  }

  if (configuration.MT5_PROXY) {
    console.log(`[MT5] Using VPN Proxy: ${configuration.MT5_PROXY}`);
    httpsAgent = new HttpsProxyAgent(configuration.MT5_PROXY);
  } else {
    httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 5,
      maxFreeSockets: 2,
      freeSocketTimeout: 4000,
      timeout: 10000,
      rejectUnauthorized,
    });
  }
  return { server, port, authToken };
}
module.exports.initializeMT5 = initializeMT5;

// Destroy all pooled connections and create a fresh agent — call before re-auth
function resetAgent() {
  if (httpsAgent && httpsAgent.destroy) {
    httpsAgent.destroy();
  }
  const rejectUnauthorized = shouldRejectUnauthorized();
  if (configuration.MT5_PROXY) {
    httpsAgent = new HttpsProxyAgent(configuration.MT5_PROXY);
  } else {
    httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 5,
      maxFreeSockets: 2,
      freeSocketTimeout: 4000,
      timeout: 10000,
      rejectUnauthorized,
    });
  }
}
module.exports.resetAgent = resetAgent;

let authPromise = null;
const requestQueue = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (requestQueue.length > 0) {
      const { options, body, retries, resolve, reject } = requestQueue.shift();
      try {
        const result = await executeRequestDirectly(options, body, retries);
        resolve(result);
      } catch (err) {
        if (err.statusCode === 403 && options && !options.path.startsWith("/api/auth/")) {
          console.warn(`[HTTP] HTTP Error 403 encountered on ${options.path}. Re-authenticating...`);
          try {
            await acquireToken();
            console.log(`[HTTP] Re-auth successful. Re-queueing request to front of requestQueue.`);
            requestQueue.unshift({ options, body, retries, resolve, reject });
            await new Promise((r) => setTimeout(r, 150));
            continue;
          } catch (authErr) {
            console.error(`[HTTP] Re-auth failed during 403 retry: ${authErr.message}`);
            reject(err);
          }
        } else {
          reject(err);
        }
      }
      // Add a 150ms delay between requests to strictly prevent overwhelming the MT5 server firewall
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  } finally {
    isProcessingQueue = false;
  }
}

// Core request executor
function executeRequestDirectly(options, body, retries) {
  let requestPath = options.path;
  if (authToken && !requestPath.startsWith("/api/auth/")) {
    const separator = requestPath.includes("?") ? "&" : "?";
    requestPath = `${requestPath}${separator}token=${authToken}`;
  }

  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...options.headers,
    };

    const requestOptions = {
      ...options,
      path: requestPath,
      headers,
      agent: httpsAgent, // always use current agent so resetAgent() takes effect immediately
      rejectUnauthorized: options.rejectUnauthorized ?? shouldRejectUnauthorized(),
    };

    const req = https.request(requestOptions, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 400) {
          const err = new Error(`HTTP Error ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.body = responseBody;
          console.error(`[HTTP] Request failed: ${err.message}`);
          reject(err);
        } else {
          resolve({ res, body: responseBody });
        }
      });
    });

    req.on("error", async (e) => {
      const isRetryable =
        e.code === "ECONNRESET" ||
        e.code === "EPIPE" ||
        e.message.includes("socket disconnected") ||
        e.message.includes("socket hang up");

      if (isRetryable) {
        console.warn(`[HTTP] Retryable network error encountered: ${e.message}. Resetting HTTPS Agent to flush connection pool.`);
        resetAgent();
      }

      const isAuthRequest = options.path.startsWith("/api/auth/");

      if (isRetryable && retries > 0 && !isAuthRequest) {
        console.warn(`[HTTP] Retrying request in 500ms... (Remaining retries: ${retries - 1})`);
        setTimeout(async () => {
          try {
            const result = await executeRequestDirectly(options, body, retries - 1);
            resolve(result);
          } catch (retryErr) {
            reject(retryErr);
          }
        }, 500);
      } else {
        console.error(`[HTTP] Request error: ${e.message}`);
        reject(e);
      }
    });

    req.on("timeout", () => {
      console.error("[HTTP] Request timeout");
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (body) {
      console.log("[HTTP] Writing request body");
      req.write(body);
    }

    req.end();
  });
}

async function acquireToken(retries = 2) {
  if (authPromise) {
    console.log("[AUTH] Authentication already in progress, awaiting active handshake promise...");
    return authPromise;
  }

  authPromise = (async () => {
    let lastError = null;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        console.log(`[AUTH] acquireToken attempt ${attempt}/${retries + 1}`);
        resetAgent();
        await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
        return authToken;
      } catch (err) {
        lastError = err;
        console.error(`[AUTH] acquireToken attempt ${attempt} failed: ${err.message}`);
        if (attempt <= retries) {
          const delay = 500 * attempt;
          console.log(`[AUTH] Retrying entire authentication handshake in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError || new Error("Authentication failed");
  })();

  try {
    const token = await authPromise;
    return token;
  } finally {
    authPromise = null;
  }
}

// Core request function (Queued/Throttled)
async function makeRequest(options, body = null, retries = 2) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ options, body, retries, resolve, reject });
    processQueue();
  });
}
module.exports.makeRequest = makeRequest;

// Parse response
async function parseResponse(response) {
  try {
    // console.log("[API] Parsing response");
    const data = JSON.parse(response.body);

    if (!data) {
      throw new Error("Empty response");
    }

    if (data.retcode && parseInt(data.retcode) !== 0) {
      throw new Error(`API error ${data.retcode}: ${data.message || "Unknown error"}`);
    }

    return data;
  } catch (e) {
    console.error(`[API] Failed to parse response: ${e.message}`);
    console.debug("[API] Response body:", response.body);
    throw e;
  }
}
module.exports.parseResponse = parseResponse;

// Authentication helper functions
function processAuth(answer, password) {
  console.log("[AUTH] Processing authentication challenge");

  const pass_md5 = crypto.createHash("md5");
  const buf = buffer.transcode(Buffer.from(password, "utf8"), "utf8", "utf16le");
  pass_md5.update(buf, "binary");
  const pass_md5_digest = pass_md5.digest("binary");

  const md5 = crypto.createHash("md5");
  md5.update(pass_md5_digest, "binary");
  md5.update("WebAPI", "ascii");
  const md5_digest = md5.digest("binary");

  const answer_md5 = crypto.createHash("md5");
  answer_md5.update(md5_digest, "binary");
  answer_md5.update(Buffer.from(answer.srv_rand, "hex"), "binary");

  return answer_md5.digest("hex");
}

function processAuthFinal(answer, password, cli_random) {
  console.log("[AUTH] Verifying final authentication");

  const pass_md5 = crypto.createHash("md5");
  const buf = buffer.transcode(Buffer.from(password, "utf8"), "utf8", "utf16le");
  pass_md5.update(buf, "binary");
  const pass_md5_digest = pass_md5.digest("binary");

  const md5 = crypto.createHash("md5");
  md5.update(pass_md5_digest, "binary");
  md5.update("WebAPI", "ascii");
  const md5_digest = md5.digest("binary");

  const answer_md5 = crypto.createHash("md5");
  answer_md5.update(md5_digest, "binary");
  answer_md5.update(cli_random, "binary");

  return answer.cli_rand_answer === answer_md5.digest("hex");
}

// API functions
async function startAuth(config, login, build, agent) {
  console.log(`[AUTH] Starting authentication for login ${login}`);

  const options = {
    hostname: config.server,
    port: config.port,
    path: `/api/auth/start?version=${build}&agent=${agent}&login=${login}&type=manager`,
    agent: httpsAgent,
    headers: { "Connection": "keep-alive" },
    timeout: 15000,
  };

  const response = await executeRequestDirectly(options, null, 2);
  return await parseResponse(response);
}

async function completeAuth(config, srv_rand_answer, cli_random_hex) {
  console.log("[AUTH] Completing authentication");

  const options = {
    hostname: config.server,
    port: config.port,
    path: `/api/auth/answer?srv_rand_answer=${srv_rand_answer}&cli_rand=${cli_random_hex}`,
    agent: httpsAgent,
    headers: { "Connection": "keep-alive" },
    timeout: 15000,
  };

  const response = await executeRequestDirectly(options, null, 2);
  return await parseResponse(response);
}

// High-level authentication function
async function authenticate(config, login, password, build, agent) {
  console.log(`[AUTH] Beginning authentication process for ${login}`);

  if (!login || !password || !build || !agent) {
    throw new Error("Missing required parameters");
  }

  try {
    const startData = await startAuth(config, login, build, agent);
    const srv_rand_answer = processAuth(startData, password);
    const cli_random_buf = crypto.randomBytes(16);
    const cli_random_hex = cli_random_buf.toString("hex");

    const authData = await completeAuth(config, srv_rand_answer, cli_random_hex);

    if (processAuthFinal(authData, password, cli_random_buf)) {
      authToken = authData.cli_rand_answer || null;
      config.authToken = authToken; // Update config with the new token
      console.log("[AUTH] Authentication successful");
      return "Authentication successful";
    } else {
      throw new Error("Invalid final auth answer");
    }
  } catch (error) {
    console.error(`[AUTH] Authentication failed: ${error.message}`);
    throw error;
  }
}
module.exports.authenticate = authenticate;

// Export default config and all functions
const config = initializeMT5(configuration.MT5_URL, configuration.MT5_PORT);

module.exports = {
  config,
  httpsAgent,
  initializeMT5,
  makeRequest,
  parseResponse,
  authenticate,
  resetAgent,
  acquireToken,
};
