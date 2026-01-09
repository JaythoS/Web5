/**
 * END-TO-END DEMO SCENARIO
 * Hospital-D Medical Supply Chain
 * 
 * Simulates high Physiological Saline consumption causing a stock drop.
 * Triggers both SOA and Serverless paths for the "Hospital-D" system.
 */

const { updateStockLevel, getStockStatus } = require('../core/stock/stock-tracker');
const { sendStockUpdate } = require('../soap-group/soap-service');
const { query } = require('../core/database/connection');
const logger = require('../utils/logger');
require('dotenv').config();

async function runDemoScenario() {
    console.log('\n🏥 STARTING HOSPITAL-D END-TO-END DEMO SCENARIO 🏥');
    console.log('====================================================');
    console.log('Objective: Simulate high consumption -> Stock Drop -> Trigger SOA & Serverless\n');

    const PRODUCT_CODE = process.env.PRODUCT_CODE || 'PHYSIO-SALINE-500ML';

    try {
        // 1. Get Initial State
        console.log('📊 STEP 1: Checking Initial State...');
        const initialStock = await query('SELECT * FROM stock WHERE product_code = $1', [PRODUCT_CODE]);
        if (initialStock.rows.length === 0) {
            throw new Error(`Product ${PRODUCT_CODE} not found! Run 'npm run seed' first.`);
        }
        console.log(`   Initial Stock: ${initialStock.rows[0].current_stock_units} units`);

        // 2. Simulate High Consumption (Drop to 10 units - Critical)
        console.log('\n📉 STEP 2: Simulating High Physiological Saline Consumption...');
        const targetStock = 10; // Critical level
        const consumption = initialStock.rows[0].current_stock_units - targetStock;

        console.log(`   Simulating consumption of ${consumption} units...`);
        // Update DB directly to simulate rapid consumption
        await updateStockLevel(targetStock, initialStock.rows[0].daily_consumption_units, PRODUCT_CODE);
        console.log(`   ✅ Stock updated to CRITICAL level: ${targetStock} units`);

        // 3. Trigger Serverless Path (Automatic)
        console.log('\n☁️  STEP 3: Serverless Integration (Azure Event Hub)');
        console.log('   ℹ️  The StockMS container (running in Docker) is polling the database.');
        console.log('   ℹ️  It should detect this drop within 5 seconds and publish an event.');
        console.log('   👀  Watch the "stock-ms" Docker logs for: "InventoryLowEvent published"');

        // 4. Trigger SOA Path (Manual Trigger for Demo)
        // Since we don't have a running SOA poller, we trigger the SOAP update manually here
        console.log('\n🔗 STEP 4: SOA Integration (SOAP Web Service)');
        console.log('   ℹ️  Triggering SOAP StockUpdate to Team 1 Central Platform...');

        const startTime = Date.now();
        const soaResult = await sendStockUpdate({
            currentStock: targetStock,
            dailyConsumption: initialStock.rows[0].daily_consumption_units,
            daysOfSupply: targetStock / initialStock.rows[0].daily_consumption_units
        });
        const soaLatency = Date.now() - startTime;

        console.log(`   ✅ SOA Request Completed in ${soaLatency}ms`);
        console.log(`   Success: ${soaResult.success}`);
        if (soaResult.orderTriggered) {
            console.log(`   🚨 ORDER TRIGGERED BY SOA: ${soaResult.order.order_id}`);
        }

        // 5. Verification
        console.log('\n✅ DEMO SCENARIO COMPLETE');
        console.log('====================================================');
        console.log('To verify results:');
        console.log('1. Check StockMS logs:   docker logs stock-ms');
        console.log('2. Check OrderMS logs:   docker logs order-ms');
        console.log('3. Check Database:       http://localhost:8080');
        console.log('====================================================\n');

    } catch (error) {
        console.error('❌ SCENARIO FAILED:', error.message);
    } finally {
        process.exit(0);
    }
}

runDemoScenario();
