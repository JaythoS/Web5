/**
 * Unit Tests for Message Builder
 */

const { buildStockUpdateRequest } = require('../../../soap-group/message-builder');

describe('Message Builder - Stock Update Request', () => {
    test('should build valid request with all fields', () => {
        const result = buildStockUpdateRequest({
            currentStock: 100,
            dailyConsumption: 50,
            daysOfSupply: 2.0
        });

        expect(result).toHaveProperty('hospitalId', 'Hospital-D');
        expect(result).toHaveProperty('productCode', 'PHYSIO-SALINE-500ML');
        expect(result).toHaveProperty('currentStockUnits', 100);
        expect(result).toHaveProperty('dailyConsumptionUnits', 50);
        expect(result).toHaveProperty('daysOfSupply', 2.0);
        expect(result).toHaveProperty('timestamp');
    });

    test('should auto-calculate daysOfSupply when not provided', () => {
        const result = buildStockUpdateRequest({
            currentStock: 100,
            dailyConsumption: 50
        });

        expect(result.daysOfSupply).toBe(2.0);
    });

    test('should round daysOfSupply to 2 decimals', () => {
        const result = buildStockUpdateRequest({
            currentStock: 155,
            dailyConsumption: 52
        });

        expect(result.daysOfSupply).toBe(2.98);
    });

    test('should throw error for negative currentStock', () => {
        expect(() => {
            buildStockUpdateRequest({
                currentStock: -10,
                dailyConsumption: 50
            });
        }).toThrow('Invalid currentStock');
    });

    test('should throw error for zero dailyConsumption', () => {
        expect(() => {
            buildStockUpdateRequest({
                currentStock: 100,
                dailyConsumption: 0
            });
        }).toThrow('Invalid dailyConsumption');
    });

    test('should throw error for negative dailyConsumption', () => {
        expect(() => {
            buildStockUpdateRequest({
                currentStock: 100,
                dailyConsumption: -5
            });
        }).toThrow('Invalid dailyConsumption');
    });

    test('should generate ISO 8601 timestamp', () => {
        const result = buildStockUpdateRequest({
            currentStock: 100,
            dailyConsumption: 50
        });

        // Check if timestamp is valid ISO format
        const timestamp = new Date(result.timestamp);
        expect(timestamp).toBeInstanceOf(Date);
        expect(timestamp.toString()).not.toBe('Invalid Date');
    });
});
