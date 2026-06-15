const { DataTypes } = require("sequelize");
const GroupModel = require("./group.model");
const sequelize = require("../config/db.config"); // adjust path as needed

const IbComissionPlanName = sequelize.define("IbComissionPlanName", {
    planName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // groupId: {
    //     type: DataTypes.INTEGER,
    //     allowNull: false,
    //     references: {
    //         model: "Groups",
    //         key: "id"
    //     }
    // },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    tableName: "IbComissionPlanNames",
    underscored: true,
    paranoid: true
});

// IbComissionPlanName.belongsTo(GroupModel, {
//     foreignKey: "groupId",
//     targetKey: 'id',
//     as: "group"
// });

module.exports = IbComissionPlanName;
