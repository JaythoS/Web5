/**
 * Serverless Integration Test Flow
 * Validation of Logic without Real Event Hub Connection
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Setup Mocks BEFORE requiring services
const inventoryEventPublisher = require('../../serverless-group/stockms/event-publisher');
const { query } = require('../../core/database/connection');
const { updateStock } = require('../../core/database/db-operations');

// MOCK: Event Publisher
inventoryEventPublisher.initialize = async () => {
    console.log('  [MOCK] Event Hub Publisher initialized');
};

inventoryEventPublisher.publishInventoryLowEvent = async (eventData) => {
    console.log('  [MOCK] Event published via Mock Publisher:', eventData.eventId);
    // Simulate latency
    await new Promise(r => setTimeout(r, 50));
    return 50; // 50ms simulated latency
};

// Now require services (they will use the mocked publisher)
const { checkAndPublishStockEvent } = require('../../serverless-group/stockms/stock-service');
const { processOrderCommand } = require('../../serverless-group/orderms/order-service');

async function testServerlessFlow() {
    console.log('==========================================');
    console.log('SERVERLESS FLOW INTEGRATION TEST (MOCK)');
    console.log('Hospital-D - Section C');
    console.log('==========================================\n');

    try {
        // --- TEST 1: StockMS Logic ---
        console.log('📝 Test 1: StockMS - Inventory Low Event');

        // 1.1 Set Low Stock
        console.log('  -> Setting stock levels to LOW (0.5 days)...');
        // Assuming 100 consumption, 50 stock = 0.5 days
        await updateStock(50, 100, 0.5);

        // 1.2 Trigger Service
        console.log('  -> Triggering checkAndPublishStockEvent()...');
        const stockResult = await checkAndPublishStockEvent();

        console.log('  -> Result:', stockResult);

        if (!stockResult.eventPublished) {
            throw new Error('Event was NOT published but stock is low!');
        }

        // 1.3 Verify DB Log
        console.log('  -> Verifying Event Log in DB...');
        const eventLog = await query(`
            SELECT * FROM event_log 
            WHERE architecture = 'SERVERLESS' 
              AND event_type = 'INVENTORY_EVENT_PUBLISHED' 
            ORDER BY timestamp DESC LIMIT 1
        `);

        if (eventLog.rows.length === 0) {
            throw new Error('No INVENTORY_EVENT_PUBLISHED found in DB with architecture=SERVERLESS');
        }

        const log = eventLog.rows[0];
        console.log(`  ✅ Event logged! ID: ${log.log_id}, Arch: ${log.architecture}, Status: ${log.status}\n`);


        // --- TEST 2: OrderMS Logic ---
        console.log('📝 Test 2: OrderMS - Order Creation');

        const mockOrderCommand = {
            commandId: `CMD-${Date.now()}`,
            orderId: `ORD-${Date.now()}`,
            hospitalId: 'Hospital-D',
            productCode: 'PHYSIO-SALINE-500ML',
            orderQuantity: 500,
            priority: 'URGENT',
            estimatedDeliveryDate: new Date().toISOString()
        };

        // 2.1 Process Command
        console.log('  -> Processing incoming Order Command...');
        const orderResult = await processOrderCommand(mockOrderCommand);
        console.log('  -> Result:', orderResult);

        if (!orderResult.processed) {
            throw new Error('Order processing failed!');
        }

        // 2.2 Verify Orders Table
        console.log('  -> Verifying Orders Table...');
        const orderCheck = await query(`
            SELECT * FROM orders 
            WHERE order_id = $1
        `, [mockOrderCommand.orderId]);

        if (orderCheck.rows.length === 0) {
            throw new Error('Order not found in DB!');
        }

        const order = orderCheck.rows[0];
        console.log(`  ✅ Order found! ID: ${order.order_id}, Source: ${order.source}, Status: ${order.order_status}`);

        if (order.source !== 'SERVERLESS') {
            throw new Error(`Order Source is '${order.source}', expected 'SERVERLESS'`);
        }

        // 2.3 Verify Order Event Log
        console.log('  -> Verifying Order Event Log...');
        const orderLog = await query(`
             SELECT * FROM event_log 
             WHERE architecture = 'SERVERLESS' 
               AND event_type = 'ORDER_RECEIVED'
               AND payload::text LIKE '%${mockOrderCommand.orderId}%'
             ORDER BY timestamp DESC LIMIT 1
        `);

        if (orderLog.rows.length === 0) {
            throw new Error('Order Receipt not logged in DB with SERVERLESS arch');
        }

        console.log('  ✅ Order Receipt Event logged successfully!\n');

        console.log('==========================================');
        console.log('✅ SERVERLESS LOGIC TESTS PASSED');
        console.log('==========================================');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testServerlessFlow();
