const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import your Sequelize instance

const Permission = sequelize.define(
    "Permission",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "MarketingUsers", // Ensure this matches your User model table name
                key: "id",
            },
        },
        role: {
            type: DataTypes.ENUM("MANAGER", "MARKETING"),
            // allowNull: false,
        },
        permission: {
            type: DataTypes.STRING, // e.g., "add-member", "view-members"
            // allowNull: false,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Permissions",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

module.exports = Permission;