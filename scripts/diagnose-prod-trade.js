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
console.log("        MT5 Trade Rejection (10006) Deep Diagnostic      ");
console.log("========================================================");
console.log(`📡 Host:         ${server}`);
console.log(`🔌 Port:         ${port}`);
console.log(`🔑 WebManager:   ${login}`);
console.log("========================================================\n");

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 2000,
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
        req.setTimeout(15000);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout"));
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
        console.log("➡️ [1/5] Authenticating with MT5 server...");
        const startData = await makeRequest(`/api/auth/start?version=1985&agent=WebManager&login=${login}&type=manager`);
        const srv_rand_answer = processAuth(startData, password);
        const cli_random_buf = crypto.randomBytes(16);
        const cli_random_hex = cli_random_buf.toString("hex");
        const authData = await makeRequest(`/api/auth/answer?srv_rand_answer=${srv_rand_answer}&cli_rand=${cli_random_hex}`);
        
        if (processAuthFinal(authData, password, cli_random_buf)) {
            authToken = authData.cli_rand_answer;
            console.log("✅ [1/5] Authenticated successfully! Token obtained.\n");
        } else {
            console.error("❌ Authentication verification failed.");
            httpsAgent.destroy();
            return;
        }

        const targetLogin = "100024";
        const targetSymbol = "BTCUSD";

        console.log(`➡️ [2/5] Querying user account details for login ${targetLogin}...`);
        const userRes = await makeRequest(`/api/user/get?login=${targetLogin}`);
        
        if (!userRes || userRes.retcode !== "0 Done") {
            console.error(`❌ Failed to fetch user ${targetLogin}:`, userRes);
            httpsAgent.destroy();
            return;
        }
        
        const u = userRes.answer;
        console.log("✅ User Account Found!");
        console.log(`   - Name:     ${u.Name}`);
        console.log(`   - Group:    ${u.Group}`);
        console.log(`   - Status:   ${parseInt(u.Rights) === 0 ? "Disabled" : "Active"}`);
        console.log(`   - Rights:   ${u.Rights}`);
        console.log(`   - Leverage: 1:${u.Leverage}\n`);

        console.log(`➡️ [3/5] Querying user trade/balance account status...`);
        const tradeRes = await makeRequest(`/api/user/account/get?login=${targetLogin}`);
        if (tradeRes && tradeRes.retcode === "0 Done" && tradeRes.answer) {
            const ta = tradeRes.answer;
            console.log("✅ Trade Account Details:");
            console.log(`   - Balance:      ${ta.Balance}`);
            console.log(`   - Equity:       ${ta.Equity}`);
            console.log(`   - Free Margin:  ${ta.MarginFree}`);
            console.log(`   - Trading Blocked? ${ta.Blocked ? "Yes 🔴" : "No 🟢"}\n`);
        } else {
            console.log(`⚠️ Could not fetch balance metrics:`, tradeRes);
        }

        console.log(`➡️ [4/5] Querying Group Details for "${u.Group}"...`);
        const groupRes = await makeRequest(`/api/group/get?group=${encodeURIComponent(u.Group)}`);
        if (groupRes && groupRes.retcode === "0 Done" && groupRes.answer) {
            const g = groupRes.answer;
            console.log("✅ Group Settings Found:");
            console.log(`   - Group Name:   ${g.Group}`);
            console.log(`   - Max Leverage: ${g.LeverageMax || "Default"}`);
            // Check if trading is allowed
            console.log("-------------------------------------------------------------");
        } else {
            console.log(`⚠️ Could not fetch details for group "${u.Group}".`);
        }

        console.log(`\n➡️ [5/5] Querying Symbol Configuration for "${targetSymbol}"...`);
        const symbolRes = await makeRequest(`/api/symbol/get?symbol=${targetSymbol}`);
        if (symbolRes && symbolRes.retcode === "0 Done" && symbolRes.answer) {
            const s = symbolRes.answer;
            console.log(`✅ Symbol "${targetSymbol}" details:`);
            console.log(`   - Symbol name:    ${s.Symbol}`);
            console.log(`   - Digits:         ${s.Digits}`);
            
            // Trade Mode Explanation:
            // 0 = Disabled, 1 = LongOnly, 2 = ShortOnly, 3 = CloseOnly, 4 = Full Access
            const tradeModes = {
                "0": "Disabled (Cannot trade) 🔴",
                "1": "Long Only (Can only buy)",
                "2": "Short Only (Can only sell)",
                "3": "Close Only (Can only close positions)",
                "4": "Full Access (Full trading allowed) 🟢"
            };
            const currentMode = String(s.TradeMode);
            console.log(`   - Trade Mode:     ${currentMode} -> ${tradeModes[currentMode] || "Unknown"}`);
            
            // Execution Mode
            const execModes = {
                "0": "Request Execution",
                "1": "Instant Execution",
                "2": "Market Execution",
                "3": "Exchange Execution"
            };
            console.log(`   - Execution Mode: ${s.Execution} -> ${execModes[String(s.Execution)] || "Unknown"}`);
            
            // Fill Flags Bitmask:
            // 1 = FOK, 2 = IOC, 4 = Return
            const fillFlags = parseInt(s.FillFlags, 10);
            const supportedFills = [];
            if (fillFlags & 1) supportedFills.push("FOK (0)");
            if (fillFlags & 2) supportedFills.push("IOC (1)");
            if (fillFlags & 4) supportedFills.push("Return (2)");
            console.log(`   - Fill Flags:     ${s.FillFlags} -> Supported Fill Modes: ${supportedFills.join(", ") || "None listed"}`);
            
            console.log(`   - Vol Min:        ${s.VolumeMin / 10000} lots`);
            console.log(`   - Vol Max:        ${s.VolumeMax / 10000} lots`);
            console.log(`   - Vol Step:       ${s.VolumeStep / 10000} lots`);
            console.log(`   - Contract Size:  ${s.ContractSize}`);
            console.log("-------------------------------------------------------------");
            
            console.log("\n💡 INTERPRETATION:");
            if (currentMode === "0") {
                console.log("🚨 DETECTED ISSUE: Trading mode for this symbol is DISABLED (0) on the broker's server.");
            } else if (currentMode === "3") {
                console.log("🚨 DETECTED ISSUE: Trading mode is CLOSE-ONLY (3). You cannot open new positions.");
            } else if (fillFlags > 0 && !supportedFills.includes("FOK (0)") && !supportedFills.includes("Return (2)")) {
                console.log("🚨 DETECTED ISSUE: Neither FOK (0) nor Return (2) are supported by this symbol's fill configuration.");
            } else {
                console.log("🟢 The symbol configuration looks correct. Please verify manager account permissions or margins.");
            }
        } else {
            console.log(`❌ Symbol "${targetSymbol}" was NOT found or is not mapped on the MT5 server!`);
        }
        
        console.log("=============================================================");
        
        httpsAgent.destroy();
    } catch (e) {
        console.error("\n❌ Diagnostics failed:", e.message);
        httpsAgent.destroy();
    }
}

run();
