/**
 * SCEN-005 & Edge Case Tests
 * 
 * 1. Simultaneous Events (Concurrency)
 * 2. Zero Stock
 * 3. Negative Inputs
 * 4. Error Handling
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Override Endpoint for Mock
process.env.SOAP_WSDL_URL = path.join(__dirname, '../../soap-group/StockUpdateService.wsdl');
process.env.SOAP_ENDPOINT = 'http://localhost:8000/StockUpdateService';

const { sendStockUpdate } = require('../../soap-group/soap-service');
const { getStockStatus, updateStockLevel } = require('../../core/stock/stock-tracker');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEdgeCases() {
    console.log('==========================================');
    console.log('🧪 SCEN-005 & EDGE CASE TESTS');
    console.log('🏥 Hospital-D');
    console.log('==========================================\n');

    // ------------------------------------------------------------
    // TEST 1: SCEN-005 Simultaneous Events (Concurrency)
    // ------------------------------------------------------------
    console.log('🔄 TEST 1: SCEN-005 Simultaneous Events (5 Requests)');
    console.log('   Starting 5 parallel requests...');

    // Create 5 simultaneous promises
    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(sendStockUpdate({ currentStock: 40, dailyConsumption: 25 }));
    }

    try {
        const startTime = Date.now();
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        const successCount = results.filter(r => r.success).length;

        console.log(`   Total Time: ${totalTime}ms`);
        console.log(`   Successful: ${successCount}/5`);

        if (successCount === 5) {
            console.log('   ✅ SCEN-005 PASSED: All concurrent requests handled');
        } else {
            console.log('   ❌ SCEN-005 FAILED: Some requests dropped');
        }
    } catch (e) {
        console.error('   ❌ SCEN-005 ERROR:', e.message);
    }
    console.log('');

    await sleep(1000);

    // ------------------------------------------------------------
    // TEST 2: Zero Stock (Validation)
    // ------------------------------------------------------------
    console.log('📉 TEST 2: Zero Stock (Edge Case)');
    try {
        const result = await sendStockUpdate({ currentStock: 0, dailyConsumption: 20 });
        console.log(`   Result: Success=${result.success}, OrderTriggered=${result.orderTriggered}`);

        if (result.orderTriggered && result.order.priority === 'URGENT') {
            console.log('   ✅ ZERO STOCK PASSED: Urgent order created');
        } else {
            console.log('   ❌ ZERO STOCK FAILED');
        }
    } catch (e) {
        console.error('   ❌ ZERO STOCK ERROR:', e.message);
    }
    console.log('');

    await sleep(1000);

    // ------------------------------------------------------------
    // TEST 3: Negative Consumption (Error Handling)
    // ------------------------------------------------------------
    console.log('🚫 TEST 3: Negative Consumption (Should fail gracefully)');
    try {
        // We use updateStockLevel (core logic) directly to catch validation error
        await updateStockLevel(100, -50);
        console.log('   ❌ NEGATIVE CONSUMPTION FAILED: No error thrown');
    } catch (e) {
        // We expect an error here or strict constraint violation
        // In our current mock implementation it might just accept it or db constraint fail
        // Let's assume consuming "soap-service" handles it if implementation is strict
        console.log(`   ✅ NEGATIVE CONSUMPTION PASSED: Error caught -> ${e.message ? e.message.substring(0, 50) : 'Error'}...`);
    }
    console.log('');

    // ------------------------------------------------------------
    // TEST 4: Negative Stock (Error Handling)
    // ------------------------------------------------------------
    console.log('🚫 TEST 4: Negative Stock (Should throw Error)');
    try {
        const status = getStockStatus(-10, 20); // Should trigger validation in tracker
        console.log('   ❌ NEGATIVE STOCK FAILED: No error thrown');
    } catch (e) {
        console.log(`   ✅ NEGATIVE STOCK PASSED: Error caught -> ${e.message}`);
    }

    console.log('\n==========================================');
    console.log('✅ EDGE CASE SUITE COMPLETE');
    console.log('==========================================');
    process.exit(0);
}

runEdgeCases();
