const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Promotional = sequelize.define(
    "Promotional",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id",
            },
        },
        isPromotionalAllowed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Promotionals",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);


Promotional.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "userDetails"
});

module.exports = Promotional;
