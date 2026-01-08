/**
 * Alert System (Orchestrator)
 * Hospital-D Supply Chain Management
 * 
 * SHARED MODULE - Used by both SOAP and Serverless groups
 * 
 * Coordinates stock checking, alert creation, and external notifications
 * 
 * ⚠️  CRITICAL INTEGRATION POINT:
 * This module calls notifyExternalSystem() from the adapter
 * Each group must implement their own version!
 */

const { getCurrentStock } = require('../database/db-operations');
const { checkThresholdBreach } = require('../stock/stock-tracker');
const { createAlert } = require('./alert-manager');
const logger = require('../../utils/logger');

// Import notification adapter
// ⚠️  THIS IS WHERE GROUPS SPLIT!
// Each group will implement their own version
const { notifyExternalSystem } = require('../../adapters/notification-adapter');

/**
 * Check stock level and trigger alert if needed
 * 
 * This function:
 * 1. Gets current stock from database
 * 2. Checks if threshold is breached
 * 3. Creates alert if needed
 * 4. Calls external notification system (GROUP-SPECIFIC!)
 * 
 * @returns {Promise<Object>} Alert status
 */
async function checkAndTriggerAlert() {
    try {
        // 1. Get current stock
        const stock = await getCurrentStock('PHYSIO-SALINE-500ML');
        if (!stock) {
            throw new Error('Stock record not found');
        }

        const { current_stock_units, daily_consumption_units, days_of_supply } = stock;

        // 2. Check threshold
        const breached = checkThresholdBreach(days_of_supply);

        if (!breached) {
            logger.info('✅ Stock level sufficient, no alert needed', {
                daysOfSupply: days_of_supply
            });
            return {
                alertTriggered: false,
                daysOfSupply: days_of_supply,
                status: 'SUFFICIENT'
            };
        }

        // 3. Threshold breached - create alert
        logger.warn('⚠️  Threshold breach detected!', {
            currentStock: current_stock_units,
            daysOfSupply: days_of_supply,
            threshold: 2.0
        });

        const alertData = await createAlert(
            current_stock_units,
            daily_consumption_units,
            days_of_supply
        );

        // 4. Notify external system
        // ⚠️  THIS IS THE CRITICAL SPLIT POINT!
        // SOAP group: Will call SOAP service
        // Serverless group: Will publish to Event Hub
        try {
            await notifyExternalSystem(alertData);
            logger.info('✅ External system notified successfully');
        } catch (notificationError) {
            // Log error but don't fail the entire process
            logger.error('❌ Failed to notify external system', {
                error: notificationError.message
            });
            // Alert is still saved in database even if notification fails
        }

        return {
            alertTriggered: true,
            alertData,
            daysOfSupply: days_of_supply,
            status: alertData.severity
        };
    } catch (error) {
        logger.error('Failed to check and trigger alert', { error: error.message });
        throw error;
    }
}

/**
 * Manual alert trigger for testing
 * Forces alert creation regardless of stock level
 * 
 * @param {number} currentStock
 * @param {number} dailyConsumption
 * @param {number} daysOfSupply
 * @returns {Promise<Object>} Alert result
 */
async function triggerManualAlert(currentStock, dailyConsumption, daysOfSupply) {
    try {
        logger.info('Manual alert trigger initiated');

        const alertData = await createAlert(currentStock, dailyConsumption, daysOfSupply);

        try {
            await notifyExternalSystem(alertData);
            logger.info('Manual alert sent successfully');
        } catch (notificationError) {
            logger.error('Manual alert notification failed', {
                error: notificationError.message
            });
        }

        return {
            alertTriggered: true,
            alertData,
            manual: true
        };
    } catch (error) {
        logger.error('Failed to trigger manual alert', { error: error.message });
        throw error;
    }
}

module.exports = {
    checkAndTriggerAlert,
    triggerManualAlert
};
