global.crypto = require('crypto');
const { checkAndPublishStockEvent } = require('./stock-service');
const inventoryEventPublisher = require('./event-publisher');
const logger = require('../../utils/logger');
const express = require('express');

// --- HTTP Health Check Server ---
const app = express();
const PORT = process.env.PORT || 8081;
let server;

function startHealthServer() {
    server = app.listen(PORT, () => {
        logger.info(`🏥 Health check server listening on port ${PORT}`);
    });
}

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'StockMS' });
});

// Graceful shutdown flag
let isShuttingDown = false;

/**
 * Run stock monitoring loop
 */
async function runStockMonitoring() {
    logger.info('==========================================');
    logger.info('StockMS - Inventory Event Producer');
    logger.info('Hospital-D - Serverless Architecture');
    logger.info('==========================================');

    // Start Health Check Server
    startHealthServer();

    // Initialize Event Hub producer
    try {
        await inventoryEventPublisher.initialize();
    } catch (error) {
        logger.error('Failed to initialize publisher on startup', { error: error.message });
        // Don't exit, maybe retry in loop? For now, we continue as checkAndPublish will retry.
    }

    while (!isShuttingDown) {
        try {
            // Check stock and publish event if needed
            const result = await checkAndPublishStockEvent();

            if (result.eventPublished) {
                logger.info(`📤 Event published: ${result.eventId}`);
            }

        } catch (error) {
            logger.error('Error in stock monitoring cycle', {
                error: error.message
            });
        }

        // Wait before next check (default 5 minutes)
        if (!isShuttingDown) {
            const checkInterval = parseInt(process.env.STOCK_CHECK_INTERVAL || '300000');
            logger.info(`Waiting ${checkInterval / 1000}s before next check...`);
            await sleep(checkInterval);
        }
    }

    logger.info('Stock monitoring stopped');
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
    if (isShuttingDown) return;

    isShuttingDown = true;
    logger.info('Shutting down StockMS gracefully...');

    try {
        await inventoryEventPublisher.close();
        if (server) {
            server.close(() => logger.info('Health server closed'));
        }
    } catch (err) {
        logger.error('Error closing resources', { error: err.message });
    }

    logger.info('StockMS shutdown complete');
    process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the service only if run directly
if (require.main === module) {
    runStockMonitoring().catch(error => {
        logger.error('Fatal error in StockMS', { error: error.message });
        process.exit(1);
    });
}

module.exports = { runStockMonitoring };
