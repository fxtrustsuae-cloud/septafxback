const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const PaymentCharge = sequelize.define(
    "PaymentCharge",
    {
        chargeType: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "PERCENTAGE",
            validate: { isIn: [["PERCENTAGE", "FIXED"]] },
        },
        chargeValue: {
            type: DataTypes.DECIMAL(10, 4),
            allowNull: false,
            defaultValue: 0,
        },
        status: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: "ACTIVE",
            validate: { isIn: [["ACTIVE", "INACTIVE"]] },
        },
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "Users", key: "id" },
        },
        updatedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "Users", key: "id" },
        },
        applicableFor: {
            type: DataTypes.STRING(15),
            allowNull: false,
            defaultValue: "DEPOSIT",
            validate: { isIn: [["DEPOSIT", "WITHDRAWAL"]] },
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "PaymentCharges",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

// alter: true adds new columns without dropping existing data
PaymentCharge.sync({ alter: true }).catch((err) =>
    console.error("PaymentCharge table sync failed:", err.message)
);

module.exports = PaymentCharge;
