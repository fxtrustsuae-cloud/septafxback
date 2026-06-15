const { DataTypes } = require("sequelize");
const UserModel = require("../models/users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Support = sequelize.define(
    "Support",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        subject: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        status: {
            type: DataTypes.ENUM("OPEN", "PROCESSING", "RESOLVED", "CLOSED"),
            defaultValue: "OPEN",
        },
        priority: {
            type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH"),
            defaultValue: "LOW",
        },
        image: {
            type: DataTypes.STRING,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Supports",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

Support.belongsTo(UserModel, {
    foreignKey: 'userId',
    targetKey: 'id',
    as: 'user',
});

module.exports = Support;
