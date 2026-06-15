/**
 * One-time migration: adds coverPhoto column to MasterTraders table.
 * Run once with: node scripts/add-cover-photo.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const sequelize = require("../config/db.config");
const { DataTypes } = require("sequelize");

async function run() {
    const qi = sequelize.getQueryInterface();
    try {
        await qi.addColumn("MasterTraders", "coverPhoto", {
            type: DataTypes.STRING(512),
            allowNull: true,
        });
        console.log("✓ coverPhoto column added to MasterTraders.");
    } catch (e) {
        if (/already exists|duplicate column/i.test(e.message)) {
            console.log("✓ coverPhoto column already exists — nothing to do.");
        } else {
            console.error("Migration failed:", e.message);
            process.exit(1);
        }
    } finally {
        await sequelize.close();
    }
}

run();
