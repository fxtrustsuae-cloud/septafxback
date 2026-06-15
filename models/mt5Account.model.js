const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const GroupModel = require("./group.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Mt5Account = sequelize.define(
  "Mt5Account",
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
    Login: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
          model: "Groups", // Ensure this matches your User model table name
          key: "id",
      },
    },
    CertSerialNumber: {
      type: DataTypes.STRING,
    },
    Rights: {
      type: DataTypes.STRING,
    },
    MQID: {
      type: DataTypes.STRING,
    },
    Registration: {
      type: DataTypes.STRING,
    },
    LastAccess: {
      type: DataTypes.STRING,
    },
    LastPassChange: {
      type: DataTypes.STRING,
    },
    LastIP: {
      type: DataTypes.STRING,
    },
    Name: {
      type: DataTypes.STRING,
    },
    FirstName: {
      type: DataTypes.STRING,
    },
    LastName: {
      type: DataTypes.STRING,
    },
    MiddleName: {
      type: DataTypes.STRING,
    },
    Company: {
      type: DataTypes.STRING,
    },
    Account: {
      type: DataTypes.STRING,
    },
    Country: {
      type: DataTypes.STRING,
    },
    Language: {
      type: DataTypes.STRING,
    },
    ClientID: {
      type: DataTypes.STRING,
    },
    City: {
      type: DataTypes.STRING,
    },
    State: {
      type: DataTypes.STRING,
    },
    ZipCode: {
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
    ID: {
      type: DataTypes.STRING,
    },
    Status: {
      type: DataTypes.STRING,
    },
    Comment: {
      type: DataTypes.STRING,
    },
    Color: {
      type: DataTypes.STRING,
    },
    defaultSymbol: {
      type: DataTypes.STRING
    },
    PhonePassword: {
      type: DataTypes.STRING,
    },
    Leverage: {
      type: DataTypes.STRING,
    },
    Agent: {
      type: DataTypes.STRING,
    },
    LimitPositions: {
      type: DataTypes.STRING,
    },
    LimitOrders: {
      type: DataTypes.STRING,
    },
    CurrencyDigits: {
      type: DataTypes.STRING,
    },
    Balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    Credit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    InterestRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.0,
    },
    CommissionDaily: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    CommissionMonthly: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    CommissionAgentDaily: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    CommissionAgentMonthly: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    BalancePrevDay: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    BalancePrevMonth: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    EquityPrevDay: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    EquityPrevMonth: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.0,
    },
    TradeAccounts: {
      type: DataTypes.STRING,
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
  },
  {
    tableName: "Mt5Accounts",
    timestamps: true,
    paranoid: false, // change to true if you want soft deletes
  }
);

Mt5Account.belongsTo(UserModel, {
  foreignKey: "userId",
  targetKey: 'id',
  as: "user"
});

Mt5Account.belongsTo(GroupModel, {
  foreignKey: "groupId",
  targetKey: 'id',
  as: "group"
});

module.exports = Mt5Account;
