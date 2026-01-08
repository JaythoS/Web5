/**
 * SOAP Notification Bridge
 * Hospital-D - Section B: SOA Integration
 * 
 * Bridge between Alert System and SOAP Service
 * This is called by adapters/notification-adapter.js
 */

const { sendStockUpdate } = require('./soap-service');
const { executeWithRetry } = require('./retry-handler');
const logger = require('../utils/logger');

/**
 * Send stock update with retry logic (wrapper for retry handler)
 * 
 * @param {Object} stockData - Stock information
 * @returns {Promise<Object>} Response with order information
 */
async function sendStockUpdateWithRetry(stockData) {
    return executeWithRetry(
        sendStockUpdate,
        stockData,
        'SOAP StockUpdate'
    );
}

/**
 * Notify external system via SOAP (for notification-adapter)
 * This is the implementation of notifyExternalSystem for SOAP group
 * 
 * @param {Object} alertData - Alert data from alert-manager
 * @returns {Promise<Object>} Notification result
 */
async function notifyExternalSystem(alertData) {
    logger.info('🔔 SOAP: External notification triggered', {
        hospital: alertData.hospital_id,
        severity: alertData.severity,
        daysOfSupply: alertData.days_of_supply
    });

    // Transform alert data to stock data format
    const stockData = {
        currentStock: alertData.current_stock,
        dailyConsumption: alertData.daily_consumption,
        daysOfSupply: alertData.days_of_supply
    };

    // Send stock update with retry logic
    const result = await sendStockUpdateWithRetry(stockData);

    logger.info(`✅ SOAP notification sent successfully (${result.latency}ms)`, {
        success: result.success,
        orderTriggered: result.orderTriggered
    });

    if (result.orderTriggered) {
        logger.info(`📦 Order created via SOAP: ${result.order?.order_id}`);
    }

    return {
        success: result.success,
        message: result.message,
        latency: result.latency,
        orderTriggered: result.orderTriggered,
        order: result.order,
        architecture: 'SOA'
    };
}

module.exports = {
    sendStockUpdateWithRetry,
    notifyExternalSystem
};
