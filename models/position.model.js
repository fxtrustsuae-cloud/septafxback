const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config"); // Import Sequelize instance

const Position = sequelize.define(
  "Position",
  {
    mt5Group: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users", // Ensure this matches your User model table name
        key: "id",
      },
    },
    level: {
      type: DataTypes.INTEGER,
    },

    // ---- Order / Trade Info ----
    ID: { type: DataTypes.STRING },
    IDClient: { type: DataTypes.STRING },
    Login: { type: DataTypes.STRING },
    SourceLogin: { type: DataTypes.STRING },
    ExternalAccount: { type: DataTypes.STRING },
    IP: { type: DataTypes.STRING },
    Group: { type: DataTypes.STRING },
    Symbol: { type: DataTypes.STRING },
    Digits: { type: DataTypes.STRING },
    Action: { type: DataTypes.STRING },
    TimeExpiration: { type: DataTypes.STRING },
    Type: { type: DataTypes.STRING },
    TypeFill: { type: DataTypes.STRING },
    TypeTime: { type: DataTypes.STRING },
    Flags: { type: DataTypes.STRING },

    Volume: { type: DataTypes.STRING },
    VolumeExt: { type: DataTypes.STRING },

    Order: { type: DataTypes.STRING },
    OrderExternalID: { type: DataTypes.STRING },

    PriceOrder: { type: DataTypes.STRING },
    PriceTrigger: { type: DataTypes.STRING },
    PriceSL: { type: DataTypes.STRING },
    PriceTP: { type: DataTypes.STRING },
    PriceDeviation: { type: DataTypes.STRING },
    PriceDeviationTop: { type: DataTypes.STRING },
    PriceDeviationBottom: { type: DataTypes.STRING },

    Position: { type: DataTypes.STRING },
    PositionExternalID: { type: DataTypes.STRING },
    PositionBy: { type: DataTypes.STRING },
    PositionByExternalID: { type: DataTypes.STRING },

    Comment: { type: DataTypes.STRING },
    SpreadDiff: { type: DataTypes.STRING },
    SpreadDiffBalance: { type: DataTypes.STRING },

    // ---- Result Info ----
    ResultRetcode: { type: DataTypes.STRING },
    ResultDealer: { type: DataTypes.STRING },
    ResultDeal: { type: DataTypes.STRING },
    ResultOrder: { type: DataTypes.STRING },
    ResultVolume: { type: DataTypes.STRING },
    ResultVolumeExt: { type: DataTypes.STRING },
    ResultPrice: { type: DataTypes.STRING },

    ResultDealerBid: { type: DataTypes.STRING },
    ResultDealerAsk: { type: DataTypes.STRING },
    ResultDealerLast: { type: DataTypes.STRING },
    ResultMarketBid: { type: DataTypes.STRING },
    ResultMarketAsk: { type: DataTypes.STRING },
    ResultMarketLast: { type: DataTypes.STRING },
    ResultComment: { type: DataTypes.STRING },

    // ---- Extra Info ----
    DigitsCurrency: { type: DataTypes.STRING },
    ContractSize: { type: DataTypes.STRING },
    State: { type: DataTypes.STRING },
    Reason: { type: DataTypes.STRING },
    TimeSetup: { type: DataTypes.STRING },
    TimeDone: { type: DataTypes.STRING },
    TimeSetupMsc: { type: DataTypes.STRING },
    TimeDoneMsc: { type: DataTypes.STRING },
    ModifyFlags: { type: DataTypes.STRING },

    PriceCurrent: { type: DataTypes.STRING },
    VolumeInitial: { type: DataTypes.STRING },
    VolumeInitialExt: { type: DataTypes.STRING },
    VolumeCurrent: { type: DataTypes.STRING },
    VolumeCurrentExt: { type: DataTypes.STRING },
    ExpertID: { type: DataTypes.STRING },

    PositionID: {
      type: DataTypes.STRING,
      unique: true,
    },
    PositionByID: { type: DataTypes.STRING },
    RateMargin: { type: DataTypes.STRING },
    ActivationMode: { type: DataTypes.STRING },
    ActivationTime: { type: DataTypes.STRING },
    ActivationPrice: { type: DataTypes.STRING },
    ActivationFlags: { type: DataTypes.STRING },

    // ---- Flags ----
    isComissionDistributed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "Positions",
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

module.exports = Position;
