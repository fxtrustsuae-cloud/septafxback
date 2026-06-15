const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Group = sequelize.define(
    "Group",
    {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mt5Group: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Mt5Groups", // References the Users table
                key: "id",
            },
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
            defaultValue: "ACTIVE"
        },
        type: {
            type: DataTypes.ENUM("DEMO", "REAL"),
            defaultValue: "REAL"
        },
        recomendation: {
            type: DataTypes.STRING
        },
        message: {
            type: DataTypes.TEXT,
        },
        minDeposit: {
            type: DataTypes.STRING
        },
        spread: {
            type: DataTypes.STRING
        },
        commission: {
            type: DataTypes.STRING
        },
        leverage: {
            type: DataTypes.INTEGER
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Groups",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

module.exports = Group;
