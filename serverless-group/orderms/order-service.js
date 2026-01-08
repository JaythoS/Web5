const { insertOrder, logEvent } = require('../../core/database/db-operations');
const logger = require('../../utils/logger');
const config = require('../../config/config');

/**
 * Process order creation command
 * @param {Object} commandData - Order command data
 * @returns {Promise<Object>} Processing result
 */
async function processOrderCommand(commandData) {
    const startTime = Date.now();

    try {
        logger.info('Processing order command', {
            commandId: commandData.commandId,
            orderId: commandData.orderId
        });

        // Validate command
        validateOrderCommand(commandData);

        // Filter: Only process orders for this hospital
        const myHospitalId = config.hospital.id || 'Hospital-D';

        if (commandData.hospitalId !== myHospitalId) {
            logger.info('Order not for this hospital, skipping', {
                receivedFor: commandData.hospitalId,
                expectedFor: myHospitalId
            });

            return {
                processed: false,
                reason: 'NOT_FOR_THIS_HOSPITAL'
            };
        }

        // Build order data
        const orderData = {
            order_id: commandData.orderId,
            command_id: commandData.commandId,
            hospital_id: commandData.hospitalId,
            product_code: commandData.productCode,
            order_quantity: commandData.orderQuantity,
            priority: commandData.priority || 'HIGH',
            order_status: 'RECEIVED',
            estimated_delivery_date: commandData.estimatedDeliveryDate,
            warehouse_id: commandData.warehouseId || 'CENTRAL-WAREHOUSE'
        };

        // Insert order with 'SERVERLESS' source
        await insertOrder(orderData, 'SERVERLESS');  // ← CRITICAL: SERVERLESS source

        const latency = Date.now() - startTime;

        // Log event
        await logEvent(
            'ORDER_RECEIVED',
            'INCOMING',
            'SERVERLESS',  // ← CRITICAL: SERVERLESS architecture
            commandData,
            'SUCCESS',
            latency
        );

        logger.info('Order processed successfully', {
            orderId: commandData.orderId,
            quantity: commandData.orderQuantity,
            latency
        });

        return {
            processed: true,
            orderId: commandData.orderId,
            latency
        };

    } catch (error) {
        const latency = Date.now() - startTime;

        logger.error('Failed to process order command', {
            error: error.message,
            commandId: commandData ? commandData.commandId : 'UNKNOWN'
        });

        // Log failure
        await logEvent(
            'ORDER_RECEIVED',
            'INCOMING',
            'SERVERLESS',
            commandData,
            'FAILURE',
            latency,
            error.message
        );

        throw error;
    }
}

/**
 * Validate order command data
 * @param {Object} commandData - Command data
 */
function validateOrderCommand(commandData) {
    if (!commandData) throw new Error('Command data is empty');

    const requiredFields = [
        'commandId',
        'orderId',
        'hospitalId',
        'productCode',
        'orderQuantity'
        // 'priority', 'warehouseId' usually optional or have defaults
    ];

    for (const field of requiredFields) {
        if (!commandData[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    // Validate order quantity
    if (commandData.orderQuantity <= 0) {
        throw new Error('Order quantity must be positive');
    }

    // Validate priority if present
    if (commandData.priority) {
        const validPriorities = ['URGENT', 'HIGH', 'NORMAL'];
        if (!validPriorities.includes(commandData.priority)) {
            throw new Error(`Invalid priority: ${commandData.priority}`);
        }
    }
}

module.exports = {
    processOrderCommand,
    validateOrderCommand
};
