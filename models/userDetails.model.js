const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import the Sequelize instance

const UserDetails = sequelize.define("UserDetails", {
    userId: {
        type: DataTypes.INTEGER,
        references: {
            model: "Users", // References the Users table
            key: "id",
        },
    },
    firstName: {
        type: DataTypes.STRING,
    },
    lastName: {
        type: DataTypes.STRING,
    },
    primaryEmail: {
        type: DataTypes.STRING,
    },
    ccountryName: {
        type: DataTypes.STRING,
    },
    email: {
        type: DataTypes.STRING,
    },
    secondryEmail: {
        type: DataTypes.STRING,
    },
    countryCode: {
        type: DataTypes.STRING,
    },
    mobile: {
        type: DataTypes.STRING,
    },
    gender: {
        type: DataTypes.ENUM("F", "M", "T"),
    },
    assingTo: {
        type: DataTypes.STRING,
    },
    dob: {
        type: DataTypes.DATE,
    },
    gender: {
        type: DataTypes.ENUM("M", "F", "T"),
    },
    walletId: {
        type: DataTypes.STRING,
    },
    nationality: {
        type: DataTypes.STRING,
    },
    leadSource: {
        type: DataTypes.STRING,
    },
    ftd: {
        type: DataTypes.STRING,
    },
    kycStatus: {
        type: DataTypes.STRING,
    },
    isConvertedFromLead: {
        type: DataTypes.STRING,
    },
    loginVerified: {
        type: DataTypes.STRING,
    },
    createdTime: {
        type: DataTypes.STRING,
    },
    modifiedTime: {
        type: DataTypes.STRING,
    },
    source: {
        type: DataTypes.STRING, // Mobile, Web
    },
    isAgree: {
        type: DataTypes.BOOLEAN,
    },
    referenceId: {
        type: DataTypes.STRING,
    },
    whereDidYouFindUs: {
        type: DataTypes.STRING,
    },
    withdrawAllowed: {
        type: DataTypes.STRING,
    },
    lastLoginIp: {
        type: DataTypes.STRING,
    },
    kycFormEdit: {
        type: DataTypes.STRING,
    },
    plainPassword: {
        type: DataTypes.STRING,
    },
    entity: {
        type: DataTypes.STRING,
    },

    // Ib Comission Information
    ibName: {
        type: DataTypes.STRING,
    },
    yearsOfExp: {
        type: DataTypes.STRING,
    },
    noOfExistingClient: {
        type: DataTypes.STRING,
    },
    averageVolumePerMonth: {
        type: DataTypes.STRING,
    },
    ibStatus: {
        type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
    },
    rejectedReason: {
        type: DataTypes.STRING,
    },
    childProfile: {
        type: DataTypes.STRING,
    },
    parentAffliateCode: {
        type: DataTypes.STRING,
    },
    ibLevel: {
        type: DataTypes.STRING,
    },
    ibHierarchy: {
        type: DataTypes.STRING,
    },
    parentProfile: {
        type: DataTypes.STRING,
    },
    parentAffliateCode: {
        type: DataTypes.STRING,
    },
    ibNode: {
        type: DataTypes.STRING,
    },
    distributMaxComission: {
        type: DataTypes.STRING,
    },
    maxIbCommAmtPerLot: {
        type: DataTypes.STRING,
    },
    preferableAssignedUserId: {
        type: DataTypes.STRING,
    },
    comissionPercentage: {
        type: DataTypes.STRING,
    },

    // Customer Portal Details
    portalUser: {
        type: DataTypes.BOOLEAN,
    },
    language: {
        type: DataTypes.STRING,
    },
    timeZone: {
        type: DataTypes.STRING,
    },
    timeFormate: {
        type: DataTypes.STRING,
    },
    dateFormate: {
        type: DataTypes.STRING,
    },
    isSetPreference: {
        type: DataTypes.STRING,
    },

    // Address
    maillingStreet: {
        type: DataTypes.STRING,
    },
    maillingCity: {
        type: DataTypes.STRING,
    },
    maillingState: {
        type: DataTypes.STRING,
    },
    maillingZip: {
        type: DataTypes.STRING,
    },
    maillingPoBox: {
        type: DataTypes.STRING,
    },
    maillingCountry: {
        type: DataTypes.STRING,
    },

    // Prifile
    profileImage: {
        type: DataTypes.STRING,
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
}, {
    timestamps: true,
    tableName: "UserDetails",
    underscored: true, // Converts camelCase to snake_case
    paranoid: true, // Enables soft delete (like isDeleted)
});

UserDetails.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

module.exports = UserDetails;