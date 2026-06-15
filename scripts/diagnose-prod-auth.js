const https = require("https");
const crypto = require("crypto");
const buffer = require("buffer");
const path = require("path");
const fs = require("fs");

// Load dotenv from root if available
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    console.log("📝 Loaded environment variables from:", envPath);
} else {
    console.warn("⚠️ Warning: No .env file found at", envPath);
}

const login = process.env.LOGIN || "2030";
const password = process.env.PASSWORD || "FxTest@2026";
const server = process.env.MT5_URL || "webtrading.achieverfx.com";
const port = parseInt(process.env.MT5_PORT || "443", 10);

console.log("\n========================================================");
console.log("        MT5 WebAPI Connection & Auth Diagnostics        ");
console.log("========================================================");
console.log(`📡 MT5 Host:      ${server}`);
console.log(`🔌 Port:          ${port}`);
console.log(`🔑 Manager Login: ${login}`);
console.log(`🔒 Password:      ${password ? "****" + password.substring(Math.max(0, password.length - 4)) : "Not configured"}`);
console.log("========================================================\n");

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 2000,
    rejectUnauthorized: false
});

function makeRequest(path, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: server,
            port: port,
            path: path,
            method: "GET",
            agent: httpsAgent,
            headers: {
                "User-Agent": userAgent,
                "Connection": "keep-alive",
                ...headers
            }
        };
        
        console.log(`🚀 Sending HTTP GET to https://${server}:${port}${path}`);
        const req = https.request(options, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                if (res.statusCode >= 400) {
                    const err = new Error(`HTTP Error ${res.statusCode}`);
                    err.statusCode = res.statusCode;
                    err.body = body;
                    reject(err);
                } else {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                }
            });
        });
        
        req.on("error", (e) => reject(e));
        
        req.setTimeout(12000);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timed out after 12 seconds"));
        });
        
        req.end();
    });
}

function processAuth(answer, password) {
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

async function run() {
    try {
        console.log("➡️ [STEP 1/3] Initiating authentication handshake (/api/auth/start)...");
        const startData = await makeRequest(`/api/auth/start?version=1985&agent=WebManager&login=${login}&type=manager`);
        console.log("✅ [STEP 1/3] Success! Challenged by MT5 server.");
        console.log("challenge payload:", JSON.stringify(startData, null, 2));
        
        if (!startData.srv_rand) {
            console.error("❌ Error: MT5 challenge did not contain 'srv_rand'. Response:", startData);
            httpsAgent.destroy();
            return;
        }

        console.log("\n➡️ [STEP 2/3] Computing MD5 verification hash...");
        const srv_rand_answer = processAuth(startData, password);
        const cli_random_buf = crypto.randomBytes(16);
        const cli_random_hex = cli_random_buf.toString("hex");
        
        console.log("➡️ [STEP 3/3] Sending answer challenge (/api/auth/answer)...");
        const authData = await makeRequest(`/api/auth/answer?srv_rand_answer=${srv_rand_answer}&cli_rand=${cli_random_hex}`);
        console.log("✅ [STEP 3/3] Success! Server verification response received.");
        console.log("response payload:", JSON.stringify(authData, null, 2));
        
        const verified = processAuthFinal(authData, password, cli_random_buf);
        if (verified) {
            console.log("\n🎉 ========================================================");
            console.log("🎉 SUCCESS: MT5 WebAPI Handshake Completed & Authenticated!");
            console.log(`🎉 Token: ${authData.cli_rand_answer}`);
            console.log("🎉 ========================================================\n");
        } else {
            console.error("\n❌ ERROR: MT5 Handshake failed final step verification.");
        }
        
        httpsAgent.destroy();
    } catch (e) {
        console.log("\n❌ =================== DIAGNOSTICS FAILURE ===================");
        console.error(`Error Code / Message: ${e.message}`);
        
        if (e.statusCode) {
            console.error(`HTTP Status Code:     ${e.statusCode}`);
        }
        
        if (e.body) {
            console.error(`HTTP Response Body:   ${e.body}`);
        }
        
        console.log("-------------------------------------------------------------");
        console.log("💡 INTERPRETATION & SOLUTIONS:");
        
        if (e.statusCode === 403) {
            console.log("\n🚨 HTTP Error 403 (Forbidden) detected!");
            console.log("This is the most common broker MT5 WebAPI error. It means:");
            console.log("1. IP Whitelisting issue:");
            console.log("   The server's public IP address is NOT whitelisted on the MT5 server.");
            console.log("   👉 Action: Contact your broker or administrator and provide the server's");
            console.log(`   public IP to add to the [WebAPI] 'AllowIP' list in the MT5 'webapi.ini' configuration.`);
            console.log("\n2. Incorrect Manager Login / ID:");
            console.log("   The LOGIN value in the .env file is either incorrect or is not a Manager-level account.");
            console.log("   👉 Action: Verify that the LOGIN value is correct.");
            console.log("\n3. WebAPI Access Disabled on Account:");
            console.log("   The Manager account is correct but doesn't have permissions to connect via WebAPI.");
            console.log("   👉 Action: Ensure the Manager account has 'WebAPI' permissions enabled in MT5.");
        } else if (e.code === "ETIMEDOUT" || e.message.includes("timed out")) {
            console.log("\n🚨 Connection Timeout detected!");
            console.log("This means the MT5 server is not responding to our requests at all. It means:");
            console.log("1. Host or Port is incorrect.");
            console.log("2. A network firewall is dropping packages between your server and the MT5 server.");
            console.log(`   👉 Action: Double check that port ${port} is open and MT5_URL is correct.`);
        } else if (e.statusCode === 401) {
            console.log("\n🚨 HTTP Error 401 (Unauthorized) / Invalid Password!");
            console.log("The credentials was rejected. Please verify the PASSWORD value in the .env file.");
        } else {
            console.log("\n🚨 General Network / Connection Error!");
            console.log("Please check your internet connection, proxy settings, or server host/port details.");
        }
        console.log("=============================================================\n");
        httpsAgent.destroy();
    }
}

run();
