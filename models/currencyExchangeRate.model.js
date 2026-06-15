const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config");

const CurrencyExchangeRate = sequelize.define(
    "CurrencyExchangeRate",
    {
        baseCurrency: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "USD",
        },
        currencyCode: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        exchangeRate: {
            type: DataTypes.DECIMAL(18, 8),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
            defaultValue: "ACTIVE",
        },
        createdBy: {
            type: DataTypes.INTEGER,
            references: {
                model: "Users",
                key: "id",
            },
        },
        updatedBy: {
            type: DataTypes.INTEGER,
            references: {
                model: "Users",
                key: "id",
            },
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "CurrencyExchangeRates",
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            {
                unique: true,
                fields: ["base_currency", "currency_code", "is_deleted"],
            },
        ],
    }
);

CurrencyExchangeRate.belongsTo(UserModel, {
    foreignKey: "createdBy",
    targetKey: "id",
    as: "createdByAdmin",
});

CurrencyExchangeRate.belongsTo(UserModel, {
    foreignKey: "updatedBy",
    targetKey: "id",
    as: "updatedByAdmin",
});

module.exports = CurrencyExchangeRate;
