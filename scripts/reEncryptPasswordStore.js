require("dotenv").config();

const sequelize = require("../config/db.config");
const PasswordModel = require("../models/password.model");

const ENCRYPTION_PREFIX = "enc_v1:";

function needsPasswordStoreMigration(passwordList) {
    if (!Array.isArray(passwordList)) {
        return false;
    }

    return passwordList.some((passwordEntry) => {
        return passwordEntry
            && typeof passwordEntry === "object"
            && typeof passwordEntry.password === "string"
            && passwordEntry.password.length > 0
            && !passwordEntry.password.startsWith(ENCRYPTION_PREFIX);
    });
}

async function main() {
    const passwordRows = await PasswordModel.findAll({
        where: { isDeleted: false },
    });

    let updatedRows = 0;
    for (const passwordRow of passwordRows) {
        const plainPasswordList = passwordRow.passwordList;
        if (!needsPasswordStoreMigration(plainPasswordList)) {
            continue;
        }

        passwordRow.passwordList = plainPasswordList;
        await passwordRow.save();
        updatedRows += 1;
    }

    console.log(`Password store migration complete. Updated ${updatedRows} row(s).`);
}

main()
    .catch((error) => {
        console.error("Password store migration failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
