const {
    TOKEN_SUBJECT,
    attachAuthenticatedUser,
    extractTokenFromHeader,
    hasActiveUserSession,
    verifyAuthToken,
} = require("../utils/authSession");

function buildTokenErrorResponse(response, statusCode, message) {
    return response.status(statusCode).json({
        status: false,
        message,
        data: null,
    });
}

function getTokenErrorMessage(error) {
    return error.name === "TokenExpiredError"
        ? "Login expired!"
        : "Invalid or malformed token!";
}

module.exports.verifyJWTToken = async (request, response, next) => {
    try {
        const actualToken = extractTokenFromHeader(request.headers.authorization);
        if (!actualToken) {
            return buildTokenErrorResponse(response, 403, "Token is missing!");
        }

        const result = await verifyAuthToken(actualToken);
        const userRole = result.userData?.role;
        if (result.subject === TOKEN_SUBJECT.MARKETING || ["MANAGER", "MARKETING"].includes(userRole)) {
            return buildTokenErrorResponse(response, 401, "Invalid token audience!");
        }

        const hasActiveSession = await hasActiveUserSession(result.userData.id, actualToken);
        if (!hasActiveSession) {
            return buildTokenErrorResponse(response, 401, "Session invalid or logged out!");
        }

        attachAuthenticatedUser(request, result.userData);
        return next();
    } catch (error) {
        if (error.name === "TokenExpiredError" || error.message === "Invalid token payload") {
            return buildTokenErrorResponse(response, 401, getTokenErrorMessage(error));
        }

        return buildTokenErrorResponse(response, 500, "Server error while verifying token!");
    }
};

module.exports.wsVerifyJWTToken = async (token) => {
    try {
        const actualToken = extractTokenFromHeader(token);
        if (!actualToken) {
            return {
                status: false,
                message: "Token is missing!",
                data: null,
            };
        }

        const result = await verifyAuthToken(actualToken);
        const userRole = result.userData?.role;
        if (result.subject === TOKEN_SUBJECT.MARKETING || ["MANAGER", "MARKETING"].includes(userRole)) {
            return {
                status: false,
                message: "Invalid token audience!",
                data: null,
            };
        }

        const hasActiveSession = await hasActiveUserSession(result.userData.id, actualToken);
        if (!hasActiveSession) {
            return {
                status: false,
                message: "Session invalid or logged out!",
                data: null,
            };
        }

        return {
            status: true,
            message: "Authorized",
            data: result.userData,
        };
    } catch (error) {
        return {
            status: false,
            message: getTokenErrorMessage(error),
            data: null,
        };
    }
};

module.exports.verifyJWTTokenMarketing = async (request, response, next) => {
    try {
        const actualToken = extractTokenFromHeader(request.headers.authorization);
        if (!actualToken) {
            return buildTokenErrorResponse(response, 403, "Token is missing!");
        }

        const result = await verifyAuthToken(actualToken);
        const userRole = result.userData?.role;
        if (result.subject === TOKEN_SUBJECT.USER || !["MANAGER", "MARKETING"].includes(userRole)) {
            return buildTokenErrorResponse(response, 401, "Invalid token audience!");
        }

        attachAuthenticatedUser(request, result.userData);
        return next();
    } catch (error) {
        if (error.name === "TokenExpiredError" || error.message === "Invalid token payload") {
            return buildTokenErrorResponse(response, 401, getTokenErrorMessage(error));
        }

        return buildTokenErrorResponse(response, 500, "Server error while verifying token!");
    }
};
