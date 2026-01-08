const inventoryEventPublisher = require('./event-publisher');
const { getCurrentStock } = require('../../core/database/db-operations');
const { logEvent } = require('../../core/database/db-operations');
const { checkThresholdBreach } = require('../../core/stock/stock-tracker');
const logger = require('../../utils/logger');
const config = require('../../config/config');

/**
 * Check stock level and publish event if needed
 * @returns {Promise<Object>} Result
 */
async function checkAndPublishStockEvent() {
    try {
        logger.info('Checking stock level...');

        // Get current stock
        const stock = await getCurrentStock(config.hospital.productCode || 'PHYSIO-SALINE-500ML');

        if (!stock) {
            throw new Error(`Stock data not found for product: ${config.hospital.productCode}`);
        }

        logger.info('Current stock status', {
            currentStock: stock.current_stock_units,
            dailyConsumption: stock.daily_consumption_units,
            daysOfSupply: stock.days_of_supply
        });

        // Check threshold
        const thresholdBreached = checkThresholdBreach(
            parseFloat(stock.days_of_supply),
            config.hospital.reorderThreshold
        );

        if (!thresholdBreached) {
            logger.info('Stock level sufficient, no event published');
            return {
                eventPublished: false,
                daysOfSupply: stock.days_of_supply
            };
        }

        // Threshold breached - publish event
        logger.warn('⚠️  Stock threshold breached! Publishing event...');

        const eventData = buildInventoryLowEvent(stock);

        // Publish event
        const latency = await inventoryEventPublisher.publishInventoryLowEvent(eventData);

        // Log to database
        await logEvent(
            'INVENTORY_EVENT_PUBLISHED',
            'OUTGOING',
            'SERVERLESS',  // ← CRITICAL: SERVERLESS architecture
            eventData,
            'SUCCESS',
            latency
        );

        logger.info('Event published and logged successfully');

        return {
            eventPublished: true,
            eventId: eventData.eventId,
            daysOfSupply: stock.days_of_supply,
            latency
        };

    } catch (error) {
        logger.error('Failed to check and publish stock event', {
            error: error.message
        });

        // Log failure
        await logEvent(
            'INVENTORY_EVENT_PUBLISHED',
            'OUTGOING',
            'SERVERLESS',
            { error: error.message },
            'FAILURE',
            0,
            error.message
        );

        throw error;
    }
}

/**
 * Build InventoryLowEvent message
 * @param {Object} stock - Stock data
 * @returns {Object} Event data
 */
function buildInventoryLowEvent(stock) {
    return {
        eventId: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        eventType: 'InventoryLow',
        hospitalId: config.hospital.id || 'Hospital-D', // Corrected config path from doc
        productCode: config.hospital.productCode || stock.product_code,
        currentStockUnits: parseInt(stock.current_stock_units),
        dailyConsumptionUnits: parseInt(stock.daily_consumption_units),
        daysOfSupply: parseFloat(stock.days_of_supply),
        threshold: parseFloat(config.hospital.reorderThreshold),
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    checkAndPublishStockEvent,
    buildInventoryLowEvent
};
