#!/usr/bin/env node
/**
 * Section C - Full End-to-End Test
 * Tests real Azure Event Hub integration
 */

const { checkAndPublishStockEvent } = require('../../serverless-group/stockms/stock-service');
const { processOrderCommand } = require('../../serverless-group/orderms/order-service');
const { query } = require('../../core/database/connection');
const { updateStock } = require('../../core/database/db-operations');
const inventoryEventPublisher = require('../../serverless-group/stockms/event-publisher');
const OrderEventConsumer = require('../../serverless-group/orderms/event-consumer');

async function fullE2ETest() {
    console.log('='.repeat(60));
    console.log('SECTION C - FULL E2E TEST WITH REAL AZURE');
    console.log('Hospital-D - Serverless Integration');
    console.log('='.repeat(60));
    console.log('');

    try {
        // Test 1: Publisher Connection
        console.log('📝 Test 1: Event Hub Publisher Connection');
        await inventoryEventPublisher.initialize();
        console.log('✅ Publisher initialized successfully\n');

        // Test 2: Publish Event
        console.log('📝 Test 2: Publish Inventory Low Event');

        // Set low stock
        await updateStock(30, 52, 0.58);
        console.log('  → Stock set to LOW (0.58 days)');

        const publishResult = await checkAndPublishStockEvent();
        console.log('  → Event published:', publishResult);

        if (!publishResult.eventPublished) {
            throw new Error('Event should have been published!');
        }
        console.log(`✅ Event sent to Azure! Latency: ${publishResult.latency}ms\n`);

        // Test 3: Verify Database Logging
        console.log('📝 Test 3: Verify Database Logging');
        const eventLog = await query(`
            SELECT * FROM event_log
            WHERE architecture = 'SERVERLESS'
              AND event_type = 'INVENTORY_EVENT_PUBLISHED'
            ORDER BY timestamp DESC
            LIMIT 1
        `);

        if (eventLog.rows.length === 0) {
            throw new Error('Event not logged in database!');
        }

        const log = eventLog.rows[0];
        console.log(`✅ Event logged: ID=${log.log_id}, Arch=${log.architecture}, Status=${log.status}\n`);

        // Test 4: Consumer Connection
        console.log('📝 Test 4: Event Hub Consumer Connection');
        const consumer = new OrderEventConsumer();
        await consumer.initialize();
        console.log('✅ Consumer initialized successfully\n');

        // Test 5: Process Mock Order Command
        console.log('📝 Test 5: Process Order Command (Simulated)');
        const mockOrder = {
            commandId: `CMD-E2E-${Date.now()}`,
            orderId: `ORD-E2E-${Date.now()}`,
            hospitalId: 'Hospital-D',
            productCode: 'PHYSIO-SALINE-500ML',
            orderQuantity: 270,
            priority: 'HIGH',
            estimatedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
            warehouseId: 'CENTRAL-WAREHOUSE'
        };

        const orderResult = await processOrderCommand(mockOrder);
        console.log('  → Order processed:', orderResult);

        if (!orderResult.processed) {
            throw new Error('Order processing failed!');
        }
        console.log(`✅ Order created! ID=${orderResult.orderId}, Latency=${orderResult.latency}ms\n`);

        // Test 6: Verify Order in Database
        console.log('📝 Test 6: Verify Order in Database');
        const orderCheck = await query(
            'SELECT * FROM orders WHERE order_id = $1',
            [mockOrder.orderId]
        );

        if (orderCheck.rows.length === 0) {
            throw new Error('Order not found in database!');
        }

        const order = orderCheck.rows[0];
        if (order.source !== 'SERVERLESS') {
            throw new Error(`Order source is '${order.source}', expected 'SERVERLESS'`);
        }
        console.log(`✅ Order verified: Source=${order.source}, Status=${order.order_status}\n`);

        // Cleanup
        await inventoryEventPublisher.close();
        await consumer.close();

        console.log('='.repeat(60));
        console.log('✅ ALL TESTS PASSED - SECTION C READY FOR PRODUCTION');
        console.log('='.repeat(60));

        process.exit(0);

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fullE2ETest();
