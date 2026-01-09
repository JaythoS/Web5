/**
 * SCEN-004: Critical Shortage Test (Hospital-D)
 * 
 * Scenario Details:
 * • Current stock: 10 units
 * • Daily consumption: 20 units
 * • Days of supply: 0.5
 * • Expected: URGENT priority order
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Override Endpoint for Mock (COMMENTED OUT FOR REAL TEST)
// process.env.SOAP_WSDL_URL = path.join(__dirname, '../../soap-group/StockUpdateService.wsdl');
// process.env.SOAP_ENDPOINT = 'http://localhost:8000/StockUpdateService';

const { sendStockUpdate } = require('../../soap-group/soap-service');
const { getStockStatus } = require('../../core/stock/stock-tracker');
const { query } = require('../../core/database/connection');

async function runScenario004() {
    console.log('==========================================');
    console.log('🧪 SCEN-004: Critical Shortage Test');
    console.log('🏥 Hospital-D');
    console.log('==========================================\n');

    const inputs = {
        currentStock: 10,
        dailyConsumption: 20
    };

    console.log('📝 INPUT PARAMETERS:');
    console.log(`  Current Stock: ${inputs.currentStock}`);
    console.log(`  Daily Consump: ${inputs.dailyConsumption}`);

    // 1. Validate Logic First
    console.log('\n🔍 STEP 1: Logic Verification');
    const status = getStockStatus(inputs.currentStock, inputs.dailyConsumption);
    console.log(`  Days of Supply: ${status.daysOfSupply}`);
    console.log(`  Expected DoS:   0.5`);
    console.log(`  Status Level:   ${status.status}`);

    if (status.daysOfSupply === 0.5) {
        console.log('  ✅ Logic Calculation Correct');
    } else {
        console.error('  ❌ Logic Calculation Failed');
        process.exit(1);
    }

    // 2. Clear Previous Data
    await query("DELETE FROM orders WHERE order_quantity = 200 AND created_at > NOW() - INTERVAL '5 minutes'");

    // 3. Execute Integration
    console.log('\n🚀 STEP 2: Executing SOA Request...');
    const startTime = Date.now();

    try {
        const result = await sendStockUpdate(inputs);
        const latency = Date.now() - startTime;

        console.log(`  Latency: ${latency}ms`);
        console.log(`  Success: ${result.success}`);

        if (result.orderTriggered) {
            console.log(`  Order Triggered: YES (ID: ${result.order.order_id})`);
        } else {
            console.log('  ❌ Error: Order was NOT triggered!');
        }

        // 4. Validate Database Result
        console.log('\n💾 STEP 3: Database Verification');

        // Wait for DB async
        await new Promise(resolve => setTimeout(resolve, 500));

        const orderCheck = await query(`
            SELECT priority, order_quantity, source 
            FROM orders 
            WHERE order_id = $1
        `, [result.order.order_id]);

        if (orderCheck.rows.length > 0) {
            const order = orderCheck.rows[0];
            console.log(`  DB Priority: ${order.priority}`);
            console.log(`  Expected:    URGENT`);

            if (order.priority === 'URGENT') {
                console.log('  ✅ Priority Matches EXPECTED Result');
            } else {
                console.warn('  ⚠️  Priority Mismatch!');
            }
        } else {
            console.error('  ❌ Order not found in Database!');
        }

    } catch (error) {
        console.error('❌ SCENARIO FAILED:', error.message);
    }

    console.log('\n==========================================');
    console.log('✅ SCENARIO 004 COMPLETE');
    console.log('==========================================');
    process.exit(0);
}

runScenario004();
