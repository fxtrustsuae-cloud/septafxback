const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const CopyTradeModel = require("./copyTrade.model");
const MasterTraderModel = require("./masterTrader.model");
const sequelize = require("../config/db.config");

const CopyTradeSubscription = sequelize.define(
    "CopyTradeSubscription",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id",
            },
        },
        copyTradeId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "CopyTrades",
                key: "id",
            },
        },
        masterTraderId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: "master_trader_id",
            references: {
                model: "MasterTraders",
                key: "id",
            },
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "INACTIVE", "PAUSED", "PENDING"),
            defaultValue: "PENDING",
        },
        login: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        riskType: {
            type: DataTypes.ENUM("FIXED_LOT", "PROPORTIONAL", "MULTIPLIER"),
            defaultValue: "PROPORTIONAL",
        },
        fixedLotSize: {
            type: DataTypes.FLOAT,
        },
        multiplier: {
            type: DataTypes.FLOAT,
            defaultValue: 1.0,
        },
        maxLotSize: {
            type: DataTypes.FLOAT,
            defaultValue: 100.0,
        },
        maxDailyLoss: {
            type: DataTypes.FLOAT,
            defaultValue: 1000.0,
        },
        maxDrawdown: {
            type: DataTypes.FLOAT,
            defaultValue: 30.0,
        },
        stopLossMultiplier: {
            type: DataTypes.FLOAT,
            defaultValue: 1.0,
        },
        takeProfitMultiplier: {
            type: DataTypes.FLOAT,
            defaultValue: 1.0,
        },
        totalCopiedTrades: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        successfulCopies: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        failedCopies: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        totalPnl: {
            type: DataTypes.FLOAT,
            defaultValue: 0.0,
            field: "total_pnl",
        },
        subscribedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        unsubscribedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        approvedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "Users",
                key: "id",
            },
        },
        approvedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        rejectedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "Users",
                key: "id",
            },
        },
        rejectedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "CopyTradeSubscriptions",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ["master_trader_id"],
                where: { is_deleted: false },
                name: "idx_subscriptions_master_trader_id",
            },
            {
                fields: ["status"],
                where: { is_deleted: false },
                name: "idx_subscriptions_status",
            },
        ],
    }
);

CopyTradeSubscription.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: "id",
    as: "user",
});

CopyTradeSubscription.belongsTo(CopyTradeModel, {
    foreignKey: "copyTradeId",
    targetKey: "id",
    as: "copyTrade",
});

CopyTradeSubscription.belongsTo(MasterTraderModel, {
    foreignKey: "masterTraderId",
    targetKey: "id",
    as: "masterTrader",
});

module.exports = CopyTradeSubscription;
