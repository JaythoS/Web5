/**
 * Database CRUD Operations
 * Hospital-D Supply Chain Management
 * 
 * CRITICAL: insertOrder() requires 'source' parameter (SOA/SERVERLESS)
 * CRITICAL: logEvent() requires 'architecture' parameter (SOA/SERVERLESS)
 */

const db = require('./connection');
const logger = require('../../utils/logger');

// =====================================================
// STOCK OPERATIONS
// =====================================================

/**
 * Get current stock by product code
 * @param {string} productCode - Default: PHYSIO-SALINE-500ML
 * @returns {Promise<Object|null>} Stock record
 */
async function getCurrentStock(productCode = 'PHYSIO-SALINE-500ML') {
    const query = `
    SELECT * FROM stock 
    WHERE hospital_id = 'Hospital-D' 
      AND product_code = $1
    LIMIT 1
  `;

    try {
        const result = await db.query(query, [productCode]);
        return result.rows[0] || null;
    } catch (error) {
        logger.error('Failed to get current stock', { productCode, error: error.message });
        throw error;
    }
}

/**
 * Update stock levels
 * @param {number} currentStock - New stock amount
 * @param {number} dailyConsumption - Daily consumption rate
 * @param {number} daysOfSupply - Calculated days remaining
 * @param {string} productCode - Default: PHYSIO-SALINE-500ML
 * @returns {Promise<Object>} Updated stock record
 */
async function updateStock(currentStock, dailyConsumption, daysOfSupply, productCode = 'PHYSIO-SALINE-500ML') {
    const query = `
    UPDATE stock
    SET current_stock_units = $1,
        daily_consumption_units = $2,
        days_of_supply = $3,
        last_updated = CURRENT_TIMESTAMP
    WHERE hospital_id = 'Hospital-D'
      AND product_code = $4
    RETURNING *
  `;

    try {
        const result = await db.query(query, [currentStock, dailyConsumption, daysOfSupply, productCode]);

        if (result.rows.length === 0) {
            throw new Error(`Stock record not found for product: ${productCode}`);
        }

        logger.info('Stock updated', {
            productCode,
            currentStock,
            daysOfSupply
        });

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update stock', { error: error.message });
        throw error;
    }
}

// =====================================================
// ORDER OPERATIONS
// CRITICAL: source parameter is MANDATORY!
// =====================================================

/**
 * Insert new order
 * @param {Object} orderData - Order information
 * @param {string} source - CRITICAL! Must be 'SOA' or 'SERVERLESS'
 * @returns {Promise<Object>} Inserted order record
 * @throws {Error} If source is not provided or invalid
 */
