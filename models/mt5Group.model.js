const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Mt5Group = sequelize.define(
    "Mt5Group",
    {
        mt5GroupName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        path: {
            type: DataTypes.JSON, // store array as JSON
            defaultValue: []
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Mt5Groups",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

module.exports = Mt5Group;
