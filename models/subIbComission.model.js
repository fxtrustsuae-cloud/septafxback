const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const GroupModel = require("./group.model");
const IbComissionModel = require("./ibComissionPlan.model");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const SubIbComission = sequelize.define("SubIbComission", {
    ibPlanId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "IbComissionPlans",
            key: "id"
        }
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Groups",
            key: "id"
        }
    },
    subIbId: {
        type: DataTypes.INTEGER,
        references: {
            model: "Users", // References the Users table
            key: "id",
        }
    },
    ibId: {
        type: DataTypes.INTEGER,
        references: {
            model: "Users", // References the Users table
            key: "id",
        }
    },
    comission: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    timestamps: true,
    tableName: "SubIbComissions",
    underscored: true,
    paranoid: true,
});

SubIbComission.belongsTo(UserModel, {
    foreignKey: "subIbId",
    targetKey: 'id',
    as: "ib"
});
SubIbComission.belongsTo(GroupModel, {
    foreignKey: "groupId",
    targetKey: 'id',
    as: "group"
});
SubIbComission.belongsTo(IbComissionModel, {
    foreignKey: "ibPlanId",
    targetKey: 'id',
    as: "plan"
});

module.exports = SubIbComission;
