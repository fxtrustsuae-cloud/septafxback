const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Transaction = sequelize.define(
    "Transaction",
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
        },
        transactionType: {
            type: DataTypes.ENUM(
                "CLIENT-DEPOSIT",
                "CLIENT-WITHDRAW",
                "WALLET-DEPOSIT",
                "WALLET-WITHDRAW",
                "INTERNAL-DEPOSIT",
                "INTERNAL-WITHDRAW",
                "CREDIT-DEPOSIT",
                "CREDIT-WITHDRAW", 
                "BONUS-DEPOSIT",
                "BONUS-WITHDRAW",
                "IB-WITHDRAW",
                "INTERNAL-TRANSFER",
                "DEPOSIT",
                "WITHDRAW",
                "IB-COMISSION"
            )
        },
        paymentMethods: {
            type: DataTypes.ENUM("BANK", "CASH", "CRYPTO", "E-PAY")
        },
        referrenceNo: {
            type: DataTypes.STRING
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false,
            default: 0
        },
        status: {
            type: DataTypes.ENUM( "PENDING", "COMPLETED", "PROCESSING", "REJECTED" ),
            allowNull: false,
            defaultValue: "COMPLETED"
        },
        remark: {
            type: DataTypes.TEXT,
        },
        expireAt: {
            type: DataTypes.DATE,
        },
        admin: {
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
        tableName: "transactions",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

Transaction.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});
Transaction.belongsTo(UserModel, {
    foreignKey: "admin",
    targetKey: 'id',
    as: "byAdmin"
});

module.exports = Transaction;
