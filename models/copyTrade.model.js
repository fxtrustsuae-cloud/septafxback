const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const MasterTraderModel = require("./masterTrader.model");
const Mt5AccountModel = require("./mt5Account.model");
const sequelize = require("../config/db.config");

const CopyTrade = sequelize.define(
    "CopyTrade",
    {
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
        followerMt5Login: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: "Mt5Accounts",
                key: "Login",
            },
        },
        riskType: {
            type: DataTypes.ENUM("MULTIPLIER", "PROPORTIONAL", "FIXED_LOT"),
            defaultValue: "MULTIPLIER",
        },
        multiplier: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 1.0,
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "PAUSED", "STOPPED"),
            defaultValue: "ACTIVE",
        },
        totalCopiedTrades: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        totalPnL: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0.0,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "CopyTrades",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

CopyTrade.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: "id",
    as: "user",
});

CopyTrade.belongsTo(MasterTraderModel, {
    foreignKey: "masterTraderId",
    targetKey: "id",
    as: "masterTrader",
});

CopyTrade.belongsTo(Mt5AccountModel, {
    foreignKey: "followerMt5Login",
    targetKey: "Login",
    as: "followerAccount",
});

module.exports = CopyTrade;
