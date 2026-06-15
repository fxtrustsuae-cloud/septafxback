const { DataTypes } = require("sequelize");
const MarketingModel = require("../models/marketingUser.model");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const User = sequelize.define("User", {
    fromUser: {
        type: DataTypes.INTEGER,
        references: {
            model: "Users", // References the Users table
            key: "id",
        },
    },
    profileImage: {
        type: DataTypes.STRING,
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        defaultValue: ""
    },
    country: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    countryCode: {
        type: DataTypes.STRING,
        defaultValue: "+91"
    },
    mobile: {
        type: DataTypes.STRING,
        // unique: true
    },
    role: {
        type: DataTypes.ENUM("USER", "ADMIN", "SUPER-ADMIN", "IB", "SUB-ADMIN"),
        defaultValue: "USER",
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true,
        select: false
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    dob: {
        type: DataTypes.DATE,
    },
    gender: {
        type: DataTypes.ENUM("M", "F", "T"),
    },
    address: {
        type: DataTypes.STRING,
    },
    isEmailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isMobileVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isKycVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isBankVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isMfaAdded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    securityMethods: {
        type: DataTypes.ENUM("EMAIL", "MOBILE", "GOOGLE-AUTH"),
        defaultValue: "EMAIL"
    },
    isIb: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isSubIb: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    assingToManager: {
        type: DataTypes.INTEGER,
        references: {
            model: "MarketingUsers", // References the Users table
            key: "id",
        },
    },
    isDepositeAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isWithdrawlAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isTransferAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isIbWithdrawlAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isMt5DepositAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isMt5WithdrawlAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isComissionAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isPromotionalAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    defaultScope: {
        attributes: {
            exclude: ["password"],
        },
    },
    scopes: {
        withPassword: {
            attributes: {
                include: ["password"],
            },
        },
    },
    timestamps: true,
    tableName: "Users",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

User.belongsTo(User, {
    foreignKey: "fromUser",
    targetKey: 'id',
    as: "parent"
});
User.belongsTo(MarketingModel, {
    foreignKey: "assingToManager",
    targetKey: 'id',
    as: "sales"
});

User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

module.exports = User;
