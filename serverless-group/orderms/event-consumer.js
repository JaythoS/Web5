const { EventHubConsumerClient } = require('@azure/event-hubs');
const logger = require('../../utils/logger');
const config = require('../../config/config');
const { handleEventHubError } = require('../common/error-handler');

class OrderEventConsumer {
    constructor() {
        this.consumer = null;
        this.connectionString = config.eventHub.connectionString;
        this.eventHubName = config.eventHub.orderTopic;
        this.consumerGroup = config.eventHub.consumerGroup;
        this.subscription = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Event Hub consumer
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized && this.consumer) return;

        try {
            logger.info('Initializing Event Hub consumer...');

            if (!this.connectionString) {
                logger.warn('Event Hub connection string is missing!');
            }

            // Create consumer - connection string already contains TransportType=AmqpWebSockets
            this.consumer = new EventHubConsumerClient(
                this.consumerGroup,
                this.connectionString,
                this.eventHubName,
                {
                    retryOptions: {
                        maxRetries: 3
                    }
                }
            );

            this.isInitialized = true;
            logger.info('Event Hub consumer initialized successfully');
            logger.info(`Topic: ${this.eventHubName}`);
            logger.info(`Consumer Group: ${this.consumerGroup}`);

        } catch (error) {
            const errorInfo = handleEventHubError(error);
            logger.error('Failed to initialize Event Hub consumer', errorInfo);
            throw error;
        }
    }

    /**
     * Start consuming events
     * @param {Function} onEvent - Event handler callback
     * @param {Function} onError - Error handler callback
     */
    async startConsuming(onEvent, onError) {
        if (!this.consumer) {
            await this.initialize();
        }

        logger.info('Starting to consume events...');

        this.subscription = this.consumer.subscribe({
            processEvents: async (events, context) => {
                // No events in this batch
                if (events.length === 0) {
                    return;
                }

                logger.info(`Received ${events.length} events from partition ${context.partitionId}`);

                for (const event of events) {
                    try {
                        // Check if event body needs parsing
                        let body = event.body;
                        if (typeof body === 'string' && (body.startsWith('{') || body.startsWith('['))) {
                            try { body = JSON.parse(body); } catch (e) { }
                        }

                        // Process event
                        await onEvent(body, event, context);

                    } catch (error) {
                        logger.error('Error processing event', {
                            error: error.message,
                            partitionId: context.partitionId
                        });

                        if (onError) {
                            await onError(error, event, context);
                        }
                    }
                }
            },

            processError: async (error, context) => {
                const errorInfo = handleEventHubError(error);

                logger.error('Event Hub consumer error', {
                    error: error.message,
                    type: errorInfo.type,
                    partitionId: context.partitionId,
                    consumerGroup: context.consumerGroup
                });

                if (onError) {
                    await onError(error, null, context);
                }
            }
        });

        logger.info('Event consumer started successfully');
    }

    /**
     * Stop consuming events
     * @returns {Promise<void>}
     */
    async stopConsuming() {
        if (this.subscription) {
            logger.info('Stopping event consumer...');
            await this.subscription.close();
            this.subscription = null;
            logger.info('Event consumer stopped');
        }
    }

    /**
     * Close consumer connection
     * @returns {Promise<void>}
     */
    async close() {
        await this.stopConsuming();

        if (this.consumer) {
            logger.info('Closing Event Hub consumer...');
            await this.consumer.close();
            this.consumer = null;
            this.isInitialized = false;
            logger.info('Event Hub consumer closed');
        }
    }
}

module.exports = OrderEventConsumer;
