const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const LoginTracking = sequelize.define("LoginTracking", {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Users", // Ensure this matches your User model table name
            key: "id"
        },
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    device: {
        type: DataTypes.STRING,
        allowNull: true
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        // field: "is_deleted"
    }
}, {
    tableName: "LoginTracking",
    timestamps: true, // Includes createdAt & updatedAt
    underscored: true // Converts camelCase to snake_case
});

LoginTracking.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

module.exports = LoginTracking;
