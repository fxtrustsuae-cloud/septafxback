const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const Mt5AccountModel = require("./mt5Account.model");
const sequelize = require("../config/db.config");

const MasterTrader = sequelize.define(
    "MasterTrader",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id",
            },
        },
        mt5Login: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: "Mt5Accounts",
                key: "Login",
            },
        },
        displayName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        riskLevel: {
            type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH"),
            defaultValue: "MEDIUM",
        },
        tradingStyle: {
            type: DataTypes.ENUM("SCALPING", "SWING", "DAY", "POSITION"),
            allowNull: true,
        },
        instruments: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: [],
        },
        avgTradeDuration: {
            type: DataTypes.ENUM("MINUTES", "HOURS", "DAYS", "WEEKS"),
            allowNull: true,
        },
        minimumCopyBalance: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0.0,
        },
        maxCopiers: {
            type: DataTypes.INTEGER,
            defaultValue: 100,
        },
        activeCopiers: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        ruleIndex: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        ruleMode: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "Percentage",
        },
        ruleName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        sourceSymbol: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "*",
        },
        profilePhoto: {
            type: DataTypes.STRING(512),
            allowNull: true,
        },
        coverPhoto: {
            type: DataTypes.STRING(512),
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "INACTIVE", "SUSPENDED"),
            defaultValue: "ACTIVE",
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "MasterTraders",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

MasterTrader.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: "id",
    as: "user",
});

MasterTrader.belongsTo(Mt5AccountModel, {
    foreignKey: "mt5Login",
    targetKey: "Login",
    as: "mt5Account",
});

module.exports = MasterTrader;
