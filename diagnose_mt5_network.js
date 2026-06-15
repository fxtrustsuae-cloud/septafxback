const https = require("https");
const tls = require("tls");
const { HttpsProxyAgent } = require("https-proxy-agent");
const path = require("path");

// Load .env
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const server = process.env.MT5_URL || "api.adamcapitals.ai";
const port = parseInt(process.env.MT5_PORT || "443", 10);
const proxy = process.env.MT5_PROXY;

console.log("==========================================");
console.log("MT5 Network and TLS Handshake Diagnostics");
console.log("==========================================");
console.log(`Target MT5 Server: ${server}:${port}`);
console.log(`VPN Proxy: ${proxy || "None configured"}`);
console.log("------------------------------------------");

async function checkTlsDirect() {
    return new Promise((resolve) => {
        console.log("\n[Direct TLS] Attempting direct TLS connection to", server);
        
        const socket = tls.connect({
            host: server,
            port: port,
            servername: server, // SNI
            rejectUnauthorized: false // show cert details even if self-signed
        }, () => {
            console.log("✅ [Direct TLS] Connected successfully!");
            console.log("  Authorized:", socket.authorized);
            console.log("  Authorization Error:", socket.authorizationError);
            console.log("  Protocol:", socket.getProtocol());
            console.log("  Cipher:", JSON.stringify(socket.getCipher()));
            
            const cert = socket.getPeerCertificate();
            if (cert && cert.subject) {
                console.log("  Certificate Subject:", cert.subject.CN);
                console.log("  Certificate Issuer:", cert.issuer.CN);
                console.log("  Valid From:", cert.valid_from);
                console.log("  Valid To:", cert.valid_to);
            }
            socket.destroy();
            resolve(true);
        });

        socket.on("error", (err) => {
            console.error("❌ [Direct TLS] Connection Error:", err.message);
            if (err.stack) console.error(err.stack);
            resolve(false);
        });

        socket.setTimeout(8000);
        socket.on("timeout", () => {
            console.error("❌ [Direct TLS] Connection Timeout after 8 seconds");
            socket.destroy();
            resolve(false);
        });
    });
}

async function checkProxyTls() {
    if (!proxy) {
        console.log("\n[Proxy TLS] Skipped (No MT5_PROXY configured in .env)");
        return;
    }

    return new Promise((resolve) => {
        console.log("\n[Proxy TLS] Attempting connection via proxy:", proxy);
        const agent = new HttpsProxyAgent(proxy);

        const req = https.get({
            hostname: server,
            port: port,
            path: "/",
            agent: agent,
            rejectUnauthorized: false,
            timeout: 8000
        }, (res) => {
            console.log("✅ [Proxy TLS] Connected successfully!");
            console.log(`  HTTP Status Code: ${res.statusCode}`);
            resolve(true);
        });

        req.on("error", (err) => {
            console.error("❌ [Proxy TLS] Connection Error:", err.message);
            if (err.stack) console.error(err.stack);
            resolve(false);
        });

        req.on("timeout", () => {
            console.error("❌ [Proxy TLS] Connection Timeout after 8 seconds");
            req.destroy();
            resolve(false);
        });
    });
}

async function main() {
    await checkTlsDirect();
    await checkProxyTls();
    console.log("\nDiagnostic finished.");
    process.exit(0);
}

main();
