/**
 * Error Handler Module
 * Hospital-D - Section B: SOA Integration
 * 
 * Handles SOAP faults and network errors with proper categorization
 */

const logger = require('../utils/logger');

/**
 * Parse and handle SOAP fault
 * 
 * @param {Error} error - SOAP fault error
 * @returns {Object} Parsed error information
 */
function handleSOAPFault(error) {
    const errorInfo = {
        type: 'SOAP_FAULT',
        code: null,
        message: error.message,
        detail: null,
        isRetryable: false,
        timestamp: new Date().toISOString()
    };

    // Check if it's a SOAP fault with envelope structure
    if (error.root && error.root.Envelope && error.root.Envelope.Body) {
        const body = error.root.Envelope.Body;
        const fault = body.Fault;

        if (fault) {
            // Extract fault code (SOAP 1.1 style)
            errorInfo.code = fault.faultcode || fault.Code || 'UNKNOWN';
            errorInfo.message = fault.faultstring || fault.Reason || error.message;

            // Extract detail if present
            if (fault.detail || fault.Detail) {
                errorInfo.detail = fault.detail || fault.Detail;
            }

            // Determine if error is retryable based on fault code
            const faultCode = errorInfo.code.toString().toLowerCase();

            // Server faults (500 series) are typically retryable
            if (faultCode.includes('server') || faultCode.includes('500')) {
                errorInfo.isRetryable = true;
                errorInfo.type = 'SERVER_FAULT';
            }

            // Client faults (400 series) are typically NOT retryable
            if (faultCode.includes('client') || faultCode.includes('400')) {
                errorInfo.isRetryable = false;
                errorInfo.type = 'CLIENT_FAULT';
            }

            // Specific fault codes
            if (faultCode.includes('timeout')) {
                errorInfo.isRetryable = true;
                errorInfo.type = 'TIMEOUT_FAULT';
            }

            if (faultCode.includes('quota') || faultCode.includes('rate')) {
                errorInfo.isRetryable = false;
                errorInfo.type = 'QUOTA_EXCEEDED';
            }
        }
    }

    logger.error('⚠️  SOAP Fault detected', errorInfo);

    return errorInfo;
}

/**
 * Parse and handle network error
 * 
 * @param {Error} error - Network error
 * @returns {Object} Parsed error information
 */
function handleNetworkError(error) {
    const errorInfo = {
        type: 'NETWORK_ERROR',
        code: error.code || 'UNKNOWN',
        message: error.message,
        isRetryable: true, // Network errors are generally retryable
        timestamp: new Date().toISOString()
    };

    const errorCode = (error.code || '').toString();
    const errorMessage = (error.message || '').toLowerCase();

    // Timeout errors
    if (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKETTIMEDOUT' || errorMessage.includes('timeout')) {
        errorInfo.type = 'TIMEOUT';
        errorInfo.message = 'Request timeout - server took too long to respond';
        errorInfo.isRetryable = true;
    }

    // Connection refused
    else if (errorCode === 'ECONNREFUSED' || errorMessage.includes('connection refused')) {
        errorInfo.type = 'CONNECTION_REFUSED';
        errorInfo.message = 'Connection refused - service may be down';
        errorInfo.isRetryable = true;
    }

    // DNS resolution failure
    else if (errorCode === 'ENOTFOUND' || errorMessage.includes('not found')) {
        errorInfo.type = 'DNS_ERROR';
        errorInfo.message = 'DNS resolution failed - hostname not found';
        errorInfo.isRetryable = false; // DNS errors usually won't resolve with retry
    }

    // Connection reset
    else if (errorCode === 'ECONNRESET' || errorMessage.includes('connection reset')) {
        errorInfo.type = 'CONNECTION_RESET';
        errorInfo.message = 'Connection reset by peer';
        errorInfo.isRetryable = true;
    }

    // SSL/TLS errors
    else if (
        errorCode === 'CERT_HAS_EXPIRED' ||
        errorCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        errorMessage.includes('certificate') ||
        errorMessage.includes('ssl')
    ) {
        errorInfo.type = 'SSL_ERROR';
        errorInfo.message = 'SSL/TLS certificate error';
        errorInfo.isRetryable = false; // SSL errors need configuration fix
    }

    // Network unreachable
    else if (errorCode === 'ENETUNREACH' || errorMessage.includes('network unreachable')) {
        errorInfo.type = 'NETWORK_UNREACHABLE';
        errorInfo.message = 'Network unreachable';
        errorInfo.isRetryable = true;
    }

    logger.error('🌐 Network error detected', errorInfo);

    return errorInfo;
}

/**
 * Parse any SOAP-related error
 * 
 * @param {Error} error - Error object
 * @returns {Object} Parsed error information
 */
function parseSOAPError(error) {
    // First, check if it's a SOAP fault
    if (error.root && error.root.Envelope) {
        return handleSOAPFault(error);
    }

    // Then, check if it's a network error
    if (error.code) {
        return handleNetworkError(error);
    }

    // Generic error
    const errorInfo = {
        type: 'UNKNOWN_ERROR',
        code: 'UNKNOWN',
        message: error.message || 'Unknown error occurred',
        isRetryable: true, // When in doubt, allow retry
        timestamp: new Date().toISOString()
    };

    logger.error('❓ Unknown error type', errorInfo);

    return errorInfo;
}

/**
 * Check if error is retryable
 * 
 * @param {Error} error - Error object
 * @returns {boolean} true if retryable
 */
function isRetryableError(error) {
    const errorInfo = parseSOAPError(error);
    return errorInfo.isRetryable;
}

module.exports = {
    handleSOAPFault,
    handleNetworkError,
    parseSOAPError,
    isRetryableError
};
