const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");
const MasterTraderModel = require("./masterTrader.model");

const MasterTraderEquityCurve = sequelize.define(
    "MasterTraderEquityCurve",
    {
        masterTraderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "MasterTraders",
                key: "id",
            },
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        balance: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        equity: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        profitLoss: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        returnPercent: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        drawdown: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "MasterTraderEquityCurves",
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            {
                fields: ["master_trader_id", "timestamp", "is_deleted"],
                name: "idx_equity_curve_master_timestamp",
            },
        ],
    }
);

MasterTraderEquityCurve.belongsTo(MasterTraderModel, {
    foreignKey: "masterTraderId",
    targetKey: "id",
    as: "masterTrader",
});

module.exports = MasterTraderEquityCurve;
