const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const AdminPermission = sequelize.define(
    "AdminPermission",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id",
            },
        },
        permission: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "AdminPermissions",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

module.exports = AdminPermission;
