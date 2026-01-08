const { EventHubProducerClient } = require('@azure/event-hubs');
const logger = require('../../utils/logger');
const config = require('../../config/config');
const { handleEventHubError } = require('../common/error-handler');

class InventoryEventPublisher {
    constructor() {
        this.producer = null;
        this.connectionString = config.eventHub.connectionString;
        this.eventHubName = config.eventHub.inventoryTopic;
        this.isInitialized = false;
    }

    /**
     * Initialize Event Hub producer
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized && this.producer) return;

        try {
            logger.info('Initializing Event Hub producer...');

            if (!this.connectionString) {
                logger.warn('Event Hub connection string is missing! Using mock mode only if verified testing.');
                // Don't throw here to allow app startup, but subsequent calls will fail or need handling
            }

            // Create producer - connection string already contains TransportType=AmqpWebSockets
            this.producer = new EventHubProducerClient(
                this.connectionString,
                this.eventHubName,
                {
                    retryOptions: {
                        maxRetries: 3
                    }
                }
            );

            this.isInitialized = true;
            logger.info('Event Hub producer initialized successfully');
            logger.info(`Topic: ${this.eventHubName}`);

        } catch (error) {
            const errorInfo = handleEventHubError(error);
            logger.error('Failed to initialize Event Hub producer', errorInfo);
            throw error;
        }
    }

    /**
     * Publish inventory low event
     * @param {Object} eventData - Event data
     * @returns {Promise<number>} Latency in milliseconds
     */
    async publishInventoryLowEvent(eventData) {
        const startTime = Date.now();

        try {
            if (!this.producer) {
                await this.initialize();
            }

            // Validate event data
            this.validateEventData(eventData);

            // Create event batch
            const batch = await this.producer.createBatch();

            // Add event to batch
            const eventAdded = batch.tryAdd({
                body: eventData,
                contentType: 'application/json',
                properties: {
                    hospitalId: eventData.hospitalId,
                    productCode: eventData.productCode,
                    severity: this.determineSeverity(eventData.daysOfSupply)
                }
            });

            if (!eventAdded) {
                throw new Error('Event too large to fit in batch');
            }

            // Send batch to Event Hub
            logger.debug('Publishing event to Event Hub', {
                eventId: eventData.eventId,
                daysOfSupply: eventData.daysOfSupply
            });

            await this.producer.sendBatch(batch);

            const latency = Date.now() - startTime;

            logger.info('Event published successfully', {
                eventId: eventData.eventId,
                latency
            });

            return latency;

        } catch (error) {
            const latency = Date.now() - startTime;
            const errorInfo = handleEventHubError(error);

            logger.error('Failed to publish event', {
                error: error.message,
                eventId: eventData.eventId,
                latency,
                type: errorInfo.type
            });

            throw error;
        }
    }

    /**
     * Validate event data structure
     * @param {Object} eventData - Event data to validate
     */
    validateEventData(eventData) {
        const requiredFields = [
            'eventId',
            'hospitalId',
            'productCode',
            'currentStockUnits',
            'dailyConsumptionUnits',
            'daysOfSupply',
            'threshold',
            'timestamp'
        ];

        for (const field of requiredFields) {
            if (!(field in eventData)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate data types
        if (typeof eventData.currentStockUnits !== 'number') {
            throw new Error('currentStockUnits must be a number');
        }

        if (typeof eventData.dailyConsumptionUnits !== 'number') {
            throw new Error('dailyConsumptionUnits must be a number');
        }

        if (typeof eventData.daysOfSupply !== 'number') {
            throw new Error('daysOfSupply must be a number');
        }
    }

    /**
     * Determine event severity based on days of supply
     * @param {number} daysOfSupply - Days of supply
     * @returns {string} Severity level
     */
    determineSeverity(daysOfSupply) {
        if (daysOfSupply <= 0) return 'CRITICAL';  // <= 0 covers 0 and negative
        if (daysOfSupply < 1.0) return 'URGENT';   // Was < 0.5 and < 1.0 separate, streamlined here
        if (daysOfSupply < 2.0) return 'HIGH';
        return 'NORMAL';
    }

    /**
     * Close Event Hub connection
     * @returns {Promise<void>}
     */
    async close() {
        if (this.producer) {
            logger.info('Closing Event Hub producer...');
            await this.producer.close();
            this.producer = null;
            this.isInitialized = false;
            logger.info('Event Hub producer closed');
        }
    }
}

// Singleton instance
const inventoryEventPublisher = new InventoryEventPublisher();

module.exports = inventoryEventPublisher;
