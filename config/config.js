/**
 * Configuration Module
 * Loads and validates environment variables
 */

require('dotenv').config();

const config = {
    // Hospital Identity
    hospital: {
        id: process.env.HOSPITAL_ID || 'Hospital-D',
        bedCapacity: 300,
        avgDailyConsumption: 52
    },

    // Product Information
    product: {
        code: process.env.PRODUCT_CODE || 'PHYSIO-SALINE-500ML',
        reorderThreshold: parseFloat(process.env.REORDER_THRESHOLD) || 2.0
    },

    // Database Configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        name: process.env.DB_NAME || 'hospital_d_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20
    },

    // SOAP Configuration (for SOAP group)
    soap: {
        wsdlUrl: process.env.SOAP_WSDL_URL || 'http://localhost:8000/StockUpdateService?wsdl',
        endpoint: process.env.SOAP_ENDPOINT || null,
        username: process.env.SOAP_USERNAME || null,
        password: process.env.SOAP_PASSWORD || null,
        timeout: parseInt(process.env.SOAP_TIMEOUT) || 30000
    },

    // Serverless / Event Hub Configuration
    eventHub: {
        connectionString: process.env.EVENT_HUB_CONNECTION_STRING || null,
        inventoryTopic: process.env.EVENT_HUB_INVENTORY_TOPIC || 'inventory-low-events',
        orderTopic: process.env.EVENT_HUB_ORDER_TOPIC || 'order-commands',
        consumerGroup: process.env.CONSUMER_GROUP || 'hospital-d-group'
    },

    // Application Configuration
    app: {
        env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT) || 3000,
        logLevel: process.env.LOG_LEVEL || 'info'
    },

    // Monitoring
    monitoring: {
        enablePerformanceTracking: process.env.ENABLE_PERFORMANCE_TRACKING === 'true'
    }
};

/**
 * Validate critical configuration
 */
function validateConfig() {
    const errors = [];

    // Database validation
    if (!config.database.host) errors.push('DB_HOST is required');
    if (!config.database.name) errors.push('DB_NAME is required');
    if (!config.database.user) errors.push('DB_USER is required');
    if (!config.database.password) errors.push('DB_PASSWORD is required');

    // Hospital validation
    if (!config.hospital.id) errors.push('HOSPITAL_ID is required');
    if (!config.product.code) errors.push('PRODUCT_CODE is required');

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
}

// Validate on load
try {
    validateConfig();
} catch (error) {
    console.error('❌ Configuration Error:', error.message);
    console.error('Please check your .env file');
    process.exit(1);
}

module.exports = config;
