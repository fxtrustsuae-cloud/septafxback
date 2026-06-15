const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const SendEmail = sequelize.define(
    "SendEmail",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users",
                key: "id",
            },
        },
        subject: {
            type: DataTypes.STRING,
        },
        mailContent: {
            type: DataTypes.TEXT,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "SendEmails",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

SendEmail.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

module.exports = SendEmail;
