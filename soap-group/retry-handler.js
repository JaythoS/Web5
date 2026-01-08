/**
 * Retry Handler Module
 * Hospital-D - Section B: SOA Integration
 * 
 * Implements retry logic with configurable delays and max attempts
 */

const logger = require('../utils/logger');
const { parseSOAPError } = require('./error-handler');

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    retryDelays: [5000, 15000, 30000], // 5s, 15s, 30s
    retryableErrorTypes: [
        'TIMEOUT',
        'CONNECTION_REFUSED',
        'CONNECTION_RESET',
        'NETWORK_UNREACHABLE',
        'SERVER_FAULT',
        'TIMEOUT_FAULT',
        'NETWORK_ERROR'
    ]
};

/**
 * Execute function with retry logic
 * 
 * @param {Function} fn - Async function to execute
 * @param {*} params - Parameters to pass to function
 * @param {string} operationName - Name of operation (for logging)
 * @param {Object} options - Retry options (optional)
 * @returns {Promise<*>} Function result
 */
async function executeWithRetry(fn, params, operationName = 'SOAP Operation', options = {}) {
    const maxRetries = options.maxRetries || RETRY_CONFIG.maxRetries;
    const retryDelays = options.retryDelays || RETRY_CONFIG.retryDelays;

    let lastError = null;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;

        try {
            logger.info(`🔄 ${operationName} - Attempt ${attempt}/${maxRetries}`);

            // Execute the function
            const result = await fn(params);

            // Success!
            if (attempt > 1) {
                logger.info(`✅ ${operationName} succeeded after ${attempt} attempts`);
            } else {
                logger.info(`✅ ${operationName} succeeded on first attempt`);
            }

            return result;

        } catch (error) {
            lastError = error;

            // Parse error to determine if retryable
            const errorInfo = parseSOAPError(error);

            logger.warn(`⚠️  ${operationName} - Attempt ${attempt} failed`, {
                errorType: errorInfo.type,
                errorMessage: errorInfo.message,
                isRetryable: errorInfo.isRetryable,
                attempt: attempt,
                maxRetries: maxRetries
            });

            // Check if we should retry
            const shouldRetry = errorInfo.isRetryable && attempt < maxRetries;

            if (!shouldRetry) {
                if (!errorInfo.isRetryable) {
                    logger.error(`❌ ${operationName} - Non-retryable error, giving up`, {
                        errorType: errorInfo.type,
                        totalAttempts: attempt
                    });
                } else {
                    logger.error(`❌ ${operationName} - Max retries (${maxRetries}) reached, giving up`, {
                        totalAttempts: attempt
                    });
                }
                break;
            }

            // Calculate delay for next retry
            const delayIndex = Math.min(attempt - 1, retryDelays.length - 1);
            const delay = retryDelays[delayIndex];

            logger.info(`⏳ ${operationName} - Waiting ${delay}ms before retry ${attempt + 1}...`);

            // Wait before next retry
            await sleep(delay);
        }
    }

    // All retries exhausted, throw the last error
    throw lastError;
}

/**
 * Sleep utility
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with exponential backoff
 * 
 * @param {Function} fn - Async function to execute
 * @param {*} params - Parameters
 * @param {string} operationName - Operation name
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<*>} Result
 */
async function executeWithExponentialBackoff(fn, params, operationName = 'Operation', maxRetries = 5) {
    let lastError = null;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;

        try {
            logger.info(`🔄 ${operationName} - Attempt ${attempt}/${maxRetries}`);
            const result = await fn(params);

            if (attempt > 1) {
                logger.info(`✅ ${operationName} succeeded after ${attempt} attempts`);
            }

            return result;

        } catch (error) {
            lastError = error;

            const errorInfo = parseSOAPError(error);

            logger.warn(`⚠️  ${operationName} - Attempt ${attempt} failed`, {
                errorType: errorInfo.type,
                attempt: attempt
            });

            if (!errorInfo.isRetryable || attempt >= maxRetries) {
                break;
            }

            // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s, 16s...)
            const delay = Math.min(Math.pow(2, attempt) * 1000, 60000); // Max 60s

            logger.info(`⏳ Waiting ${delay}ms before retry...`);
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Get retry configuration
 * 
 * @returns {Object} Current retry configuration
 */
function getRetryConfig() {
    return { ...RETRY_CONFIG };
}

/**
 * Update retry configuration
 * 
 * @param {Object} newConfig - New configuration (partial)
 */
function updateRetryConfig(newConfig) {
    if (newConfig.maxRetries !== undefined) {
        RETRY_CONFIG.maxRetries = newConfig.maxRetries;
    }
    if (newConfig.retryDelays !== undefined) {
        RETRY_CONFIG.retryDelays = newConfig.retryDelays;
    }
    if (newConfig.retryableErrorTypes !== undefined) {
        RETRY_CONFIG.retryableErrorTypes = newConfig.retryableErrorTypes;
    }

    logger.info('🔧 Retry configuration updated', RETRY_CONFIG);
}

module.exports = {
    executeWithRetry,
    executeWithExponentialBackoff,
    sleep,
    getRetryConfig,
    updateRetryConfig,
    RETRY_CONFIG
};
