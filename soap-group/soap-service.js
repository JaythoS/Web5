/**
 * SOAP Service Module
 * Hospital-D - Section B: SOA Integration
 * 
 * Main service for sending stock updates to Team 1 via SOAP
 */

const soapClient = require('./soap-client');
const { buildStockUpdateRequest, validateStockUpdateResponse } = require('./message-builder');
const { logEvent, insertOrder } = require('../core/database/db-operations');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Send stock update to Team 1's central platform via SOAP
 * 
 * @param {Object} stockData - Stock information
 * @param {number} stockData.currentStock - Current stock units
 * @param {number} stockData.dailyConsumption - Daily consumption units
 * @param {number} stockData.daysOfSupply - Days of supply (optional, will be calculated)
 * @returns {Promise<Object>} Response with order information if triggered
 */
async function sendStockUpdate(stockData) {
    const startTime = Date.now();
    let latency = 0;

    try {
        logger.info('📤 Sending stock update via SOAP', {
            currentStock: stockData.currentStock,
            dailyConsumption: stockData.dailyConsumption,
            daysOfSupply: stockData.daysOfSupply
        });

        // Build SOAP request message
        const request = buildStockUpdateRequest(stockData);

        logger.debug('📦 SOAP Request built', request);

        // Log attempt (skipped as 'PENDING' status is not allowed by DB schema)
        // We will log the result (SUCCESS/FAILURE) after the call

        // Call SOAP service
        const response = await soapClient.callStockUpdate(request);

        // Calculate latency
        latency = Date.now() - startTime;

        logger.info('✅ SOAP response received', {
            latency,
            success: response.success,
            orderTriggered: response.orderTriggered
        });

        logger.debug('📥 SOAP Response', response);

        // Validate response structure
        validateStockUpdateResponse(response);

        // Process the response
        const result = await processStockUpdateResponse(response, request, latency);

        return result;

    } catch (error) {
        latency = Date.now() - startTime;

        logger.error('❌ SOAP request failed', {
            error: error.message,
            latency,
            stockData
        });

        // Log failure event to database
        await logEvent(
            'STOCK_UPDATE_SENT',
            'OUTGOING',
            'SOA',
            stockData,
            'FAILURE',
            latency,
            error.message
        );

        throw error;
    }
}

/**
 * Process StockUpdate SOAP response
 * 
 * @param {Object} response - SOAP response
 * @param {Object} request - Original request
 * @param {number} latency - Request latency in milliseconds - @returns {Promise<Object>} Processed result
 */
async function processStockUpdateResponse(response, request, latency) {
    // Log successful event to database
    await logEvent(
        'STOCK_UPDATE_SENT',
        'OUTGOING',
        'SOA',
        request,
        'SUCCESS',
        latency,
        null
    );

    const result = {
        success: response.success,
        message: response.message || 'Stock update sent successfully',
        orderTriggered: response.orderTriggered || false,
        latency,
        timestamp: new Date().toISOString()
    };

    // If order was triggered by Team 1, save it to our database
    if (response.orderTriggered && response.orderId) {
        logger.warn('⚠️  Order triggered by central platform!', {
            orderId: response.orderId
        });

        try {
            // Extract order information from response
            const orderData = extractOrderFromResponse(response, request);

            // Insert order into database with 'SOA' source
            await insertOrder(orderData, 'SOA'); // ← CRITICAL: Use 'SOA' source

            // Log incoming order event
            await logEvent(
                'ORDER_RECEIVED',
                'INCOMING',
                'SOA', // ← CRITICAL: Use 'SOA' architecture
                orderData,
                'SUCCESS',
                0, // No latency for incoming order (already measured in SOAP call)
                null
            );

            logger.info('✅ Order saved to database', {
                orderId: response.orderId,
                quantity: orderData.order_quantity,
                priority: orderData.priority
            });

            result.order = orderData;

        } catch (error) {
            logger.error('❌ Failed to save order to database', {
                error: error.message,
                orderId: response.orderId
            });

            // Log order save failure
            await logEvent(
                'ORDER_RECEIVED',
                'INCOMING',
                'SOA',
                { orderId: response.orderId, error: error.message },
                'FAILURE',
                0,
                error.message
            );

            // Don't throw - stock update was successful, just order save failed
            result.orderSaveError = error.message;
        }
    }

    return result;
}

/**
 * Extract order data from SOAP response
 * 
 * @param {Object} response - SOAP response
 * @param {Object} request - Original stock update request
 * @returns {Object} Order data for database
 */
function extractOrderFromResponse(response, request) {
    // Calculate estimated delivery date (e.g., 2 days from now)
    const estimatedDeliveryDate = new Date();
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 2);

    // Determine order quantity (default: 5 days of supply)
    const orderQuantity = calculateOrderQuantity(request.dailyConsumptionUnits);

    // Determine priority based on days of supply
    const priority = determinePriority(request.daysOfSupply);

    return {
        order_id: response.orderId,
        command_id: null, // SOAP orders don't have command_id (that's for serverless)
        hospital_id: config.hospital.hospitalId || 'Hospital-D',
        product_code: config.hospital.productCode || 'PHYSIO-SALINE-500ML',
        order_quantity: orderQuantity,
        priority: priority,
        order_status: 'PENDING',
        estimated_delivery_date: estimatedDeliveryDate.toISOString(),
        actual_delivery_date: null,
        warehouse_id: 'CENTRAL-WAREHOUSE',
        notes: `Auto-triggered by SOA StockUpdate (Days of Supply: ${request.daysOfSupply})`
    };
}

/**
 * Calculate order quantity based on daily consumption
 * 
 * @param {number} dailyConsumption - Daily consumption units
 * @returns {number} Order quantity
 */
function calculateOrderQuantity(dailyConsumption) {
    // Order 5 days worth of supply
    const targetDays = 5;
    const quantity = Math.ceil(dailyConsumption * targetDays);

    // Round to nearest 10 for cleaner numbers
    return Math.ceil(quantity / 10) * 10;
}

/**
 * Determine order priority based on days of supply
 * 
 * @param {number} daysOfSupply - Days of supply remaining
 * @returns {string} Priority level (URGENT, HIGH, NORMAL)
 */
function determinePriority(daysOfSupply) {
    if (daysOfSupply < 0.5) return 'URGENT';
    if (daysOfSupply < 1.0) return 'URGENT';
    if (daysOfSupply < 2.0) return 'HIGH';
    return 'NORMAL';
}

module.exports = {
    sendStockUpdate,
    processStockUpdateResponse,
    extractOrderFromResponse,
    calculateOrderQuantity,
    determinePriority
};
