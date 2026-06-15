const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config");

const CompanyBankDetail = sequelize.define(
    "CompanyBankDetail",
    {
        accountHolderName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        bankName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        accountNo: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ifscCode: {
            type: DataTypes.STRING,
        },
        ibanNo: {
            type: DataTypes.STRING,
        },
        swiftCode: {
            type: DataTypes.STRING,
        },
        branchName: {
            type: DataTypes.STRING,
        },
        bankAddress: {
            type: DataTypes.STRING,
        },
        country: {
            type: DataTypes.STRING,
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
        tableName: "CompanyBankDetails",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

CompanyBankDetail.belongsTo(UserModel, {
    foreignKey: "createdBy",
    targetKey: "id",
    as: "createdByAdmin",
});

CompanyBankDetail.belongsTo(UserModel, {
    foreignKey: "updatedBy",
    targetKey: "id",
    as: "updatedByAdmin",
});

module.exports = CompanyBankDetail;
