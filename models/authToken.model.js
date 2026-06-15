const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const AuthToken = sequelize.define("AuthToken", {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Users", // References the Users table
            key: "id",
        },
    },
    token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    timestamps: true,
    tableName: "AuthTokens",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

module.exports = AuthToken;
