/**
 * SOAP Client Module
 * Hospital-D - Section B: SOA Integration
 * 
 * Provides a reusable SOAP client wrapper for Team 1's StockUpdateService
 */

const soap = require('soap');
const logger = require('../utils/logger');
const config = require('../config/config');

class SOAPClient {
    constructor() {
        this.client = null;
        this.wsdlUrl = config.soap.wsdlUrl || 'http://localhost:8000/StockUpdateService?wsdl';
        this.endpoint = config.soap.endpoint;
        this.timeout = config.soap.timeout || 30000;
    }

    /**
     * Initialize SOAP client from WSDL
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.info('🔌 Initializing SOAP client...', {
                wsdl: this.wsdlUrl,
                timeout: this.timeout
            });

            // Create SOAP client from WSDL
            this.client = await soap.createClientAsync(this.wsdlUrl, {
                endpoint: this.endpoint,
                forceSoap12Headers: false // Use SOAP 1.1
            });

            // Set timeout
            // Set timeout not supported on client instance directly in this version
            // this.client.setTimeout(this.timeout);

            // Set basic authentication if configured
            if (config.soap.username && config.soap.password) {
                const basicAuth = new soap.BasicAuthSecurity(
                    config.soap.username,
                    config.soap.password
                );
                this.client.setSecurity(basicAuth);
                logger.info('🔐 Basic authentication configured');
            }

            // Override endpoint if specified
            if (this.endpoint) {
                this.client.setEndpoint(this.endpoint);
                logger.info(`📍 Endpoint overridden: ${this.endpoint}`);
            }

            logger.info('✅ SOAP client initialized successfully', {
                endpoint: this.client.endpoint || this.wsdlUrl,
                services: Object.keys(this.client.wsdl.definitions.services)
            });

        } catch (error) {
            logger.error('❌ Failed to initialize SOAP client', {
                error: error.message,
                wsdl: this.wsdlUrl
            });
            throw error;
        }
    }

    /**
     * Get SOAP client instance (lazy initialization)
     * @returns {Promise<Object>} SOAP client
     */
    async getClient() {
        if (!this.client) {
            await this.initialize();
        }
        return this.client;
    }

    /**
     * Describe available SOAP services and methods
     * @returns {Object} Service description
     */
    describe() {
        if (!this.client) {
            throw new Error('SOAP client not initialized. Call initialize() first.');
        }

        const description = this.client.describe();
        logger.info('📋 Available SOAP services:', description);
        return description;
    }

    /**
     * Call StockUpdate SOAP method
     * @param {Object} request - StockUpdateRequest parameters
     * @returns {Promise<Object>} SOAP response
     */
    async callStockUpdate(request) {
        const client = await this.getClient();

        try {
            logger.debug('📤 Calling StockUpdate method', { request });

            // Call the SOAP method
            // The 'soap' library automatically wraps the request in SOAP envelope
            const [result] = await client.StockUpdateAsync(request);

            logger.debug('📥 StockUpdate response received', { result });

            return result;

        } catch (error) {
            logger.error('❌ SOAP call failed', {
                error: error.message,
                request
            });
            throw error;
        }
    }

    /**
     * Close SOAP client connections
     */
    close() {
        if (this.client) {
            logger.info('🔌 Closing SOAP client');
            this.client = null;
        }
    }
}

// Singleton instance
const soapClient = new SOAPClient();

module.exports = soapClient;