async function insertOrder(orderData, source) {
    // CRITICAL VALIDATION
    if (!source || !['SOA', 'SERVERLESS'].includes(source)) {
        throw new Error(`Invalid source parameter: ${source}. Must be 'SOA' or 'SERVERLESS'`);
    }

    const query = `
    INSERT INTO orders (
      order_id, command_id, hospital_id, product_code,
      order_quantity, priority, order_status,
      estimated_delivery_date, warehouse_id, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

    const values = [
        orderData.order_id,
        orderData.command_id || null,
        orderData.hospital_id || 'Hospital-D',
        orderData.product_code,
        orderData.order_quantity,
        orderData.priority,
        orderData.order_status || 'PENDING',
        orderData.estimated_delivery_date,
        orderData.warehouse_id || 'CENTRAL-WAREHOUSE',
        source  // CRITICAL: source from parameter
    ];

    try {
        const result = await db.query(query, values);

        logger.info('Order inserted', {
            order_id: orderData.order_id,
            source,  // Log which group created this
            priority: orderData.priority
        });

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to insert order', {
            order_id: orderData.order_id,
            source,
            error: error.message
        });
        throw error;
    }
}

/**
 * Get orders by source (SOA or SERVERLESS)
 * Used for performance comparison
 * @param {string} source - 'SOA' or 'SERVERLESS'
 * @returns {Promise<Array>} Orders from specified source
 */
async function getOrdersBySource(source) {
    const query = `
    SELECT * FROM orders
    WHERE hospital_id = 'Hospital-D'
      AND source = $1
    ORDER BY created_at DESC
  `;

    try {
        const result = await db.query(query, [source]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get orders by source', { source, error: error.message });
        throw error;
    }
}

/**
 * Get all orders
 * @returns {Promise<Array>} All orders
 */
async function getAllOrders() {
    const query = `
    SELECT * FROM orders
    WHERE hospital_id = 'Hospital-D'
    ORDER BY created_at DESC
  `;

    try {
        const result = await db.query(query);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get all orders', { error: error.message });
        throw error;
    }
}

/**
 * Update order status
 * @param {string} orderId
 * @param {string} newStatus - PENDING/RECEIVED/DELIVERED
 * @param {Date} actualDeliveryDate - Optional
 * @returns {Promise<Object>} Updated order
 */
async function updateOrderStatus(orderId, newStatus, actualDeliveryDate = null) {
    const query = `
    UPDATE orders
    SET order_status = $1,
        actual_delivery_date = $2
    WHERE order_id = $3
    RETURNING *
  `;

    try {
        const result = await db.query(query, [newStatus, actualDeliveryDate, orderId]);

        if (result.rows.length === 0) {
            throw new Error(`Order not found: ${orderId}`);
        }

        logger.info('Order status updated', { orderId, newStatus });
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to update order status', { error: error.message });
        throw error;
    }
}

// =====================================================
// EVENT LOG OPERATIONS
// CRITICAL: architecture parameter is MANDATORY!
// =====================================================

/**
 * Log an event
 * @param {string} eventType - STOCK_UPDATE_SENT/INVENTORY_EVENT_PUBLISHED/ORDER_RECEIVED
 * @param {string} direction - OUTGOING/INCOMING
 * @param {string} architecture - CRITICAL! Must be 'SOA' or 'SERVERLESS'
 * @param {Object} payload - Event data (will be JSON stringified)
 * @param {string} status - SUCCESS/FAILURE
 * @param {number} latencyMs - Optional latency in milliseconds
 * @param {string} errorMessage - Optional error message
 * @returns {Promise<Object>} Inserted log record
 * @throws {Error} If architecture is not provided or invalid
 */
async function logEvent(eventType, direction, architecture, payload, status, latencyMs = null, errorMessage = null) {
    // CRITICAL VALIDATION
    if (!architecture || !['SOA', 'SERVERLESS'].includes(architecture)) {
        throw new Error(`Invalid architecture parameter: ${architecture}. Must be 'SOA' or 'SERVERLESS'`);
    }

    const query = `
    INSERT INTO event_log (
      event_type, direction, architecture, payload,
      status, latency_ms, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

    const payloadString = payload ? JSON.stringify(payload) : null;

    const values = [
        eventType,
        direction,
        architecture,  // CRITICAL: architecture from parameter
        payloadString,
        status,
        latencyMs,
        errorMessage
    ];

    try {
        const result = await db.query(query, values);

        logger.debug('Event logged', {
            eventType,
            architecture,  // Log which architecture generated this
            status,
            latencyMs
        });

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to log event', {
            eventType,
            architecture,
            error: error.message
        });
        throw error;
    }
}

/**
 * Get events by architecture (SOA or SERVERLESS)
 * Used for performance analysis
 * @param {string} architecture - 'SOA' or 'SERVERLESS'
 * @param {number} limit - Max number of events to return
 * @returns {Promise<Array>} Events from specified architecture
 */
