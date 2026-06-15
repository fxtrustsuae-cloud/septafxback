const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const AppSetting = sequelize.define("AppSetting", {
    admin: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Users", // Ensure this matches your User model table name
            key: "id"
        },
    },
    isMentnance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isForceUpdate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isPaymentChargesEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    iosVersion: {
        type: DataTypes.STRING,
        allowNull: false
    },
    androidVersion: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
}, {
    tableName: "AppSettings",
    timestamps: true, // Includes createdAt & updatedAt
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

AppSetting.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "byAdmin"
});

module.exports = AppSetting;
