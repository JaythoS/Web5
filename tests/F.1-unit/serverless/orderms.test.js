const orderService = require('../../../serverless-group/orderms/order-service');
const dbOperations = require('../../../core/database/db-operations');
const config = require('../../../config/config');

// Mock db-operations
jest.mock('../../../core/database/db-operations', () => ({
    insertOrder: jest.fn(),
    logEvent: jest.fn()
}));

// Mock config to ensure hospitalId is fixed and logger works
jest.mock('../../../config/config', () => ({
    hospital: { id: 'Hospital-D' },
    app: { logLevel: 'info' },
    eventHub: {
        orderTopic: 'mock-topic',
        consumerGroup: 'mock-group',
        connectionString: 'mock-connection-string'
    }
}));

describe('F.1.4 Unit Testing - Event Consumer (OrderMS)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Order Validation', () => {
        test('should validate correct order command', () => {
            const cmd = {
                commandId: 'cmd1',
                orderId: 'ord1',
                hospitalId: 'Hospital-D',
                productCode: 'ABC',
                orderQuantity: 10
            };
            expect(() => orderService.validateOrderCommand(cmd)).not.toThrow();
        });

        test('should reject missing fields', () => {
            const cmd = { commandId: 'cmd1' };
            expect(() => orderService.validateOrderCommand(cmd)).toThrow('Missing required field');
        });

        test('should reject non-positive quantity', () => {
            const cmd = {
                commandId: 'cmd1',
                orderId: 'ord1',
                hospitalId: 'Hospital-D',
                productCode: 'ABC',
                orderQuantity: 0
            };
            expect(() => orderService.validateOrderCommand(cmd)).toThrow('Order quantity must be positive');
        });
    });

    describe('Order Processing', () => {
        test('should process valid order for this hospital', async () => {
            const cmd = {
                commandId: 'cmd1',
                orderId: 'ord1',
                hospitalId: 'Hospital-D',
                productCode: 'ABC',
                orderQuantity: 10
            };

            await orderService.processOrderCommand(cmd);

            expect(dbOperations.insertOrder).toHaveBeenCalledWith(
                expect.objectContaining({ order_id: 'ord1' }),
                'SERVERLESS'
            );
            expect(dbOperations.logEvent).toHaveBeenCalledWith(
                'ORDER_RECEIVED', expect.anything(), 'SERVERLESS', expect.anything(), 'SUCCESS', expect.anything()
            );
        });

        test('should ignore order for different hospital', async () => {
            const cmd = {
                commandId: 'cmd2',
                orderId: 'ord2',
                hospitalId: 'Hospital-A', // Different hospital
                productCode: 'ABC',
                orderQuantity: 10
            };

            const result = await orderService.processOrderCommand(cmd);

            expect(result.processed).toBe(false);
            expect(result.reason).toBe('NOT_FOR_THIS_HOSPITAL');
            expect(dbOperations.insertOrder).not.toHaveBeenCalled();
        });

        test('should handle duplicate orders (Mock DB Error)', async () => {
            const cmd = {
                commandId: 'cmd1',
                orderId: 'ord1',
                hospitalId: 'Hospital-D',
                productCode: 'ABC',
                orderQuantity: 10
            };

            // Simulate DB duplicate key error
            dbOperations.insertOrder.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

            await expect(orderService.processOrderCommand(cmd)).rejects.toThrow('duplicate key');

            // Should still log failure
            expect(dbOperations.logEvent).toHaveBeenCalledWith(
                'ORDER_RECEIVED', expect.anything(), 'SERVERLESS', expect.anything(), 'FAILURE', expect.anything(), expect.stringContaining('duplicate')
            );
        });
    });
});
