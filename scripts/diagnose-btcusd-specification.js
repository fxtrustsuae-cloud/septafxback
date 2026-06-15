const https = require("https");
const crypto = require("crypto");
const buffer = require("buffer");
const path = require("path");
const fs = require("fs");

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

const httpsAgent = new https.Agent({
    keepAlive: true,
    rejectUnauthorized: false
});

let authToken = null;

function makeRequest(path, headers = {}) {
    return new Promise((resolve, reject) => {
        const separator = path.includes("?") ? "&" : "?";
        const finalPath = authToken && !path.startsWith("/api/auth/") ? `${path}${separator}token=${authToken}` : path;
        
        const options = {
            hostname: server,
            port: port,
            path: finalPath,
            method: "GET",
            agent: httpsAgent,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Connection": "keep-alive",
                ...headers
            }
        };
        
        const req = https.request(options, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP Error ${res.statusCode}: ${body}`));
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
        console.log("Connecting to MT5 Gateway...");
        const startData = await makeRequest(`/api/auth/start?version=1985&agent=WebManager&login=${login}&type=manager`);
        const srv_rand_answer = processAuth(startData, password);
        const cli_random_buf = crypto.randomBytes(16);
        const cli_random_hex = cli_random_buf.toString("hex");
        const authData = await makeRequest(`/api/auth/answer?srv_rand_answer=${srv_rand_answer}&cli_rand=${cli_random_hex}`);
        
        if (processAuthFinal(authData, password, cli_random_buf)) {
            authToken = authData.cli_rand_answer;
            console.log("✅ Authenticated successfully!\n");
        } else {
            console.error("❌ Authentication failed.");
            httpsAgent.destroy();
            return;
        }

        console.log("Fetching RAW specifications for symbol 'BTCUSD'...");
        const symbolRes = await makeRequest(`/api/symbol/get?symbol=BTCUSD`);
        
        if (symbolRes && symbolRes.retcode === "0 Done" && symbolRes.answer) {
            console.log("\n========================================================");
            console.log("            RAW MT5 SYMBOL SPECIFICATION               ");
            console.log("========================================================");
            console.log(JSON.stringify(symbolRes.answer, null, 2));
            console.log("========================================================\n");
        } else {
            console.error("❌ Failed to fetch specifications for BTCUSD:", symbolRes);
        }

        httpsAgent.destroy();
    } catch (e) {
        console.error("❌ Diagnostic failed:", e.message);
        httpsAgent.destroy();
    }
}

run();
