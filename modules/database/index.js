const { Pool } = require('pg');
const { buildPgPoolConfig } = require('../../config/postgres.connection');

const pool = new Pool(buildPgPoolConfig());

module.exports = { pool };
