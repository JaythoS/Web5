/**
 * Performance Tracker Module
 * Hospital-D - Section B: SOA Integration
 * 
 * Tracks and analyzes SOAP performance metrics
 */

const { query } = require('../core/database/connection');
const logger = require('../utils/logger');

/**
 * Get SOAP performance metrics for a time period
 * 
 * @param {number} hours - Hours to look back (default: 24)
 * @returns {Promise<Object>} Performance metrics
 */
async function getSOAPPerformanceMetrics(hours = 24) {
    const sql = `
        SELECT 
            COUNT(*) as total_calls,
            COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
            COUNT(*) FILTER (WHERE status = 'FAILURE') as failure_count,
            ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / NULLIF(COUNT(*), 0), 2) as success_rate,
            ROUND(AVG(latency_ms), 2) as avg_latency,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency,
            MIN(latency_ms) as min_latency,
            MAX(latency_ms) as max_latency,
            ROUND(COUNT(*)::numeric / NULLIF(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))), 0) * 60, 2) as requests_per_minute
        FROM event_log
        WHERE architecture = 'SOA'
            AND event_type = 'STOCK_UPDATE_SENT'
            AND timestamp > NOW() - INTERVAL '${hours} hours'
            AND latency_ms IS NOT NULL;
    `;

    try {
        const result = await query(sql);

        if (result.rows.length === 0 || result.rows[0].total_calls === '0') {
            logger.warn('No SOAP metrics found for the specified time period');
            return {
                total_calls: 0,
                success_count: 0,
                failure_count: 0,
                success_rate: 0,
                avg_latency: null,
                p50_latency: null,
                p95_latency: null,
                p99_latency: null,
                min_latency: null,
                max_latency: null,
                requests_per_minute: 0,
                time_period_hours: hours
            };
        }

        const metrics = {
            ...result.rows[0],
            time_period_hours: hours,
            timestamp: new Date().toISOString()
        };

        return metrics;

    } catch (error) {
        logger.error('Failed to get SOAP performance metrics', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Get SOAP call history
 * 
 * @param {number} limit - Number of records to fetch (default: 100)
 * @returns {Promise<Array>} Call history
 */
async function getSOAPCallHistory(limit = 100) {
    const sql = `
        SELECT 
            log_id,
            event_type,
            status,
            latency_ms,
            timestamp,
            error_message,
            payload::json->>'daysOfSupply' as days_of_supply,
            payload::json->>'currentStockUnits' as current_stock,
            payload::json->>'dailyConsumptionUnits' as daily_consumption
        FROM event_log
        WHERE architecture = 'SOA'
            AND event_type = 'STOCK_UPDATE_SENT'
        ORDER BY timestamp DESC
        LIMIT $1;
    `;

    try {
        const result = await query(sql, [limit]);
        return result.rows;

    } catch (error) {
        logger.error('Failed to get SOAP call history', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Get latency trend over time
 * 
 * @param {number} hours - Hours to look back
 * @param {string} bucketSize - Time bucket size ('hour' or 'minute')
 * @returns {Promise<Array>} Latency trend data
 */
async function getLatencyTrend(hours = 24, bucketSize = 'hour') {
    const truncFunction = bucketSize === 'minute' ? 'minute' : 'hour';

    const sql = `
        SELECT 
            DATE_TRUNC('${truncFunction}', timestamp) as time_bucket,
            COUNT(*) as call_count,
            ROUND(AVG(latency_ms), 2) as avg_latency,
            ROUND(MIN(latency_ms), 2) as min_latency,
            ROUND(MAX(latency_ms), 2) as max_latency,
            COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
            COUNT(*) FILTER (WHERE status = 'FAILURE') as failure_count
        FROM event_log
        WHERE architecture = 'SOA'
            AND event_type = 'STOCK_UPDATE_SENT'
            AND timestamp > NOW() - INTERVAL '${hours} hours'
            AND latency_ms IS NOT NULL
        GROUP BY time_bucket
        ORDER BY time_bucket DESC;
    `;

    try {
        const result = await query(sql);
        return result.rows;

    } catch (error) {
        logger.error('Failed to get latency trend', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Get order statistics from SOA calls
 * 
 * @param {number} hours - Hours to look back
 * @returns {Promise<Object>} Order statistics
 */
async function getOrderStatistics(hours = 24) {
    const sql = `
        SELECT 
            COUNT(*) as total_orders,
            COUNT(*) FILTER (WHERE order_status = 'PENDING') as pending_orders,
            COUNT(*) FILTER (WHERE order_status = 'RECEIVED') as received_orders,
            COUNT(*) FILTER (WHERE order_status = 'DELIVERED') as delivered_orders,
            COUNT(*) FILTER (WHERE priority = 'URGENT') as urgent_orders,
            COUNT(*) FILTER (WHERE priority = 'HIGH') as high_priority_orders,
            COUNT(*) FILTER (WHERE priority = 'NORMAL') as normal_priority_orders,
            ROUND(AVG(order_quantity), 2) as avg_order_quantity,
            MIN(order_quantity) as min_order_quantity,
            MAX(order_quantity) as max_order_quantity
        FROM orders
        WHERE source = 'SOA'
            AND created_at > NOW() - INTERVAL '${hours} hours';
    `;

    try {
        const result = await query(sql);

        if (result.rows.length === 0 || result.rows[0].total_orders === '0') {
            return {
                total_orders: 0,
                pending_orders: 0,
                received_orders: 0,
                delivered_orders: 0,
                urgent_orders: 0,
                high_priority_orders: 0,
                normal_priority_orders: 0,
                avg_order_quantity: null,
                min_order_quantity: null,
                max_order_quantity: null,
                time_period_hours: hours
            };
        }

        return {
            ...result.rows[0],
            time_period_hours: hours,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error('Failed to get order statistics', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Log performance summary to console
 * 
 * @param {number} hours - Hours to look back
 */
async function logPerformanceSummary(hours = 24) {
    try {
        const metrics = await getSOAPPerformanceMetrics(hours);
        const orderStats = await getOrderStatistics(hours);

        logger.info('==========================================');
        logger.info('SOAP PERFORMANCE SUMMARY (Last ${hours} hours)');
        logger.info('==========================================');
        logger.info(`Total Calls: ${metrics.total_calls}`);
        logger.info(`Success Rate: ${metrics.success_rate}%`);
        logger.info(`  - Successes: ${metrics.success_count}`);
        logger.info(`  - Failures: ${metrics.failure_count}`);
        logger.info('');
        logger.info('Latency Statistics:');
        logger.info(`  - Average: ${metrics.avg_latency}ms`);
        logger.info(`  - P50 (Median): ${metrics.p50_latency}ms`);
        logger.info(`  - P95: ${metrics.p95_latency}ms`);
        logger.info(`  - P99: ${metrics.p99_latency}ms`);
        logger.info(`  - Min: ${metrics.min_latency}ms`);
        logger.info(`  - Max: ${metrics.max_latency}ms`);
        logger.info('');
        logger.info(`Throughput: ${metrics.requests_per_minute} req/min`);
        logger.info('');
        logger.info('Order Statistics:');
        logger.info(`  - Total Orders: ${orderStats.total_orders}`);
        logger.info(`  - Pending: ${orderStats.pending_orders}`);
        logger.info(`  - Received: ${orderStats.received_orders}`);
        logger.info(`  - Delivered: ${orderStats.delivered_orders}`);
        logger.info('');
        logger.info(`  - Urgent: ${orderStats.urgent_orders}`);
        logger.info(`  - High Priority: ${orderStats.high_priority_orders}`);
        logger.info(`  - Normal: ${orderStats.normal_priority_orders}`);
        logger.info('');
        logger.info(`  - Avg Quantity: ${orderStats.avg_order_quantity}`);
        logger.info('==========================================');

    } catch (error) {
        logger.error('Failed to log performance summary', {
            error: error.message
        });
    }
}

/**
 * Compare SOA vs Serverless performance
 * 
 * @param {number} hours - Hours to look back
 * @returns {Promise<Object>} Comparison data
 */
async function compareArchitectures(hours = 24) {
    const sql = `
        SELECT 
            architecture,
            COUNT(*) as total_calls,
            ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SUCCESS') / NULLIF(COUNT(*), 0), 2) as success_rate,
            ROUND(AVG(latency_ms), 2) as avg_latency,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
            MIN(latency_ms) as min_latency,
            MAX(latency_ms) as max_latency
        FROM event_log
        WHERE architecture IN ('SOA', 'SERVERLESS')
            AND event_type IN ('STOCK_UPDATE_SENT', 'INVENTORY_EVENT_PUBLISHED')
            AND timestamp > NOW() - INTERVAL '${hours} hours'
            AND latency_ms IS NOT NULL
        GROUP BY architecture;
    `;

    try {
        const result = await query(sql);
        return result.rows;

    } catch (error) {
        logger.error('Failed to compare architectures', {
            error: error.message
        });
        throw error;
    }
}

module.exports = {
    getSOAPPerformanceMetrics,
    getSOAPCallHistory,
    getLatencyTrend,
    getOrderStatistics,
    logPerformanceSummary,
    compareArchitectures
};
