const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const BankDetails = sequelize.define(
    "BankDetails",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        holderName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        bankName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        accountNo: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ibanNo: {
            type: DataTypes.STRING,
        },
        ifscCode: {
            type: DataTypes.STRING,
        },
        bankAddress: {
            type: DataTypes.STRING,
        },
        country: {
            type: DataTypes.STRING,
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        status: {
            type: DataTypes.ENUM( "PENDING", "APPROVED", "REJECTED" ),
            defaultValue: "PENDING"
        },
        approvedBy: {
            type: DataTypes.INTEGER,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        remark: {
            type: DataTypes.STRING
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "BankDetails",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

const Documents = sequelize.define(
    "Documents",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        poi: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        poa: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        extraDocs: {
            type: DataTypes.JSON,  // Stores array of filenames
            defaultValue: [],      // Empty list
        },
        status: {
            type: DataTypes.ENUM( "PENDING", "APPROVED", "REJECTED" ),
            defaultValue: "PENDING"
        },
        approvedBy: {
            type: DataTypes.INTEGER,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        remark: {
            type: DataTypes.TEXT
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Documents",
        timestamps: true, // Includes createdAt & updatedAt
        underscored: true, // Converts camelCase to snake_case
        paranoid: true, // Enables soft delete (like isDeleted)
    }
);

BankDetails.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

Documents.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

module.exports = { BankDetails, Documents };
