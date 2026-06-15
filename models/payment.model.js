const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Payment = sequelize.define(
    "Payment",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Make sure this matches your actual User model's table name
                key: "id",
            },
        },
        socketId: {
            type: DataTypes.STRING
        },
        cregisId: {
            type: DataTypes.STRING,
        },
        amount: {
            type: DataTypes.FLOAT,
        },
        startTime: {
            type: DataTypes.STRING
        },
        expireTime: {
            type: DataTypes.STRING
        },
        currency: {
            type: DataTypes.STRING
        },
        paymentAddress: {
            type: DataTypes.STRING
        },
        tokenSymbol: {
            type: DataTypes.STRING
        },
        blockchain: {
            type: DataTypes.STRING
        },
        tokenName: {
            type: DataTypes.STRING
        },
        tokenDecimal: {
            type: DataTypes.STRING
        },
        login: {
            type: DataTypes.STRING
        },
        status: {
            type: DataTypes.ENUM("PENDING", "COMPLETED", "FAILED"),
            defaultValue: "PENDING"
        },
        remark: {
            type: DataTypes.TEXT
        },
        paymentType: {
            type: DataTypes.ENUM("CRYPTO", "CARD"),
            defaultValue: "CRYPTO"
        },
        orderId: {
            type: DataTypes.STRING,
        },
        merchantId: {
            type: DataTypes.STRING,
        },
        customerId: {
            type: DataTypes.STRING
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Payments",
        timestamps: true,       // Adds createdAt & updatedAt
        underscored: true,      // Converts camelCase to snake_case
        paranoid: true,         // Enables soft deletes (adds deletedAt column)
    }
);

module.exports = Payment;
