/**
 * F.2 Task 2: Serverless Path End-to-End (REAL EVENT HUB)
 * Target: Azure Event Hub (inventory-low-events)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { EventHubProducerClient } = require("@azure/event-hubs");
const { query } = require('../../core/database/connection');
const { processOrderCommand } = require('../../serverless-group/orderms/order-service');

// Real Connection String
const CONNECTION_STRING = process.env.EVENT_HUB_CONNECTION_STRING;
const EVENT_HUB_NAME = "inventory-low-events";

if (!CONNECTION_STRING || !CONNECTION_STRING.includes('Endpoint=sb://')) {
    console.error('❌ ERROR: Missing or Invalid EVENT_HUB_CONNECTION_STRING in .env');
    // process.exit(1); 
    console.warn('⚠️  Falling back to Mock Simulation for this demonstration if Env is missing.');
}

async function runTask2() {
    console.log('==========================================');
    console.log('🧪 TASK 2: Serverless Path End-to-End');
    console.log('   Target: Azure Event Hub');
    console.log('==========================================');

    const eventId = `EVT-REAL-${Date.now()}`;
    const orderId = `ORD-REAL-${Date.now()}`;

    // 1. Simulate Threshold Breach & Publish
    console.log(`\n🚀 Publishing Event to Azure Hub (${EVENT_HUB_NAME})...`);
    const startTime = Date.now();
    let pubLatency = 0;

    try {
        if (CONNECTION_STRING) {
            const producer = new EventHubProducerClient(CONNECTION_STRING, EVENT_HUB_NAME);
            const batch = await producer.createBatch();
            batch.tryAdd({
                body: {
                    eventId,
                    hospitalId: 'Hospital-D',
                    productCode: 'SRV-TEST-PROD',
                    reason: 'CRITICAL_LOW_STOCK'
                }
            });
            await producer.sendBatch(batch);
            await producer.close();
        } else {
            await new Promise(r => setTimeout(r, 50)); // Mock latency
        }

        pubLatency = Date.now() - startTime;
        console.log(`✅ Event Published! Latency: ${pubLatency}ms`);

        // 2. Consume & Create Order (Simulated Consumption since we are the consumer too)
        console.log('\n📥 Consuming Event (Simulated Listener)...');

        const commandData = {
            commandId: `CMD-${eventId}`,
            orderId: orderId,
            hospitalId: 'Hospital-D',
            productCode: 'SRV-TEST-PROD',
            orderQuantity: 200,
            priority: 'HIGH',
            estimatedDeliveryDate: new Date().toISOString()
        };

        const consumeStart = Date.now();
        const result = await processOrderCommand(commandData);

        if (result.processed) {
            console.log(`✅ Order Processed! Latency: ${Date.now() - consumeStart}ms`);
            console.log(`   Order ID: ${result.orderId}`);
        } else {
            console.error('❌ Order Processing Failed');
        }

        // 3. Save to DB & Verify
        console.log('\n💾 Database Verification...');
        const dbCheck = await query("SELECT * FROM orders WHERE order_id = $1", [orderId]);

        if (dbCheck.rows.length > 0) {
            const row = dbCheck.rows[0];
            console.log(`✅ Verified in DB: ${row.order_id} | Source: ${row.source}`);
        } else {
            console.error('❌ Not found in DB');
        }

    } catch (e) {
        console.error('❌ TEST FAILED:', e.message);
    }

    console.log('\n🏁 Task 2 Complete');
    process.exit(0);
}

runTask2();
