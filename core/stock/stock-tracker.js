/**
 * Stock Tracker Module
 * Hospital-D Supply Chain Management
 * 
 * SHARED MODULE - Used by both SOAP and Serverless groups
 * 
 * Handles stock level calculations and threshold monitoring
 */

const { updateStock } = require('../database/db-operations');
const logger = require('../../utils/logger');

/**
 * Calculate days of supply
 * Formula: currentStock / dailyConsumption
 * 
 * @param {number} currentStock - Current stock units
 * @param {number} dailyConsumption - Daily consumption rate
 * @returns {number} Days of supply (rounded to 2 decimals)
 */
function getDaysOfSupply(currentStock, dailyConsumption) {
    // Edge case: zero consumption
    if (dailyConsumption === 0) {
        logger.warn('Daily consumption is zero, returning max value');
        return Number.MAX_VALUE;
    }

    // Edge case: negative stock
    if (currentStock < 0) {
        throw new Error('Current stock cannot be negative');
    }

    // Calculate and round to 2 decimal places
    const days = currentStock / dailyConsumption;
    return Math.round(days * 100) / 100;
}

/**
 * Check if stock is below threshold
 * Default threshold: 2.0 days
 * 
 * @param {number} daysOfSupply - Calculated days of supply
 * @param {number} threshold - Threshold value (default: 2.0)
 * @returns {boolean} true if below threshold, false otherwise
 */
function checkThresholdBreach(daysOfSupply, threshold = 2.0) {
    return daysOfSupply < threshold;
}

/**
 * Update stock level in database
 * Automatically calculates days of supply
 * 
 * @param {number} newStock - New stock amount
 * @param {number} dailyConsumption - Daily consumption rate
 * @param {string} productCode - Product code (optional)
 * @returns {Promise<Object>} Updated stock record
 */
async function updateStockLevel(newStock, dailyConsumption, productCode = 'PHYSIO-SALINE-500ML') {
    try {
        // Calculate days of supply
        const daysOfSupply = getDaysOfSupply(newStock, dailyConsumption);

        // Update database
        const updatedStock = await updateStock(newStock, dailyConsumption, daysOfSupply, productCode);

        logger.info('Stock level updated', {
            productCode,
            newStock,
            dailyConsumption,
            daysOfSupply
        });

        return {
            newStock,
            dailyConsumption,
            daysOfSupply,
            thresholdBreached: checkThresholdBreach(daysOfSupply)
        };
    } catch (error) {
        logger.error('Failed to update stock level', { error: error.message });
        throw error;
    }
}

/**
 * Get stock status summary
 * 
 * @param {number} currentStock
 * @param {number} dailyConsumption
 * @returns {Object} Stock status
 */
function getStockStatus(currentStock, dailyConsumption) {
    const daysOfSupply = getDaysOfSupply(currentStock, dailyConsumption);
    const thresholdBreached = checkThresholdBreach(daysOfSupply);

    let status = 'SUFFICIENT';
    if (daysOfSupply === 0) {
        status = 'OUT_OF_STOCK';
    } else if (daysOfSupply < 0.5) {
        status = 'CRITICAL';
    } else if (daysOfSupply < 1.0) {
        status = 'URGENT';
    } else if (daysOfSupply < 2.0) {
        status = 'LOW';
    }

    return {
        currentStock,
        dailyConsumption,
        daysOfSupply,
        thresholdBreached,
        status
    };
}

module.exports = {
    getDaysOfSupply,
    checkThresholdBreach,
    updateStockLevel,
    getStockStatus
};
