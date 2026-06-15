const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const ErrorTracking = sequelize.define(
    "ErrorTracking",
    {
        userId: {
            type: DataTypes.INTEGER,
            references: {
                model: "Users",
                key: "id",
            },
        },
        description: {
            type: DataTypes.TEXT
        },
        ip: {
            type: DataTypes.STRING
        },
        device: {
            type: DataTypes.STRING
        },
        api: {
            type: DataTypes.STRING
        },
        location: {
            type: DataTypes.STRING
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "ErrorTrackings",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

ErrorTracking.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

module.exports = ErrorTracking;
