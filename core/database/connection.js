/**
 * Database Connection Module
 * Hospital-D Supply Chain Management
 * 
 * Manages PostgreSQL connection pool and provides
 * database access methods for the entire application
 */

const { Pool } = require('pg');
const config = require('../../config/config');
const logger = require('../../utils/logger');

// Create connection pool
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.maxConnections || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Connection error handling
pool.on('error', (err) => {
  logger.error('Unexpected database error', err);
  process.exit(-1);
});

/**
 * Get a client from the pool
 * @returns {Promise<PoolClient>}
 */
async function getConnection() {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    logger.error('Failed to get database connection', error);
    throw error;
  }
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', {
      text: text.substring(0, 100),
      duration,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error('Query error', { text, error: error.message });
    throw error;
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as time, current_database() as database');
    logger.info('Database connection successful', {
      database: result.rows[0].database,
      time: result.rows[0].time
    });
    return true;
  } catch (error) {
    logger.error('Database connection failed', error);
    return false;
  }
}

/**
 * Close all connections (graceful shutdown)
 * @returns {Promise<void>}
 */
async function closeConnection() {
  try {
    await pool.end();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections', error);
    throw error;
  }
}

/**
 * Begin a transaction
 * @returns {Promise<PoolClient>}
 */
async function beginTransaction() {
  const client = await getConnection();
  await client.query('BEGIN');
  return client;
}

/**
 * Commit a transaction
 * @param {PoolClient} client
 * @returns {Promise<void>}
 */
async function commitTransaction(client) {
  try {
    await client.query('COMMIT');
    client.release();
  } catch (error) {
    await rollbackTransaction(client);
    throw error;
  }
}

/**
 * Rollback a transaction
 * @param {PoolClient} client
 * @returns {Promise<void>}
 */
async function rollbackTransaction(client) {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  getConnection,
  testConnection,
  closeConnection,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  pool
};
