const path = require("path");
const { URL } = require("url");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    return ["1", "true", "yes", "on", "require"].includes(String(value).toLowerCase());
}

function getConnectionString() {
    const value = process.env.DATABASE_URL;
    return value && value.trim() ? value.trim() : "";
}

function getUrlDetails(connectionString) {
    try {
        return new URL(connectionString);
    } catch (error) {
        return null;
    }
}

function requiredEnv(name) {
    const value = process.env[name];

    if (value === undefined || value === null || String(value).trim() === "") {
        throw new Error(`Missing required database environment variable: ${name}`);
    }

    return String(value);
}

function optionalEnv(name, defaultValue = undefined) {
    const value = process.env[name];

    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    return String(value);
}

function validateConnectionString(connectionString) {
    const url = getUrlDetails(connectionString);

    if (!url) {
        throw new Error("DATABASE_URL is not a valid connection string.");
    }

    if (!url.password) {
        throw new Error("DATABASE_URL must include a database password.");
    }
}

function buildSslOptions() {
    const explicitSsl = process.env.DB_SSL;
    if (explicitSsl !== undefined) {
        return parseBoolean(explicitSsl)
            ? { require: true, rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false) }
            : false;
    }

    const sslMode = String(process.env.PGSSLMODE || "").toLowerCase();
    if (["disable", "allow"].includes(sslMode)) {
        return false;
    }

    if (["require", "prefer", "verify-ca", "verify-full", "no-verify"].includes(sslMode)) {
        return {
            require: true,
            rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
        };
    }

    const connectionString = getConnectionString();
    if (!connectionString) {
        return false;
    }

    const url = getUrlDetails(connectionString);
    const sslQueryValue =
        url?.searchParams.get("sslmode") ||
        url?.searchParams.get("ssl");

    if (sslQueryValue) {
        const normalized = String(sslQueryValue).toLowerCase();
        if (["disable", "false", "0", "no"].includes(normalized)) {
            return false;
        }

        return {
            require: true,
            rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
        };
    }

    if (url?.hostname && !LOCAL_HOSTS.has(url.hostname)) {
        return {
            require: true,
            rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
        };
    }

    return false;
}

function buildSequelizeConnection() {
    const connectionString = getConnectionString();
    const ssl = buildSslOptions();
    const options = {
        dialect: process.env.DB_DIALECT || "postgres",
        logging: process.env.DB_LOGGING === "true",
    };

    if (ssl) {
        options.dialectOptions = { ssl };
    }

    if (connectionString) {
        validateConnectionString(connectionString);

        return {
            useConnectionString: true,
            connectionString,
            options,
        };
    }

    return {
        useConnectionString: false,
        database: requiredEnv("DB_NAME"),
        username: requiredEnv("DB_USER"),
        password: requiredEnv("DB_PASSWORD"),
        options: {
            ...options,
            host: requiredEnv("DB_HOST"),
            port: Number(process.env.DB_PORT || 5432),
        },
    };
}

function buildPgPoolConfig() {
    const connectionString = getConnectionString();
    const ssl = buildSslOptions();
    const config = {
        max: Number(process.env.PG_POOL_MAX || 20),
        idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
        connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 2000),
    };

    if (connectionString) {
        validateConnectionString(connectionString);

        return {
            ...config,
            connectionString,
            ...(ssl ? { ssl } : {}),
        };
    }

    return {
        ...config,
        host: optionalEnv("PG_HOST", optionalEnv("DB_HOST", "localhost")),
        user: optionalEnv("PG_USER", optionalEnv("DB_USER", "postgres")),
        password: String(optionalEnv("PG_PASSWORD", optionalEnv("DB_PASSWORD", ""))),
        database: optionalEnv("PG_DATABASE", optionalEnv("DB_NAME", "flexy")),
        port: Number(process.env.PG_PORT || process.env.DB_PORT || 5432),
        ...(ssl ? { ssl } : {}),
    };
}

module.exports = {
    buildSequelizeConnection,
    buildPgPoolConfig,
};
