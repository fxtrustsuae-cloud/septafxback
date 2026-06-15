const crypto = require("crypto");
const config = require("../config/config");

const ENCRYPTION_PREFIX = "enc_v1";
const MASKED_PASSWORD_VALUE = "********";

function getEncryptionKey() {
    const keyMaterial = config.PASSWORD_ENCRYPTION_KEY || config.JWT_AUTH_TOKEN;
    if (!keyMaterial) {
        throw new Error("Missing PASSWORD_ENCRYPTION_KEY or JWT auth secret for credential encryption.");
    }

    return crypto.createHash("sha256").update(String(keyMaterial)).digest();
}

function isEncryptedSecret(value) {
    return typeof value === "string" && value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

function encryptSecret(value) {
    if (typeof value !== "string" || value.length === 0 || isEncryptedSecret(value)) {
        return value;
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
    const encryptedValue = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);

    return [
        ENCRYPTION_PREFIX,
        iv.toString("base64"),
        cipher.getAuthTag().toString("base64"),
        encryptedValue.toString("base64"),
    ].join(":");
}

function decryptSecret(value) {
    if (typeof value !== "string" || value.length === 0 || !isEncryptedSecret(value)) {
        return value;
    }

    try {
        const [, ivBase64, authTagBase64, encryptedValueBase64] = value.split(":");
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            getEncryptionKey(),
            Buffer.from(ivBase64, "base64")
        );

        decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

        const decryptedValue = Buffer.concat([
            decipher.update(Buffer.from(encryptedValueBase64, "base64")),
            decipher.final(),
        ]);

        return decryptedValue.toString("utf8");
    } catch (error) {
        console.error("Failed to decrypt stored credential:", error.message);
        return null;
    }
}

function mapPasswordList(passwordList, passwordMapper) {
    if (!Array.isArray(passwordList)) {
        return [];
    }

    return passwordList.map((passwordEntry) => {
        if (!passwordEntry || typeof passwordEntry !== "object") {
            return passwordEntry;
        }

        return {
            ...passwordEntry,
            password: passwordMapper(passwordEntry.password),
        };
    });
}

function encryptPasswordList(passwordList) {
    return mapPasswordList(passwordList, encryptSecret);
}

function decryptPasswordList(passwordList) {
    return mapPasswordList(passwordList, decryptSecret);
}

function redactPasswordList(passwordList) {
    if (!Array.isArray(passwordList)) {
        return [];
    }

    return passwordList.map((passwordEntry) => {
        if (!passwordEntry || typeof passwordEntry !== "object") {
            return passwordEntry;
        }

        const hasStoredPassword = Boolean(passwordEntry.password);

        return {
            ...passwordEntry,
            password: null,
            hasStoredPassword,
            maskedPassword: hasStoredPassword ? MASKED_PASSWORD_VALUE : null,
        };
    });
}

module.exports = {
    decryptPasswordList,
    decryptSecret,
    encryptPasswordList,
    encryptSecret,
    redactPasswordList,
};
