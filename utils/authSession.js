const jwt = require("jsonwebtoken");
const config = require("../config/config");
const TokenAuth = require("../models/authToken.model");

const TOKEN_SUBJECT = {
    USER: "USER",
    MARKETING: "MARKETING",
};

function extractTokenFromHeader(headerValue) {
    if (!headerValue || typeof headerValue !== "string") {
        return "";
    }

    const trimmedHeader = headerValue.trim();
    if (!trimmedHeader) {
        return "";
    }

    return trimmedHeader.startsWith("Bearer ")
        ? trimmedHeader.slice(7).trim()
        : trimmedHeader;
}

function toPlainUserData(userData) {
    if (!userData) {
        return null;
    }

    const plainUser = typeof userData.get === "function"
        ? userData.get({ plain: true })
        : { ...userData };

    delete plainUser.password;
    return plainUser;
}

function buildAuthPayload(userData, subject = TOKEN_SUBJECT.USER) {
    return {
        subject,
        userData: toPlainUserData(userData),
    };
}

function signAuthToken(userData, subject = TOKEN_SUBJECT.USER) {
    return jwt.sign(
        buildAuthPayload(userData, subject),
        config.JWT_AUTH_TOKEN,
        { expiresIn: config.JWT_TOKEN_EXPIRES }
    );
}

function normalizeDecodedPayload(decodedToken) {
    let normalizedPayload = decodedToken;

    if (typeof normalizedPayload === "string") {
        try {
            normalizedPayload = JSON.parse(normalizedPayload);
        } catch (error) {
            return null;
        }
    }

    if (!normalizedPayload || typeof normalizedPayload !== "object") {
        return null;
    }

    if (normalizedPayload.userData && typeof normalizedPayload.userData === "object") {
        return {
            ...normalizedPayload,
            userData: toPlainUserData(normalizedPayload.userData),
        };
    }

    if (normalizedPayload.id) {
        return {
            userData: toPlainUserData(normalizedPayload),
        };
    }

    return null;
}

async function verifyAuthToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, config.JWT_AUTH_TOKEN, (error, decodedToken) => {
            if (error) {
                reject(error);
                return;
            }

            const normalizedPayload = normalizeDecodedPayload(decodedToken);
            if (!normalizedPayload || !normalizedPayload.userData) {
                reject(new Error("Invalid token payload"));
                return;
            }

            resolve(normalizedPayload);
        });
    });
}

async function replaceUserSession(userId, token) {
    await TokenAuth.update(
        { isDeleted: true },
        {
            where: {
                userId,
                isDeleted: false,
            },
        }
    );

    if (token) {
        await TokenAuth.create({
            userId,
            token,
        });
    }
}

async function hasActiveUserSession(userId, token) {
    const session = await TokenAuth.findOne({
        where: {
            userId,
            token,
            isDeleted: false,
        },
    });

    return Boolean(session);
}

function attachAuthenticatedUser(request, userData) {
    request.user = userData;
    request.body = request.body || {};
    request.body.user = userData;
}

module.exports = {
    TOKEN_SUBJECT,
    attachAuthenticatedUser,
    buildAuthPayload,
    extractTokenFromHeader,
    hasActiveUserSession,
    replaceUserSession,
    signAuthToken,
    toPlainUserData,
    verifyAuthToken,
};
