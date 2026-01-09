const dbOperations = require('../../../core/database/db-operations');
const db = require('../../../core/database/connection');

// Mock connection
jest.mock('../../../core/database/connection', () => ({
    query: jest.fn()
}));

describe('F.1.5 Unit Testing - Database Operations (Mocked)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Critical Parameter Validation', () => {
        test('insertOrder should throw if source is missing', async () => {
            await expect(dbOperations.insertOrder({}, null)).rejects.toThrow('Invalid source parameter');
        });

        test('insertOrder should throw if source is invalid', async () => {
            await expect(dbOperations.insertOrder({}, 'INVALID')).rejects.toThrow('Invalid source parameter');
        });

        test('logEvent should throw if architecture is missing', async () => {
            await expect(dbOperations.logEvent('TYPE', 'DIR', null)).rejects.toThrow('Invalid architecture parameter');
        });
    });

    describe('Query Execution', () => {
        test('updateStock should execute correct query', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 1 }] });

            await dbOperations.updateStock(100, 20, 5, 'CODE');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE stock'),
                [100, 20, 5, 'CODE']
            );
        });

        test('insertOrder should execute correct query with source', async () => {
            db.query.mockResolvedValue({ rows: [{ order_id: 'ord1' }] });

            const orderData = {
                order_id: 'ord1',
                product_code: 'ABC',
                order_quantity: 10,
                priority: 'HIGH',
                estimated_delivery_date: new Date()
            };

            await dbOperations.insertOrder(orderData, 'SOA');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO orders'),
                expect.arrayContaining(['ord1', 'SOA'])
            );
        });
    });
});
