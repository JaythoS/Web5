/**
 * Error Handler Module
 * Application-wide error handling and retry logic
 */

const logger = require('../../utils/logger');

/**
 * Handle Event Hub specific errors
 * @param {Error} error - Error object
 * @returns {Object} Parsed error details
 */
function handleEventHubError(error) {
    const errorDetails = {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        isRetryable: false,
        type: 'UNKNOWN'
    };

    // Analyze error type
    if (error.code === 'ServiceUnavailableError' || error.message.includes('Service Unavailable')) {
        errorDetails.type = 'SERVICE_UNAVAILABLE';
        errorDetails.isRetryable = true;
    } else if (error.code === 'UnauthorizedError' || error.message.includes('Unauthorized')) {
        errorDetails.type = 'AUTHENTICATION_ERROR';
        errorDetails.isRetryable = false;
    } else if (error.code === 'QuotaExceededError' || error.message.includes('Quota exceeded')) {
        errorDetails.type = 'QUOTA_EXCEEDED';
        errorDetails.isRetryable = false;
    } else if (error.code === 'MessageTooLargeError') {
        errorDetails.type = 'MESSAGE_TOO_LARGE';
        errorDetails.isRetryable = false;
    } else if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
        errorDetails.type = 'TIMEOUT';
        errorDetails.isRetryable = true;
    }

    logger.error('Event Hub Error detected', errorDetails);

    return errorDetails;
}

/**
 * Execute a function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Function result
 */
async function executeWithRetry(fn, options = {}, context = '') {
    const maxRetries = options.maxRetries || 3;
    const initialDelay = options.delayMs || 1000;

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            if (attempt > 0) {
                logger.debug(`${context}: Retry attempt ${attempt}/${maxRetries}`);
            }
            return await fn();
        } catch (error) {
            lastError = error;
            attempt++;

            const errorInfo = handleEventHubError(error);

            if (!errorInfo.isRetryable || attempt > maxRetries) {
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = initialDelay * Math.pow(2, attempt - 1);
            logger.warn(`${context}: Error occurred, retrying in ${delay}ms...`, { error: error.message });

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

module.exports = {
    handleEventHubError,
    executeWithRetry
};
