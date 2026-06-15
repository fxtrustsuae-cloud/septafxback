const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const Banner = sequelize.define("Banner", {
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    image: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    admin: {
        type: DataTypes.INTEGER,
        references: {
            model: "Users", // References the Users table
            key: "id",
        },
    }
}, {
    timestamps: true,
    tableName: "Banners",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

module.exports = Banner;