async function getEventsByArchitecture(architecture, limit = 100) {
    const query = `
    SELECT * FROM event_log
    WHERE architecture = $1
    ORDER BY timestamp DESC
    LIMIT $2
  `;

    try {
        const result = await db.query(query, [architecture, limit]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get events by architecture', { architecture, error: error.message });
        throw error;
    }
}

/**
 * Get events by date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>} Events in date range
 */
async function getEventsByDateRange(startDate, endDate) {
    const query = `
    SELECT * FROM event_log
    WHERE timestamp BETWEEN $1 AND $2
    ORDER BY timestamp DESC
  `;

    try {
        const result = await db.query(query, [startDate, endDate]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get events by date range', { error: error.message });
        throw error;
    }
}

// =====================================================
// CONSUMPTION OPERATIONS
// =====================================================

/**
 * Insert consumption record
 * @param {Object} consumptionData - Consumption information
 * @returns {Promise<Object>} Inserted consumption record
 */
async function insertConsumption(consumptionData) {
    const query = `
    INSERT INTO consumption_history (
      hospital_id, product_code, consumption_date,
      units_consumed, opening_stock, closing_stock,
      day_of_week, is_weekend, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (hospital_id, product_code, consumption_date)
    DO UPDATE SET 
      units_consumed = EXCLUDED.units_consumed,
      closing_stock = EXCLUDED.closing_stock,
      notes = EXCLUDED.notes
    RETURNING *
  `;

    const values = [
        consumptionData.hospital_id || 'Hospital-D',
        consumptionData.product_code,
        consumptionData.consumption_date,
        consumptionData.units_consumed,
        consumptionData.opening_stock,
        consumptionData.closing_stock,
        consumptionData.day_of_week,
        consumptionData.is_weekend,
        consumptionData.notes || null
    ];

    try {
        const result = await db.query(query, values);

        logger.debug('Consumption recorded', {
            date: consumptionData.consumption_date,
            consumed: consumptionData.units_consumed
        });

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to insert consumption', { error: error.message });
        throw error;
    }
}

/**
 * Get average consumption over N days
 * @param {number} days - Number of days (7 or 30)
 * @param {string} productCode
 * @returns {Promise<number>} Average daily consumption
 */
async function getAverageConsumption(days = 7, productCode = 'PHYSIO-SALINE-500ML') {
    const query = `
    SELECT AVG(units_consumed) as average_consumption
    FROM consumption_history
    WHERE hospital_id = 'Hospital-D'
      AND product_code = $1
      AND consumption_date >= CURRENT_DATE - INTERVAL '${days} days'
  `;

    try {
        const result = await db.query(query, [productCode]);
        const avg = parseFloat(result.rows[0].average_consumption) || 0;
        return Math.round(avg * 100) / 100;  // 2 decimal places
    } catch (error) {
        logger.error('Failed to get average consumption', { error: error.message });
        throw error;
    }
}

/**
 * Get consumption history
 * @param {number} days - Number of days
 * @param {string} productCode
 * @returns {Promise<Array>} Consumption records
 */
async function getConsumptionHistory(days = 30, productCode = 'PHYSIO-SALINE-500ML') {
    const query = `
    SELECT * FROM consumption_history
    WHERE hospital_id = 'Hospital-D'
      AND product_code = $1
      AND consumption_date >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY consumption_date DESC
  `;

    try {
        const result = await db.query(query, [productCode]);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get consumption history', { error: error.message });
        throw error;
    }
}

// =====================================================
// ALERT OPERATIONS
// =====================================================

/**
 * Insert alert
 * @param {Object} alertData - Alert information
 * @returns {Promise<Object>} Inserted alert record
 */
async function insertAlert(alertData) {
    const query = `
    INSERT INTO alerts (
      hospital_id, alert_type, severity,
      current_stock, daily_consumption, days_of_supply,
      threshold
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

    const values = [
        alertData.hospital_id || 'Hospital-D',
        alertData.alert_type,
        alertData.severity,
        alertData.current_stock,
        alertData.daily_consumption,
        alertData.days_of_supply,
        alertData.threshold
    ];

    try {
        const result = await db.query(query, values);

        logger.warn('Alert created', {
            alert_type: alertData.alert_type,
            severity: alertData.severity,
            days_of_supply: alertData.days_of_supply
        });

        return result.rows[0];
    } catch (error) {
        logger.error('Failed to insert alert', { error: error.message });
        throw error;
    }
}

/**
 * Get unacknowledged alerts
 * @returns {Promise<Array>} Unacknowledged alerts
 */
async function getUnacknowledgedAlerts() {
    const query = `
    SELECT * FROM alerts
    WHERE hospital_id = 'Hospital-D'
      AND acknowledged = FALSE
    ORDER BY created_at DESC
  `;

    try {
        const result = await db.query(query);
        return result.rows;
    } catch (error) {
        logger.error('Failed to get unacknowledged alerts', { error: error.message });
        throw error;
    }
}

/**
 * Acknowledge an alert
 * @param {number} alertId
 * @returns {Promise<Object>} Updated alert
 */
async function acknowledgeAlert(alertId) {
    const query = `
    UPDATE alerts
    SET acknowledged = TRUE,
        acknowledged_at = CURRENT_TIMESTAMP
    WHERE alert_id = $1
    RETURNING *
  `;

    try {
        const result = await db.query(query, [alertId]);

        if (result.rows.length === 0) {
            throw new Error(`Alert not found: ${alertId}`);
        }

        logger.info('Alert acknowledged', { alertId });
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to acknowledge alert', { error: error.message });
        throw error;
    }
}

module.exports = {
    // Stock
    getCurrentStock,
    updateStock,

    // Orders (CRITICAL: insertOrder requires source parameter)
    insertOrder,
    getOrdersBySource,
    getAllOrders,
    updateOrderStatus,

    // Event Log (CRITICAL: logEvent requires architecture parameter)
    logEvent,
    getEventsByArchitecture,
    getEventsByDateRange,

    // Consumption
    insertConsumption,
    getAverageConsumption,
    getConsumptionHistory,

    // Alerts
    insertAlert,
    getUnacknowledgedAlerts,
    acknowledgeAlert
};
