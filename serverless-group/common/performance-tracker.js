/**
 * Performance Tracking Module
 * Specific for Serverless Architecture analytics
 */

const { query } = require('../../core/database/connection');
const logger = require('../../utils/logger');

/**
 * Get performance metrics for Serverless architecture
 * @param {number} hours - Lookback period in hours
 * @returns {Promise<Object>} Performance metrics
 */
async function getServerlessPerformanceMetrics(hours = 24) {
    const sql = `
        SELECT 
            SUM(CASE WHEN event_type = 'INVENTORY_EVENT_PUBLISHED' THEN 1 ELSE 0 END) as events_published_count,
            SUM(CASE WHEN event_type = 'INVENTORY_EVENT_PUBLISHED' AND status = 'SUCCESS' THEN 1 ELSE 0 END) as events_success,
            SUM(CASE WHEN event_type = 'INVENTORY_EVENT_PUBLISHED' AND status = 'FAILURE' THEN 1 ELSE 0 END) as events_failure,
            AVG(CASE WHEN event_type = 'INVENTORY_EVENT_PUBLISHED' AND latency_ms IS NOT NULL THEN latency_ms ELSE NULL END) as avg_publish_latency,
            
            SUM(CASE WHEN event_type = 'ORDER_RECEIVED' THEN 1 ELSE 0 END) as orders_received_count,
            SUM(CASE WHEN event_type = 'ORDER_RECEIVED' AND status = 'SUCCESS' THEN 1 ELSE 0 END) as orders_success,
            SUM(CASE WHEN event_type = 'ORDER_RECEIVED' AND status = 'FAILURE' THEN 1 ELSE 0 END) as orders_failure,
            AVG(CASE WHEN event_type = 'ORDER_RECEIVED' AND latency_ms IS NOT NULL THEN latency_ms ELSE NULL END) as avg_order_latency
        FROM event_log
        WHERE architecture = 'SERVERLESS'
          AND timestamp > NOW() - INTERVAL '${hours} hours'
    `;

    try {
        const result = await query(sql);
        const metrics = result.rows[0];

        // Format numbers
        return {
            events_published_count: parseInt(metrics.events_published_count || 0),
            events_success: parseInt(metrics.events_success || 0),
            events_failure: parseInt(metrics.events_failure || 0),
            avg_publish_latency: parseFloat(metrics.avg_publish_latency || 0).toFixed(2),

            orders_received_count: parseInt(metrics.orders_received_count || 0),
            orders_success: parseInt(metrics.orders_success || 0),
            orders_failure: parseInt(metrics.orders_failure || 0),
            avg_order_latency: parseFloat(metrics.avg_order_latency || 0).toFixed(2)
        };
    } catch (error) {
        logger.error('Failed to get serverless metrics', { error: error.message });
        throw error;
    }
}

/**
 * Log performance summary to console
 */
async function logPerformanceSummary() {
    try {
        const metrics = await getServerlessPerformanceMetrics();

        logger.info('📊 SERVERLESS INTEGRATION PERFORMANCE SUMMARY (24h)', {
            events: {
                total: metrics.events_published_count,
                successRate: calculateRate(metrics.events_success, metrics.events_published_count),
                avgLatency: `${metrics.avg_publish_latency}ms`
            },
            orders: {
                total: metrics.orders_received_count,
                successRate: calculateRate(metrics.orders_success, metrics.orders_received_count),
                avgLatency: `${metrics.avg_order_latency}ms`
            }
        });
    } catch (error) {
        // Warning only, don't crash
        logger.warn('Could not generate performance summary', { error: error.message });
    }
}

function calculateRate(success, total) {
    if (total === 0) return '0%';
    return `${((success / total) * 100).toFixed(1)}%`;
}

module.exports = {
    getServerlessPerformanceMetrics,
    logPerformanceSummary
};
