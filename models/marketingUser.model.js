const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const MarketingUser = sequelize.define("marketingUser", {
    fromManager: {
        type: DataTypes.INTEGER,
        references: {
            model: "MarketingUsers", // References the Users table
            key: "id",
        },
    },
    userName: {
        type: DataTypes.STRING
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        },
    },
    mobile: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    role: {
        type: DataTypes.ENUM("MANAGER", "MARKETING"),
        allowNull: false
    },
    incentive: {
        type: DataTypes.FLOAT,
        // allowNull: false,
        defaultValue: 0
    },
    netDeposit: {
        type: DataTypes.FLOAT,
        // allowNull: false,
        defaultValue: 0
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true,
        select: false
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
    tableName: "MarketingUsers",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

MarketingUser.belongsTo(MarketingUser, {
    foreignKey: "fromManager",
    targetKey: 'id',
    as: "manager"
});

MarketingUser.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

module.exports = MarketingUser;
