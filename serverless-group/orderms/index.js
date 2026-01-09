global.crypto = require('crypto');
const OrderEventConsumer = require('./event-consumer');
const { processOrderCommand } = require('./order-service');
const logger = require('../../utils/logger');
const express = require('express');

// --- HTTP Health Check Server ---
const app = express();
const PORT = process.env.PORT || 8082;
let server;

function startHealthServer() {
    server = app.listen(PORT, () => {
        logger.info(`🏥 Health check server listening on port ${PORT}`);
    });
}

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'OrderMS' });
});

// Global consumer instance
let consumer = null;
let isShuttingDown = false;

/**
 * Run order consumer
 */
async function runOrderConsumer() {
    logger.info('==========================================');
    logger.info('OrderMS - Order Command Consumer');
    logger.info('Hospital-D - Serverless Architecture');
    logger.info('==========================================');

    // Start Health Check Server
    startHealthServer();

    // Create consumer
    consumer = new OrderEventConsumer();

    try {
        // Start consuming
        await consumer.startConsuming(
            // Event handler
            async (eventBody, event, context) => {
                logger.info('📥 Order command received', {
                    partitionId: context.partitionId,
                    offset: event.offset
                });

                try {
                    const result = await processOrderCommand(eventBody);

                    if (result.processed) {
                        logger.info(`✅ Order processed: ${result.orderId}`);
                    }
                } catch (err) {
                    logger.error('Failed to process order', { error: err.message });
                    // Don't crash the consumer logic for one bad message
                }
            },
            // Error handler
            async (error, event, context) => {
                logger.error('❌ Consumer error occurred', {
                    error: error.message,
                    partitionId: context ? context.partitionId : 'N/A'
                });
            }
        );
    } catch (error) {
        logger.error('Fatal error starting consumer', { error: error.message });
        if (!isShuttingDown) process.exit(1);
    }

    // Keep alive loop
    logger.info('Order consumer running (Ctrl+C to stop)...');

    // Simple keep-alive
    setInterval(() => {
        // Heartbeat log every hour?
        // logger.debug('OrderMS heartbeat...');
    }, 60000);
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
    if (isShuttingDown) return;

    isShuttingDown = true;
    logger.info('Shutting down OrderMS gracefully...');

    try {
        if (consumer) {
            await consumer.close();
        }
        if (server) {
            server.close(() => logger.info('Health server closed'));
        }
    } catch (err) {
        logger.error('Error closing resources', { error: err.message });
    }

    logger.info('OrderMS shutdown complete');
    process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the service
if (require.main === module) {
    runOrderConsumer().catch(error => {
        logger.error('Fatal error in OrderMS', { error: error.message });
        process.exit(1);
    });
}

module.exports = { runOrderConsumer };
