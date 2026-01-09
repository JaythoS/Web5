const stockTracker = require('../../../core/stock/stock-tracker');

describe('F.1.1 Unit Testing - Stock Monitoring Logic', () => {

    describe('getDaysOfSupply', () => {
        test('should calculate days of supply correctly', () => {
            expect(stockTracker.getDaysOfSupply(100, 20)).toBe(5.0);
            expect(stockTracker.getDaysOfSupply(30, 20)).toBe(1.5);
            expect(stockTracker.getDaysOfSupply(52, 52)).toBe(1.0);
        });

        test('should round to 2 decimal places', () => {
            // 10 / 3 = 3.3333...
            expect(stockTracker.getDaysOfSupply(10, 3)).toBe(3.33);
        });

        test('should handle zero consumption (infinite supply)', () => {
            expect(stockTracker.getDaysOfSupply(100, 0)).toBe(Number.MAX_VALUE);
        });

        test('should throw error for negative stock', () => {
            expect(() => stockTracker.getDaysOfSupply(-10, 20)).toThrow('Current stock cannot be negative');
        });
    });

    describe('checkThresholdBreach', () => {
        test('should return true if days of supply < threshold', () => {
            expect(stockTracker.checkThresholdBreach(1.9, 2.0)).toBe(true);
        });

        test('should return false if days of supply >= threshold', () => {
            expect(stockTracker.checkThresholdBreach(2.0, 2.0)).toBe(false);
            expect(stockTracker.checkThresholdBreach(2.1, 2.0)).toBe(false);
        });

        test('should use default threshold of 2.0', () => {
            expect(stockTracker.checkThresholdBreach(1.99)).toBe(true);
            expect(stockTracker.checkThresholdBreach(2.0)).toBe(false);
        });
    });

    describe('getStockStatus', () => {
        test('should return correct status', () => {
            expect(stockTracker.getStockStatus(0, 10).status).toBe('OUT_OF_STOCK');
            expect(stockTracker.getStockStatus(4, 10).status).toBe('CRITICAL'); // 0.4 days
            expect(stockTracker.getStockStatus(8, 10).status).toBe('URGENT'); // 0.8 days
            expect(stockTracker.getStockStatus(15, 10).status).toBe('LOW'); // 1.5 days
            expect(stockTracker.getStockStatus(30, 10).status).toBe('SUFFICIENT'); // 3.0 days
        });

        test('should return calculation details', () => {
            const status = stockTracker.getStockStatus(100, 20);
            expect(status.currentStock).toBe(100);
            expect(status.dailyConsumption).toBe(20);
            expect(status.daysOfSupply).toBe(5.0);
            expect(status.thresholdBreached).toBe(false);
        });
    });
});
