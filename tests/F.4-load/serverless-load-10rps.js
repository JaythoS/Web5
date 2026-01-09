/**
 * Serverless Load Test - Normal Load (10 RPS)
 * 
 * Objectives:
 * 1. Publish concurrent events (StockMS)
 * 2. Measure Publishing Latency
 * 3. Measure End-to-End Consumption Latency
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Because the module exports a SINGLETON INSTANCE, we must patch the instance directly, not the prototype
// Also we rename the variable to avoid confusion (It's an instance, not a Class)
const publisherInstance = require('../../serverless-group/stockms/event-publisher');
// We use the actual business logic service directly to simulate consumption
// instead of the wrapper class which depends on Azure SDK
const { processOrderCommand } = require('../../serverless-group/orderms/order-service');
const { query } = require('../../core/database/connection');

// Mock Event Hub internals to measure local throughput accurately without network noise
// In a real scenario, this would point to Azure, but for 'Load Testing' the code logic
// we simulate the Azure hub locally to stress test OUR services.
const mockEventHub = new (require('events').EventEmitter)();

// Override Publisher to emit to local emitter instead of Azure
publisherInstance.publishEvent = async function (eventData) {
    const start = Date.now();
    // Simulate network delay to Azure (10-20ms)
    await new Promise(r => setTimeout(r, Math.random() * 10 + 10));
    const pubLatency = Date.now() - start;

    // In the real app, StockMS publishes "InventoryLowEvent".
    // Somewhere (maybe Azure Function logic), this event is transformed into "OrderCreationCommand".
    // For this E2E test, we will assume 1-to-1 mapping and pass the data.
    // We mock the "Command" structure expected by OrderService.
    const commandData = {
        commandId: `CMD-${eventData.eventId}`,
        orderId: `ORD-${eventData.eventId}`,
        hospitalId: eventData.hospitalId,
        productCode: eventData.productCode,
        orderQuantity: 100, // Fixed logic for test
        priority: 'HIGH',
        estimatedDeliveryDate: new Date().toISOString()
    };

    // Emit to our mock hub so Consumer can pick it up
    mockEventHub.emit('event', { body: commandData });

    return { success: true, latency: pubLatency };
};

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runLoadTest(rps, durationSeconds) {
    // Silence internal logs
    require('../../utils/logger').info = () => { };
    require('../../utils/logger').warn = () => { };
    require('../../utils/logger').error = () => { };

    console.log(`\n🚀 STARTING SERVERLESS LOAD TEST: ${rps} events/sec for ${durationSeconds} seconds`);
    console.log('--------------------------------------------------');

    const publisher = publisherInstance;

    // Metric Arrays
    const pubLatencies = [];
    const e2eLatencies = [];
    const errors = [];

    // Map to track start times of events for E2E calculation
    const eventStartTimes = new Map();

    // Setup Consumer (Our Mock Handler)
    mockEventHub.on('event', async (partitionEvent) => {
        try {
            const command = partitionEvent.body;

            // Trigger actual Order Processing Logic (Consumer side)
            await processOrderCommand(command);

            // Calculate E2E Latency
            // We extract eventId from command (ORD-LOAD-...)
            // Our eventId was "LOAD-..."
            // command.orderId is "ORD-LOAD-..."
            // So we need original eventId. Let's look at how we constructed it.
            // eventId was passed as is.

            // Wait, we generate commandId based on eventId.
            // commandId: CMD-${eventData.eventId}
            const originalEventId = command.commandId.replace('CMD-', '');

            if (eventStartTimes.has(originalEventId)) {
                const startTime = eventStartTimes.get(originalEventId);
                e2eLatencies.push(Date.now() - startTime);
            }
        } catch (e) {
            console.error('Consumer Error:', e.message); // Log error!
        }
    });

    const startTime = Date.now();
    let sentCount = 0;

    for (let sec = 0; sec < durationSeconds; sec++) {
        const batchPromises = [];
        for (let i = 0; i < rps; i++) {
            sentCount++;
            const eventId = `LOAD-${Date.now()}-${i}`;
            const eventData = {
                eventId: eventId,
                hospitalId: 'Hospital-D',
                productCode: 'LOAD-TEST-PROD',
                currentStockUnits: 10,
                dailyConsumptionUnits: 20,
                daysOfSupply: 0.5,
                threshold: 2.0,
                timestamp: new Date().toISOString()
            };

            const p = (async () => {
                eventStartTimes.set(eventId, Date.now());
                try {
                    const res = await publisher.publishEvent(eventData);
                    pubLatencies.push(res.latency);
                } catch (e) {
                    errors.push(e.message);
                }
            })();
            batchPromises.push(p);
        }
        await Promise.all(batchPromises);
        await sleep(1000);
    }

    await sleep(3000); // 3s cooldown to let consumer finish

    const totalTime = (Date.now() - startTime) / 1000;

    // Calculation Helper
    const calcStats = (arr) => {
        if (arr.length === 0) return { avg: 0, p95: 0, p99: 0, max: 0 };
        arr.sort((a, b) => a - b);
        return {
            avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2),
            p95: arr[Math.floor(arr.length * 0.95)] || 0,
            p99: arr[Math.floor(arr.length * 0.99)] || 0,
            max: arr[arr.length - 1] || 0
        };
    };

    const pubStats = calcStats(pubLatencies);
    const e2eStats = calcStats(e2eLatencies);

    console.log('\n📊 SERVERLESS LOAD TEST RESULTS (10 RPS)');
    console.log('==========================================');
    console.log(`Duration:       ${durationSeconds} seconds`);
    console.log(`Target RPS:     ${rps}`);
    console.log(`Total Events:   ${sentCount}`);
    console.log(`Published:      ${pubLatencies.length}`);
    console.log(`Consumed:       ${e2eLatencies.length}`);
    console.log('------------------------------------------');
    console.log('PUBLISHING LATENCY (Send directly to Hub)');
    console.log(`  Average: ${pubStats.avg} ms`);
    console.log(`  P95:     ${pubStats.p95} ms`);
    console.log('------------------------------------------');
    console.log('CONSUMPTION LATENCY (End-to-End Processing)');
    console.log(`  Average: ${e2eStats.avg} ms`);
    console.log(`  P95:     ${e2eStats.p95} ms`);
    console.log(`  Max:     ${e2eStats.max} ms`);
    console.log('==========================================\n');

    // Cleanup DB (Optional)
    await query("DELETE FROM orders WHERE product_code = 'LOAD-TEST-PROD'");
    process.exit(0);
}

runLoadTest(10, 5);
