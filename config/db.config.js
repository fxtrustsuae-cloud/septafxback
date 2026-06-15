const { Sequelize } = require("sequelize");
const { buildSequelizeConnection } = require("./postgres.connection");

const connection = buildSequelizeConnection();

const sequelize = connection.useConnectionString
    ? new Sequelize(connection.connectionString, connection.options)
    : new Sequelize(
        connection.database,
        connection.username,
        connection.password,
        connection.options
    );

module.exports = sequelize;
