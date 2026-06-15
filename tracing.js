const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { resourceFromAttributes } = require("@opentelemetry/resources");

const DISABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const isDisabled = DISABLED_VALUES.has(
    String(process.env.OTEL_SDK_DISABLED || "").trim().toLowerCase()
);

const serviceName = process.env.OTEL_SERVICE_NAME || "testbharat-backend";
process.env.OTEL_SERVICE_NAME = serviceName;

let sdk;

if (!isDisabled) {
    // Strip trailing slash so /v1/traces is always appended cleanly
    const otlpEndpoint = (
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318"
    ).replace(/\/$/, "");

    sdk = new NodeSDK({
        resource: resourceFromAttributes({
            "service.name": serviceName,
            "deployment.environment": process.env.NODE_ENV || "production",
        }),

        // Explicit OTLP HTTP exporter — sends traces to SigNoz (or any OTel Collector)
        traceExporter: new OTLPTraceExporter({
            url: `${otlpEndpoint}/v1/traces`,
        }),

        instrumentations: [
            getNodeAutoInstrumentations({
                // Disable fs instrumentation — it creates thousands of spans for every
                // module load and file read, drowning out real application traces.
                "@opentelemetry/instrumentation-fs": { enabled: false },

                // Express, HTTP, MongoDB, pg, and others are auto-enabled by default.
            }),
        ],
    });

    try {
        sdk.start();
        console.log(`[OpenTelemetry] Tracing active → ${otlpEndpoint} (service: ${serviceName})`);
    } catch (error) {
        console.error("[OpenTelemetry] Failed to start SDK:", error);
    }

    const shutdown = async (signal) => {
        try {
            await sdk.shutdown();
            console.log("[OpenTelemetry] SDK shut down cleanly");
        } catch (error) {
            console.error("[OpenTelemetry] Shutdown error:", error);
        } finally {
            if (signal) process.exit(0);
        }
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("beforeExit", () => shutdown());
}

module.exports = sdk;
