/**
 * Message Builder Module
 * Hospital-D - Section B: SOA Integration
 * 
 * Builds SOAP request messages with validation
 */

const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Build StockUpdateRequest message for SOAP call
 * 
 * @param {Object} stockData - Stock information
 * @param {number} stockData.currentStock - Current stock units
 * @param {number} stockData.dailyConsumption - Daily consumption units
 * @param {number} stockData.daysOfSupply - Days of supply remaining
 * @returns {Object} SOAP request message
 */
function buildStockUpdateRequest(stockData) {
    // Validate required fields
    if (typeof stockData.currentStock === 'undefined') {
        throw new Error('Missing required field: currentStock');
    }

    if (typeof stockData.dailyConsumption === 'undefined') {
        throw new Error('Missing required field: dailyConsumption');
    }

    // Validate data types and ranges
    if (typeof stockData.currentStock !== 'number' || stockData.currentStock < 0) {
        throw new Error('Invalid currentStock: must be a non-negative number');
    }

    if (typeof stockData.dailyConsumption !== 'number' || stockData.dailyConsumption <= 0) {
        throw new Error('Invalid dailyConsumption: must be a positive number');
    }

    // Calculate daysOfSupply if not provided
    let daysOfSupply = stockData.daysOfSupply;
    if (typeof daysOfSupply === 'undefined') {
        daysOfSupply = stockData.currentStock / stockData.dailyConsumption;
    }

    // Round to 2 decimal places
    daysOfSupply = parseFloat(daysOfSupply.toFixed(2));

    // Build SOAP request according to Team 1's WSDL schema
    const request = {
        hospitalId: config.hospital.hospitalId || 'Hospital-D',
        productCode: config.hospital.productCode || 'PHYSIO-SALINE-500ML',
        currentStockUnits: parseInt(stockData.currentStock),
        dailyConsumptionUnits: parseInt(stockData.dailyConsumption),
        daysOfSupply: daysOfSupply,
        timestamp: new Date().toISOString()
    };

    logger.debug('📦 StockUpdateRequest built', request);

    return request;
}

/**
 * Build CreateOrderRequest message (if needed for manual orders)
 * 
 * @param {Object} orderData - Order information
 * @param {number} orderData.quantity - Order quantity
 * @param {string} orderData.priority - Priority level (URGENT, HIGH, NORMAL)
 * @returns {Object} SOAP request message
 */
function buildCreateOrderRequest(orderData) {
    // Validate required fields
    if (!orderData.quantity || orderData.quantity <= 0) {
        throw new Error('Invalid quantity: must be a positive number');
    }

    // Validate priority
    const validPriorities = ['URGENT', 'HIGH', 'NORMAL'];
    const priority = (orderData.priority || 'HIGH').toUpperCase();
    if (!validPriorities.includes(priority)) {
        throw new Error(`Invalid priority: must be one of ${validPriorities.join(', ')}`);
    }

    const request = {
        hospitalId: config.hospital.hospitalId || 'Hospital-D',
        productCode: config.hospital.productCode || 'PHYSIO-SALINE-500ML',
        orderQuantity: parseInt(orderData.quantity),
        priority: priority
    };

    logger.debug('📦 CreateOrderRequest built', request);

    return request;
}

/**
 * Validate SOAP response structure
 * 
 * @param {Object} response - SOAP response
 * @returns {boolean} true if valid
 */
function validateStockUpdateResponse(response) {
    if (!response) {
        throw new Error('Response is null or undefined');
    }

    // Check required fields
    if (typeof response.success !== 'boolean') {
        throw new Error('Response missing required field: success (boolean)');
    }

    if (typeof response.message !== 'string') {
        throw new Error('Response missing required field: message (string)');
    }

    if (typeof response.orderTriggered !== 'boolean') {
        throw new Error('Response missing required field: orderTriggered (boolean)');
    }

    // If order was triggered, orderId should be present
    if (response.orderTriggered && !response.orderId) {
        logger.warn('⚠️  Order triggered but orderId is missing in response');
    }

    return true;
}

module.exports = {
    buildStockUpdateRequest,
    buildCreateOrderRequest,
    validateStockUpdateResponse
};
