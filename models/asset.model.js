const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Asset = sequelize.define(
    "Asset",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        mainBalance: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        totalDeposit: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        totalMetaDeposit: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        totalWithdrawal: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        totalMetaWithdrawal: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        totalInternalTransfer: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        totalIBIncome: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        totalIBWithdrawl: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Assets",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

Asset.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});


module.exports = Asset;
