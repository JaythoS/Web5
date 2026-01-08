/**
 * Database Seed Script
 * Loads initial stock data for Hospital-D
 * 
 * Usage: npm run seed
 */

const db = require('./connection');
const logger = require('../../utils/logger');
const config = require('../../config/config');

/**
 * Initial stock data for Hospital-D
 * In real scenario, this would come from Team 1's Excel dataset
 */
const INITIAL_DATA = {
    hospital_id: 'Hospital-D',
    product_code: 'PHYSIO-SALINE-500ML',
    current_stock_units: 104,  // From dataset (example)
    daily_consumption_units: 52,  // From dataset
    days_of_supply: 2.0,  // Calculated: 104 / 52
    reorder_threshold: 2.0,
    max_stock_level: 520  // daily_consumption * 10
};

/**
 * Insert initial stock data
 */
async function seedStock() {
    const query = `
    INSERT INTO stock (
      hospital_id,
      product_code,
      current_stock_units,
      daily_consumption_units,
      days_of_supply,
      reorder_threshold,
      max_stock_level
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (hospital_id, product_code) 
    DO UPDATE SET
      current_stock_units = EXCLUDED.current_stock_units,
      daily_consumption_units = EXCLUDED.daily_consumption_units,
      days_of_supply = EXCLUDED.days_of_supply,
      last_updated = CURRENT_TIMESTAMP
    RETURNING *
  `;

    const values = [
        INITIAL_DATA.hospital_id,
        INITIAL_DATA.product_code,
        INITIAL_DATA.current_stock_units,
        INITIAL_DATA.daily_consumption_units,
        INITIAL_DATA.days_of_supply,
        INITIAL_DATA.reorder_threshold,
        INITIAL_DATA.max_stock_level
    ];

    try {
        const result = await db.query(query, values);
        logger.info('✅ Stock data seeded successfully', {
            hospital_id: result.rows[0].hospital_id,
            product_code: result.rows[0].product_code,
            current_stock: result.rows[0].current_stock_units,
            days_of_supply: result.rows[0].days_of_supply
        });
        return result.rows[0];
    } catch (error) {
        logger.error('❌ Failed to seed stock data', { error: error.message });
        throw error;
    }
}

/**
 * Main seed function
 */
async function main() {
    logger.info('🌱 Starting database seed...');
    logger.info(`Hospital: ${config.hospital.id}`);
    logger.info(`Product: ${config.product.code}`);

    try {
        // Test database connection
        const connected = await db.testConnection();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        // Seed stock data
        await seedStock();

        logger.info('🎉 Database seeding completed successfully!');
        logger.info('');
        logger.info('Next steps:');
        logger.info('1. Check database: psql -U postgres -d hospital_d_db -c "SELECT * FROM stock;"');
        logger.info('2. Run tests: npm test');
        logger.info('3. Start application: npm start');

    } catch (error) {
        logger.error('💥 Seed failed:', error);
        process.exit(1);
    } finally {
        await db.closeConnection();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { seedStock, INITIAL_DATA };
