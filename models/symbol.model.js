const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Symbol = sequelize.define(
    "Symbol",
    {
        symbol: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        path: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Symbols",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

module.exports = Symbol;
