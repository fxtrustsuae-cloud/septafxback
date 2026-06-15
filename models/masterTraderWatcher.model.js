const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");
const UserModel = require("./users.model");
const MasterTraderModel = require("./masterTrader.model");

const MasterTraderWatcher = sequelize.define(
    "MasterTraderWatcher",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id",
            },
        },
        masterTraderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "MasterTraders",
                key: "id",
            },
        },
        notificationsEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: "Whether to receive notifications for this master trader",
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: "MasterTraderWatchers",
        timestamps: true,
        indexes: [
            {
                fields: ["userId", "masterTraderId", "isDeleted"],
                name: "idx_watcher_user_master_deleted",
            },
            {
                fields: ["userId", "isDeleted"],
                name: "idx_watcher_user_deleted",
            },
        ],
    }
);

// Set up associations
MasterTraderWatcher.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: "id",
    as: "user",
});

MasterTraderWatcher.belongsTo(MasterTraderModel, {
    foreignKey: "masterTraderId",
    targetKey: "id",
    as: "masterTrader",
});

module.exports = MasterTraderWatcher;
