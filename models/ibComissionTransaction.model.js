const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // adjust path as needed
const Mt5OrderModel = require("./mt5order.model");

const IBComissionTransaction = sequelize.define("IBComissionTransaction", {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Users", // Ensure this matches your User model table name
            key: "id",
        },
    },
    loginId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    ibId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Users", // Ensure this matches your User model table name
            key: "id",
        },
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Mt5Orders", // Ensure this matches your User model table name
            key: "id",
        },
    },
    fromUser: {
        type: DataTypes.INTEGER,
        // allowNull: false,
        references: {
            model: "Users", // Ensure this matches your User model table name
            key: "id",
        },
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        allowNull: false
    },
    volume: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        allowNull: false
    },
    comissionAmount: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM("BUY", "SELL"),
        allowNull: false
    },
    level: {
        type: DataTypes.INTEGER,
        // allowNull: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    tableName: "IBComissionTransactions",
    underscored: true,
    paranoid: true
});

IBComissionTransaction.belongsTo(Mt5OrderModel, {
    foreignKey: "orderId",
    targetKey: 'id',
    as: "orderDetails"
});

IBComissionTransaction.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

IBComissionTransaction.belongsTo(UserModel, {
    foreignKey: "ibId",
    targetKey: 'id',
    as: "ibDetails"
});

IBComissionTransaction.belongsTo(UserModel, {
    foreignKey: "fromUser",
    targetKey: 'id',
    as: "fromUserDetails"
});

module.exports = IBComissionTransaction;
