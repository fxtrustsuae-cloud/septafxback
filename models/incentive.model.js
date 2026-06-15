const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const Incentives = sequelize.define("Incentives", {
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
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    incentive: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    netDeposit: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    totalDeposit: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    note: {
        type: DataTypes.STRING,
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    timestamps: true,
    tableName: "Incentives",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

module.exports = Incentives;
