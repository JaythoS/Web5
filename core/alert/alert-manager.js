/**
 * Alert Manager Module
 * Hospital-D Supply Chain Management
 * 
 * SHARED MODULE - Used by both SOAP and Serverless groups
 * 
 * Determines alert severity and creates alert records
 * Does NOT handle external notifications (that's group-specific)
 */

const { insertAlert } = require('../database/db-operations');
const logger = require('../../utils/logger');

/**
 * Determine alert severity based on days of supply
 * 
 * Severity Levels:
 * - CRITICAL: 0 days (OUT_OF_STOCK) or < 0.5 days (CRITICAL_STOCK)
 * - URGENT: 0.5 - 1.0 days (CRITICAL_STOCK)
 * - HIGH: 1.0 - 2.0 days (LOW_STOCK)
 * - NORMAL: >= 2.0 days (SUFFICIENT_STOCK)
 * 
 * @param {number} daysOfSupply - Days of supply remaining
 * @returns {Object} Alert type and severity
 */
function determineSeverity(daysOfSupply) {
    if (daysOfSupply === 0) {
        return {
            alertType: 'OUT_OF_STOCK',
            severity: 'CRITICAL'
        };
    }

    if (daysOfSupply < 0.5) {
        return {
            alertType: 'CRITICAL_STOCK',
            severity: 'CRITICAL'
        };
    }

    if (daysOfSupply >= 0.5 && daysOfSupply < 1.0) {
        return {
            alertType: 'CRITICAL_STOCK',
            severity: 'URGENT'
        };
    }

    if (daysOfSupply >= 1.0 && daysOfSupply < 2.0) {
        return {
            alertType: 'LOW_STOCK',
            severity: 'HIGH'
        };
    }

    // daysOfSupply >= 2.0
    return {
        alertType: 'SUFFICIENT_STOCK',
        severity: 'NORMAL'
    };
}

/**
 * Create alert and save to database
 * 
 * @param {number} currentStock - Current stock level
 * @param {number} dailyConsumption - Daily consumption rate
 * @param {number} daysOfSupply - Calculated days of supply
 * @returns {Promise<Object>} Created alert data
 */
async function createAlert(currentStock, dailyConsumption, daysOfSupply) {
    try {
        // Determine severity
        const { alertType, severity } = determineSeverity(daysOfSupply);

        // Create alert data
        const alertData = {
            hospital_id: 'Hospital-D',
            alert_type: alertType,
            severity: severity,
            current_stock: currentStock,
            daily_consumption: dailyConsumption,
            days_of_supply: daysOfSupply,
            threshold: 2.0,
            timestamp: new Date().toISOString()
        };

        // Save to database
        const savedAlert = await insertAlert(alertData);

        // Log alert creation
        logger.warn('⚠️  ALERT TRIGGERED', {
            alertType,
            severity,
            currentStock,
            daysOfSupply: Number(daysOfSupply).toFixed(2)
        });

        return {
            ...alertData,
            alert_id: savedAlert.alert_id
        };
    } catch (error) {
        logger.error('Failed to create alert', { error: error.message });
        throw error;
    }
}

/**
 * Get alert message for user display
 * 
 * @param {string} alertType
 * @param {number} daysOfSupply
 * @returns {string} Human-readable alert message
 */
function getAlertMessage(alertType, daysOfSupply) {
    const messages = {
        'OUT_OF_STOCK': '🔴 CRITICAL: Stock depleted! Immediate action required.',
        'CRITICAL_STOCK': `🔴 CRITICAL: Only ${daysOfSupply.toFixed(1)} days of supply remaining!`,
        'LOW_STOCK': `🟡 WARNING: Low stock - ${daysOfSupply.toFixed(1)} days remaining.`,
        'SUFFICIENT_STOCK': `🟢 OK: Stock sufficient (${daysOfSupply.toFixed(1)} days).`
    };

    return messages[alertType] || 'Unknown alert type';
}

/**
 * Determine recommended order quantity
 * Based on max stock level and current stock
 * 
 * @param {number} currentStock - Current stock
 * @param {number} maxStockLevel - Maximum stock level
 * @returns {number} Recommended order quantity
 */
function getRecommendedOrderQuantity(currentStock, maxStockLevel) {
    const orderQty = Math.max(0, maxStockLevel - currentStock);
    return Math.ceil(orderQty / 10) * 10; // Round up to nearest 10
}

module.exports = {
    determineSeverity,
    createAlert,
    getAlertMessage,
    getRecommendedOrderQuantity
};
