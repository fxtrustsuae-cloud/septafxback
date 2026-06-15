const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");
const UserModel = require("./users.model");
const MasterTraderModel = require("./masterTrader.model");

const MasterTraderReview = sequelize.define(
    "MasterTraderReview",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id",
            },
        },
        masterTraderId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "MasterTraders",
                key: "id",
            },
        },
        rating: {
            type: DataTypes.DECIMAL(2, 1),
            allowNull: false,
            validate: {
                min: 1,
                max: 5,
            },
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM("APPROVED", "PENDING", "REJECTED"),
            defaultValue: "APPROVED",
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "MasterTraderReviews",
        timestamps: true,
        underscored: true,
        paranoid: true,
        indexes: [
            {
                fields: ["master_trader_id", "status", "is_deleted"],
                name: "idx_review_master_status",
            },
            {
                fields: ["user_id", "master_trader_id", "is_deleted"],
                name: "idx_review_user_master",
            },
        ],
    }
);

MasterTraderReview.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: "id",
    as: "user",
});

MasterTraderReview.belongsTo(MasterTraderModel, {
    foreignKey: "masterTraderId",
    targetKey: "id",
    as: "masterTrader",
});

module.exports = MasterTraderReview;
