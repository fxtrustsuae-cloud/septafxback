const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const GroupModel = require("./group.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const RequestedMt5Account = sequelize.define(
  "RequestedMt5Account",
  {
    userId: {    // recepient
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "Users", // Ensure this matches your User model table name
            key: "id",
        },
    },
    accountType: {
      type: DataTypes.ENUM("DEMO", "REAL"),
      defaultValue: "REAL",
      allowNull: false,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
          model: "Groups", // Ensure this matches your User model table name
          key: "id",
      },
    },
    groupName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    Leverage: {
      type: DataTypes.STRING,
    },
    Name: {
      type: DataTypes.STRING,
    },
    Country: {
      type: DataTypes.STRING,
    },
    Address: {
      type: DataTypes.STRING,
    },
    Phone: {
      type: DataTypes.STRING,
    },
    Email: {
      type: DataTypes.STRING,
    },    
    status: {
      type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
      defaultValue: "PENDING"
    },
    passMain: {
      type: DataTypes.STRING
    },
    approvedBy: {    // recepient
      type: DataTypes.INTEGER,
      references: {
          model: "Users", // Ensure this matches your User model table name
          key: "id",
      },
  },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
  },
  {
    tableName: "RequestedMt5Accounts",
    timestamps: true,
    paranoid: false, // change to true if you want soft deletes
  }
);

RequestedMt5Account.belongsTo(UserModel, {
  foreignKey: "userId",
  targetKey: 'id',
  as: "user"
});

RequestedMt5Account.belongsTo(UserModel, {
  foreignKey: "approvedBy",
  targetKey: 'id',
  as: "byAdmin"
});

RequestedMt5Account.belongsTo(GroupModel, {
  foreignKey: "groupId",
  targetKey: 'id',
  as: "group"
});

module.exports = RequestedMt5Account;
