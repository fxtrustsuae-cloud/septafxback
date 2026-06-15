const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Robot = sequelize.define(
    "Robot",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        userName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        amount: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        remark: {
            type: DataTypes.STRING,
            defaultValue: "",
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Robots",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

module.exports = Robot;
