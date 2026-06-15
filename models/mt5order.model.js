const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Mt5Order = sequelize.define(
    "Mt5Order",
    {
        ibId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Ensure this matches your User model table name
                key: "id",
            },
        },
        mt5GroupId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        comissionPlanId: {
            type: DataTypes.INTEGER,
            references: {
                model: "IbComissionPlans", // Ensure this matches your User model table name
                key: "id",
            },
        },
        level: {
            type: DataTypes.INTEGER,
        },
        Deal: { type: DataTypes.STRING },
        ExternalID: { type: DataTypes.STRING },
        Login: { type: DataTypes.STRING },
        Dealer: { type: DataTypes.STRING },
        Order: { type: DataTypes.STRING },
        Action: { type: DataTypes.STRING },
        Entry: { type: DataTypes.STRING },
        Reason: { type: DataTypes.STRING },
        Digits: { type: DataTypes.STRING },
        DigitsCurrency: { type: DataTypes.STRING },
        ContractSize: { type: DataTypes.STRING },
        Time: { type: DataTypes.STRING },
        TimeMsc: { type: DataTypes.STRING },
        Symbol: { type: DataTypes.STRING },
        Price: { type: DataTypes.STRING },
        Volume: { type: DataTypes.STRING },
        VolumeExt: { type: DataTypes.STRING },
        Profit: { type: DataTypes.STRING },
        Storage: { type: DataTypes.STRING },
        Commission: { type: DataTypes.STRING },
        Fee: { type: DataTypes.STRING },
        RateProfit: { type: DataTypes.STRING },
        RateMargin: { type: DataTypes.STRING },
        ExpertID: { type: DataTypes.STRING },
        PositionID: {
            type: DataTypes.STRING,
            unique: true,
        },
        Comment: { type: DataTypes.STRING },
        ProfitRaw: { type: DataTypes.STRING },
        PricePosition: { type: DataTypes.STRING },
        PriceSL: { type: DataTypes.STRING },
        PriceTP: { type: DataTypes.STRING },
        VolumeClosed: { type: DataTypes.STRING },
        VolumeClosedExt: { type: DataTypes.STRING },
        TickValue: { type: DataTypes.STRING },
        TickSize: { type: DataTypes.STRING },
        Flags: { type: DataTypes.STRING },
        Gateway: { type: DataTypes.STRING },
        PriceGateway: { type: DataTypes.STRING },
        VolumeGatewayExt: { type: DataTypes.STRING },
        ActionGateway: { type: DataTypes.STRING },
        ModifyFlags: { type: DataTypes.STRING },
        Value: { type: DataTypes.STRING },
        isComissionDistributed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        baseSymbol: {
            type: DataTypes.STRING
        },
        extension: {
            type: DataTypes.STRING
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Mt5Orders",
        timestamps: true,
        underscored: true,
        paranoid: true,
    }
);

const UserModel = require("./users.model");

Mt5Order.belongsTo(UserModel, {
    foreignKey: "userId",
    as: "user",
});

Mt5Order.belongsTo(UserModel, {
    foreignKey: "ibId",
    as: "ib",
});

module.exports = Mt5Order;
