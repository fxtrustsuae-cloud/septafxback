require("./tracing");
const sequelize = require("./config/db.config");
const cors = require("cors");
const path = require("path");
const httpLogger = require("./middleware/httpLogger");
const cron = require("node-cron");
const express = require("express");
const router = require("./router");
const configuration = require("./config/config");
const { config, authenticate, resetAgent } = require("./mt5Services/auth");
const { maintainginConnection } = require("./mt5Services/user");
const { createSocketIO } = require("./config/socketIO");
const riskManagementService = require("./modules/risk-management/riskManagement.service");
require("./user/controller/orders.controller")
require("./utils/assingIbMarketing");

const { updateMt5Group, updateMt5Symbol } = require("./admin/controller/group.controller")

// require("./cron/cronController");

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');

const app = express();
const http = require("http");
const server = http.createServer(app);
const basePort = Number(configuration.PORT || 8080);
const maxPortRetries = Number(process.env.PORT_RETRY_COUNT || 10);
const requestBodyLimit = configuration.REQUEST_BODY_LIMIT || "25mb";
let currentPort = basePort;

createSocketIO(server);

app.set("trust proxy", true);
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(cors({
    origin: (origin, callback) => callback(null, true), // Allow all origins dynamically
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Range"],
    exposedHeaders: ["Content-Range", "X-Content-Range"]
}));
app.use(httpLogger);
app.use(express.static("public"));
app.use("/", router);
if (process.env.SWAGGER_HOST) {
    swaggerDocument.host = process.env.SWAGGER_HOST;
} else {
    delete swaggerDocument.host;
}
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/", (request, response) => {
    response.sendFile(__dirname + '/public/index.html');
});

app.use((request, response) => {
    response.type("text/plain");
    response.status(404);
    response.send({ success: true, message: "Server Working. But Api Not Found." });
});

// Global Error Handler Middleware
const globalErrorHandler = require("./middleware/globalErrorHandler");
app.use(globalErrorHandler);

const { computeAllMasterTraderStats } = require("./utils/computeMasterTraderStats");
const STATS_INTERVAL_MS = parseInt(process.env.MASTER_TRADER_STATS_INTERVAL_MS || "3600000", 10);

let initMetaStarted = false;
async function initMeta() {
    if (initMetaStarted) return;
    initMetaStarted = true;
    try {
        resetAgent();
        await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
        //await updateMt5Group();
        //await updateMt5Symbol();
    } catch (e) {
        initMetaStarted = false; // Reset on failure to allow retry
        console.log(e.message);
    }
}

let masterTraderStatsCronStarted = false;
function startMasterTraderStatsCron() {
    if (masterTraderStatsCronStarted) return;
    masterTraderStatsCronStarted = true;
    let statsRunning = false;

    const run = () => {
        if (statsRunning) {
            console.warn("[Stats] Previous run still in progress — skipping.");
            return;
        }
        statsRunning = true;
        computeAllMasterTraderStats()
            .catch((e) => console.error("[Stats] Run failed:", e.message))
            .finally(() => { statsRunning = false; });
    };

    run();
    setInterval(run, STATS_INTERVAL_MS);
}

let mt5KeepAliveStarted = false;
function startMt5KeepAlive() {
    if (mt5KeepAliveStarted) {
        return;
    }

    mt5KeepAliveStarted = true;
    setInterval(async () => {
        try {
            const data = await maintainginConnection();
            if (!data) {
                resetAgent();
                await authenticate(config, configuration.MT5_LOGIN, configuration.MT5_PASSWORD, 1985, "WebManager");
            }
        } catch (e) {
            console.log("maintaing connection error", e.message)
        }
    }, 20 * 1000);
}

function startServer(port) {
    currentPort = port;
    server.removeAllListeners("listening");
    server.listen(port, () => {
        console.log(`App running on http://localhost:${port}`);
        initMeta();
        startMt5KeepAlive();
        startMasterTraderStatsCron();
        riskManagementService.start();
    });
}

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        const retriesUsed = currentPort - basePort;
        if (retriesUsed < maxPortRetries) {
            const nextPort = currentPort + 1;
            console.warn(`Port ${currentPort} is already in use. Retrying on port ${nextPort}...`);
            startServer(nextPort);
            return;
        }
    }

    throw error;
});

const AUTO_SYNC_ENABLED_VALUES = ["1", "true", "yes", "on"];
const shouldAutoSync = AUTO_SYNC_ENABLED_VALUES.includes(
    String(process.env.DB_AUTO_SYNC || "").trim().toLowerCase()
);
const shouldAlterSync = AUTO_SYNC_ENABLED_VALUES.includes(
    String(process.env.DB_SYNC_ALTER || "").trim().toLowerCase()
);

async function bootstrap() {
    try {
        await sequelize.authenticate();
        console.log("PostgreSQL database connected successfully.");

        if (shouldAutoSync) {
            await sequelize.sync(shouldAlterSync ? { alter: true } : {});
            console.log(`Database synchronized with models${shouldAlterSync ? " using alter mode" : ""}.`);
        } else {
            console.log("Database auto-sync disabled. Set DB_AUTO_SYNC=true to enable model synchronization.");
        }

        startServer(basePort);
    } catch (err) {
        console.error("Unexpected error:", err);
        process.exit(1);
    }
}

bootstrap();
