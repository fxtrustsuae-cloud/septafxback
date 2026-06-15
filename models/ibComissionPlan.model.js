const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const GroupModel = require("./group.model");
const IbComissionPlanNameModel = require("./ibComissionPlanName.model");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const IbComissionPlan = sequelize.define("IbComissionPlan", {
    planId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "IbComissionPlanNames",
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
    planType: {
        type: DataTypes.ENUM("IB-COMISSION-MODEL", "REBET-MODEL", "GLOBAL-MODEL"),
        defaultValue: "IB-COMISSION-MODEL",
    },
    ibId: {
        type: DataTypes.INTEGER,
        references: {
            model: "Users", // References the Users table
            key: "id",
        }
    },
    symbolExtension: {
        type: DataTypes.STRING
    },
    cfdMetals: {
        type: DataTypes.JSON, // store array as JSON
        allowNull: true,
        defaultValue: []
    },
    cfdFx: {
        type: DataTypes.JSON, // store array as JSON
        allowNull: true,
        defaultValue: []
    },
    ibComission: {
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
    tableName: "IbComissionPlans",
    underscored: true,
    paranoid: true,
});

IbComissionPlan.belongsTo(UserModel, {
    foreignKey: "ibId",
    targetKey: 'id',
    as: "ib"
});
IbComissionPlan.belongsTo(GroupModel, {
    foreignKey: "groupId",
    targetKey: 'id',
    as: "group"
});
IbComissionPlan.belongsTo(IbComissionPlanNameModel, {
    foreignKey: "planId",
    targetKey: 'id',
    as: "plan"
});

module.exports = IbComissionPlan;
