const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Bot = sequelize.define(
    "Bot",
    {
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        botName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            defaultValue: "",
        },
        expectedReturn: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
            defaultValue: "ACTIVE",
        },
        minimumRequiredBalance: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Bots",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

module.exports = Bot;
