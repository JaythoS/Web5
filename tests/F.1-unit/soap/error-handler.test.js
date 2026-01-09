/**
 * Unit Tests for Error Handler
 */

const { parseSOAPError, handleSOAPFault, handleNetworkError } = require('../../../soap-group/error-handler');

describe('Error Handler - SOAP Errors', () => {
    test('should detect timeout error', () => {
        const error = new Error('Timeout');
        error.code = 'ETIMEDOUT';

        const result = parseSOAPError(error);

        expect(result.type).toBe('TIMEOUT');
        expect(result.isRetryable).toBe(true);
        expect(result.message).toContain('timeout');
    });

    test('should detect connection refused error', () => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';

        const result = parseSOAPError(error);

        expect(result.type).toBe('CONNECTION_REFUSED');
        expect(result.isRetryable).toBe(true);
    });

    test('should detect DNS error as non-retryable', () => {
        const error = new Error('Not found');
        error.code = 'ENOTFOUND';

        const result = parseSOAPError(error);

        expect(result.type).toBe('DNS_ERROR');
        expect(result.isRetryable).toBe(false);
    });

    test('should handle SOAP fault with faultcode', () => {
        const fault = {
            root: {
                Envelope: {
                    Body: {
                        Fault: {
                            faultcode: 'soap:Client',
                            faultstring: 'Invalid request',
                            detail: 'Missing required field'
                        }
                    }
                }
            }
        };

        const result = handleSOAPFault(fault);

        expect(result.type).toBe('CLIENT_FAULT');
        expect(result.code).toBe('soap:Client');
        expect(result.message).toContain('Invalid request');
        expect(result.isRetryable).toBe(false); // Client faults are not retryable
    });

    test('should handle server SOAP fault as retryable', () => {
        const fault = {
            root: {
                Envelope: {
                    Body: {
                        Fault: {
                            faultcode: 'soap:Server',
                            faultstring: 'Internal server error'
                        }
                    }
                }
            }
        };

        const result = handleSOAPFault(fault);

        expect(result.type).toBe('SERVER_FAULT');
        expect(result.isRetryable).toBe(true); // Server faults are retryable
    });

    test('should handle network error with timeout', () => {
        const error = new Error('Request timeout');
        error.code = 'ETIMEDOUT';

        const result = handleNetworkError(error);

        expect(result.type).toBe('TIMEOUT');
        expect(result.isRetryable).toBe(true);
    });

    test('should provide descriptive error messages', () => {
        const error = new Error('Connection failed');
        error.code = 'ECONNREFUSED';

        const result = parseSOAPError(error);

        expect(result.message).toBeTruthy();
        expect(result.message.length).toBeGreaterThan(10);
    });
});

describe('Error Handler - Error Categories', () => {
    test('should categorize client errors as non-retryable', () => {
        const fault = {
            root: {
                Envelope: {
                    Body: {
                        Fault: {
                            faultcode: 'soap:Client'
                        }
                    }
                }
            }
        };

        const result = handleSOAPFault(fault);
        expect(result.isRetryable).toBe(false);
    });

    test('should categorize server errors as retryable', () => {
        const fault = {
            root: {
                Envelope: {
                    Body: {
                        Fault: {
                            faultcode: 'soap:Server'
                        }
                    }
                }
            }
        };

        const result = handleSOAPFault(fault);
        expect(result.isRetryable).toBe(true);
    });

    test('should categorize network errors as retryable', () => {
        const timeoutError = new Error('Timeout');
        timeoutError.code = 'ETIMEDOUT';

        const connError = new Error('Connection refused');
        connError.code = 'ECONNREFUSED';

        expect(parseSOAPError(timeoutError).isRetryable).toBe(true);
        expect(parseSOAPError(connError).isRetryable).toBe(true);
    });
});
