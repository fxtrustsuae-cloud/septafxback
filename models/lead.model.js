const { DataTypes } = require("sequelize");
const MarketingModel = require("../models/marketingUser.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Lead = sequelize.define(
    "Lead",
    {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            },
        },
        mobile: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        country: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.ENUM("INTRESTED", "NOT-INTRESTED", "PROGRESS"),
            allowNull: false
        },
        source: {
            type: DataTypes.ENUM("REFERRAL", "ORGANIC")
        },
        description: {
            type: DataTypes.STRING
        },
        note: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        reminder: {
            type: DataTypes.DATE
        },
        assignTo: {
            type: DataTypes.INTEGER,
            references: {
                model: "MarketingUsers",
                key: "id",
            },
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
    },
    {
        tableName: "Leads",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

Lead.belongsTo(MarketingModel, {
    foreignKey: "assignTo",
    targetKey: 'id',
    as: "sales"
});

module.exports = Lead;
