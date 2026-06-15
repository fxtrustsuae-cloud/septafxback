const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const Mfa = sequelize.define("Mfa", {
    userId: {
        type: DataTypes.INTEGER,
        references: {
            model: "Users", // References the Users table
            key: "id",
        },
    },
    secretKey: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
        defaultValue: "INACTIVE"
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    timestamps: true,
    tableName: "Mfas",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

module.exports = Mfa;
