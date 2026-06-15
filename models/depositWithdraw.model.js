const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const { BankDetails: BankDetailsModel, Documents: DocumentModel } = require("./kyc.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const DepositWithdraw = sequelize.define(
    "DepositWithdraw",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // References the Users table
                key: "id",
            },
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2), // Supports large amounts with 2 decimal places
            allowNull: false,
            validate: {
                min: 0.01, // Ensures amount is positive
            },
        },
        transactionReference: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true, // Ensures unique transaction IDs
        },
        transactionType: {
            type: DataTypes.ENUM("DEPOSIT", "WITHDRAW"),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED", "COMPLETED"),
            allowNull: false,
            defaultValue: "PENDING",
        },
        paymentMethods: {
            type: DataTypes.ENUM("BANK", "CASH", "CRYPTO")
        },
        walletAddress: {
            type: DataTypes.STRING
        },
        network: {
            type: DataTypes.ENUM( "TRON", "BSC", "ETH" ),
        },
        remark: {
            type: DataTypes.TEXT,
            allowNull: true, // Optional field for admin or user notes
        },
        image: {
            type: DataTypes.STRING,
        },
        bankId: {
            type: DataTypes.INTEGER,
            references: {
                model: "BankDetails", // References the Users table
                key: "id",
            },
        },
        approvedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "Users", // References the Users table
                key: "id",
            },
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false, // For soft deletion
        },
    },
    {
        tableName: "DepositWithdraws",
        timestamps: true, // Adds createdAt and updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft deletion with deletedAt
    }
);

DepositWithdraw.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

DepositWithdraw.belongsTo(BankDetailsModel, {
    foreignKey: "bankId",
    targetKey: 'id',
    as: "bank"
});

module.exports = DepositWithdraw;