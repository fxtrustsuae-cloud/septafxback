const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");
const MasterTraderModel = require("./masterTrader.model");

const MasterTraderStats = sequelize.define(
    "MasterTraderStats",
    {
        masterTraderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "MasterTraders",
                key: "id",
            },
        },
        snapshotDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        totalTrades: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        winningTrades: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        losingTrades: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        winRate: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0,
        },
        totalPnL: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        totalPnLPercentage: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        weeklyPnL: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        monthlyPnL: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        growthPercent: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        maxDrawdownPercent: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        averageWin: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        averageLoss: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        profitFactor: {
            type: DataTypes.DECIMAL(15, 4),
            defaultValue: 0,
        },
        activeCopiers: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        stats: {
            type: DataTypes.JSONB,
            defaultValue: {},
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "MasterTraderStats",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

MasterTraderStats.belongsTo(MasterTraderModel, {
    foreignKey: "masterTraderId",
    targetKey: "id",
    as: "masterTrader",
});

module.exports = MasterTraderStats;
