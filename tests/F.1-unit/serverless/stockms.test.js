const { EventHubProducerClient } = require('@azure/event-hubs');
const inventoryEventPublisher = require('../../../serverless-group/stockms/event-publisher');

// Mock @azure/event-hubs
jest.mock('@azure/event-hubs', () => {
    return {
        EventHubProducerClient: jest.fn().mockImplementation(() => ({
            createBatch: jest.fn().mockResolvedValue({
                tryAdd: jest.fn().mockReturnValue(true)
            }),
            sendBatch: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue()
        }))
    };
});

describe('F.1.3 Unit Testing - Event Producer (StockMS)', () => {

    beforeEach(() => {
        // Clear mocks before each test
        EventHubProducerClient.mockClear();
    });

    describe('JSON Schema Compliance', () => {
        test('should validate correct event data', () => {
            const validEvent = {
                eventId: '123',
                hospitalId: 'HOSP-D',
                productCode: 'ABC',
                currentStockUnits: 50,
                dailyConsumptionUnits: 10,
                daysOfSupply: 5,
                threshold: 2,
                timestamp: new Date().toISOString()
            };

            expect(() => inventoryEventPublisher.validateEventData(validEvent)).not.toThrow();
        });

        test('should reject missing fields', () => {
            const invalidEvent = {
                eventId: '123',
                // Missing other fields
            };
            expect(() => inventoryEventPublisher.validateEventData(invalidEvent)).toThrow('Missing required field');
        });

        test('should reject invalid data types', () => {
            const invalidEvent = {
                eventId: '123',
                hospitalId: 'HOSP-D',
                productCode: 'ABC',
                currentStockUnits: "NOT_A_NUMBER", // Error
                dailyConsumptionUnits: 10,
                daysOfSupply: 5,
                threshold: 2,
                timestamp: new Date().toISOString()
            };
            expect(() => inventoryEventPublisher.validateEventData(invalidEvent)).toThrow('must be a number');
        });
    });

    describe('Severity Logic', () => {
        test('should determine correct severity', () => {
            expect(inventoryEventPublisher.determineSeverity(0)).toBe('CRITICAL');
            expect(inventoryEventPublisher.determineSeverity(0.9)).toBe('URGENT');
            expect(inventoryEventPublisher.determineSeverity(1.5)).toBe('HIGH');
            expect(inventoryEventPublisher.determineSeverity(5.0)).toBe('NORMAL');
        });
    });

    describe('Event Publishing', () => {
        test('should publish event successfully', async () => {
            const eventData = {
                eventId: '123',
                hospitalId: 'HOSP-D',
                productCode: 'ABC',
                currentStockUnits: 50,
                dailyConsumptionUnits: 10,
                daysOfSupply: 5,
                threshold: 2,
                timestamp: new Date().toISOString()
            };

            // Ensure initialized
            inventoryEventPublisher.connectionString = 'Endpoint=sb://mock...';

            const latency = await inventoryEventPublisher.publishInventoryLowEvent(eventData);

            expect(latency).toBeGreaterThanOrEqual(0);
            expect(EventHubProducerClient).toHaveBeenCalled();
        });
    });
});
