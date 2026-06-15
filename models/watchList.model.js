const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const WatchList = sequelize.define(
    "WatchList",
    {
        userId: {
            type: DataTypes.INTEGER,
            references: {
                model: "Users",
                key: "id",
            },
        },
        symbols: {
            type: DataTypes.JSON,  // Stores array of filenames
            defaultValue: [],      // Empty list
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "WatchLists",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

// WatchList.belongsTo(UserModel, {
//     foreignKey: "userId",
//     targetKey: 'id',
//     as: "user"
// });

module.exports = WatchList;
