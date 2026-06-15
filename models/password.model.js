const { DataTypes } = require("sequelize");
const UserModel = require("./users.model");
const sequelize = require("../config/db.config"); // Import Sequelize instance
const {
    decryptPasswordList,
    encryptPasswordList,
    redactPasswordList,
} = require("../utils/credentialSecurity");

const Password = sequelize.define(
    "Password",
    {
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "Users", // Make sure this matches your actual User model's table name
                key: "id",
            },
        },
        passwordList: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            get() {
                return decryptPasswordList(this.getDataValue("passwordList"));
            },
            set(value) {
                this.setDataValue("passwordList", encryptPasswordList(value));
            },
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        tableName: "Password",
        timestamps: true,       // Adds createdAt & updatedAt
        underscored: true,      // Converts camelCase to snake_case
        paranoid: true,         // Enables soft deletes (adds deletedAt column)
    }
);

Password.belongsTo(UserModel, {
    foreignKey: "userId",
    targetKey: 'id',
    as: "user"
});

Password.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.passwordList = redactPasswordList(values.passwordList);
    return values;
};

module.exports = Password;
