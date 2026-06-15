const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const IB = sequelize.define("IB", {
    userId: {
        type: DataTypes.INTEGER,
        // allowNull: false,
        references: {
            model: "Users", // References the Users table
            key: "id",
        },
    },
    name: {
        type: DataTypes.STRING,
        // allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        // allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        },
    },
    mobile: {
        type: DataTypes.STRING,
        // allowNull: false,
        unique: true
    },
    country: {
        type: DataTypes.STRING,
        // allowNull: false
    },
    tradingExperienceLevel: {
        type: DataTypes.ENUM("BEGINER", "INTERMEDIATE", "ADVANCED", "EXPRET")
    },
    expectedClintsPerMonths: {
        type: DataTypes.ENUM("1-5 CLIENTS", "6-10 CLIENTS", "11-20 CLIENTS", "21-50 CLIENTS", "50+ CLIENTS")
    },
    networkSize: {
        type: DataTypes.ENUM("SMALL", "MEDIUM", "LARGE", "MASSIVE")
    },
    monthlyIncomeGoal: {
        type: DataTypes.ENUM("1000-5000", "5000-10000", "10000-25000", "25000-50000", "50000+")
    },
    instagram: {
        type: DataTypes.STRING
    },
    facebook: {
        type: DataTypes.STRING
    },
    linkedin: {
        type: DataTypes.STRING
    },
    tweeterX: {
        type: DataTypes.STRING
    },
    youtube: {
        type: DataTypes.STRING
    },
    tiktok: {
        type: DataTypes.STRING
    },
    whyWantToBecomeIb: {
        type: DataTypes.TEXT
    },
    howYouAcquireClients: {
        type: DataTypes.TEXT
    },
    whatsYourDreamLuxuryReward: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.ENUM( "PENDING", "APPROVED", "PROCESSING", "REJECTED" ),
        allowNull: false,
        defaultValue: "PENDING"
    },
    remark: {
        type: DataTypes.STRING,
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    timestamps: true,
    tableName: "IBs",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

IB.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

module.exports = IB;
