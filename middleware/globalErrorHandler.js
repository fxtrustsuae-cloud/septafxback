const { logger, adminLogger, userLogger, marketingLogger } = require("../utils/logger");
const { CustomErrorHandler } = require("./CustomErrorHandler");
const configuration = require("../config/config");

const globalErrorHandler = (err, req, res, next) => {
    // 1. Determine which logger to use based on the request route
    let targetLogger = logger;
    const route = req.originalUrl || '';
    
    if (route.includes('/api/admin') || route.includes('/admin')) targetLogger = adminLogger;
    else if (route.includes('/api/user') || route.includes('/user')) targetLogger = userLogger;
    else if (route.includes('/api/marketing') || route.includes('/marketing')) targetLogger = marketingLogger;
    else targetLogger = logger.child({ module: 'GLOBAL' });

    // 2. Extract structured request metadata for logging
    const errorMeta = {
        method: req.method,
        route: req.originalUrl,
        ip: req.ip,
        userId: (req.user && (req.user.userId || req.user.id)) || 'Guest',
        email: (req.user && req.user.email) || 'N/A',
        body: Object.keys(req.body || {}).length ? JSON.stringify(req.body) : undefined,
        query: Object.keys(req.query || {}).length ? JSON.stringify(req.query) : undefined,
        stack: err.stack
    };

    // 3. Check if it's our known custom error
    if (err.status === 413 || err.statusCode === 413 || err.type === "entity.too.large") {
        targetLogger.warn(`Request body too large: ${err.message}`, errorMeta);

        return res.status(413).json({
            status: false,
            message: `Request body too large. Maximum allowed request body size is ${configuration.REQUEST_BODY_LIMIT || "25mb"}.`,
            data: null,
        });
    }

    if (err instanceof CustomErrorHandler) {
        // We log known operational errors as warnings (or info) to avoid cluttering error logs
        targetLogger.warn(`Operational Error: ${err.message}`, errorMeta);
        
        return res.status(err.status).json({
            status: false,
            message: err.message,
            data: null,
        });
    }

    // 4. If it's an unhandled/unexpected error, log it as an ERROR
    targetLogger.error(`Unhandled Exception: ${err.message || 'Unknown Error'}`, errorMeta);

    // Provide a safe response to the user
    return res.status(500).json({
        status: false,
        message: "Something went wrong! " + (err.message || ""),
        data: null,
    });
};

module.exports = globalErrorHandler;
