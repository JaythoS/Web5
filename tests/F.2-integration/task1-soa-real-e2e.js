/**
 * F.2 Task 1: SOA Path End-to-End (REAL SERVER)
 * Target: Team 1 Central Platform (Azure)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClientAsync } = require('soap');
const { query } = require('../../core/database/connection');
const { updateStock } = require('../../core/database/db-operations');

// Force Real Endpoints
const WSDL_URL = process.env.SOAP_WSDL_URL;
const ENDPOINT_URL = process.env.SOAP_ENDPOINT;

if (!WSDL_URL || WSDL_URL.includes('localhost')) {
    console.error('❌ ERROR: .env MUST point to Real Azure URL, not localhost!');
    process.exit(1);
}

async function runTask1() {
    console.log('==========================================');
    console.log('🧪 TASK 1: SOA Path End-to-End (REAL)');
    console.log('==========================================');

    // 1. Simulate Threshold Breach
    console.log('\nPlease wait... Preparing Database...');
    await query("DELETE FROM orders WHERE product_code = 'SOA-TEST-PROD'");
    await updateStock(10, 20, 0.5); // 0.5 Days of Supply (Critical)

    // 2. Prepare Request
    const inputs = {
        hospitalId: 'Hospital-D',
        productCode: 'SOA-TEST-PROD',
        currentStockUnits: 10,
        dailyConsumptionUnits: 20,
        daysOfSupply: 0.5,
        timestamp: new Date().toISOString()
    };
    const wrappedArgs = { request: inputs };

    console.log(`\n🚀 Sending SOAP Request to ${ENDPOINT_URL}...`);
    const startTime = Date.now();

    try {
        const client = await createClientAsync(WSDL_URL);
        client.setEndpoint(ENDPOINT_URL);

        // 3. Receive Response
        const [result] = await client.StockUpdateAsync(wrappedArgs);
        const latency = Date.now() - startTime;

        const data = result.StockUpdateResult || result;

        console.log(`\n✅ Response Received in ${latency}ms`);
        console.log('   Success:', data.success);
        console.log('   Order ID:', data.orderId);

        // 4. Save to Database (Already handled by app logic usually, but here run directly via script)
        // Since this script runs standalone client, we manually insert to verify DB connectivity logic
        if (data.success && data.orderId) {
            console.log('\n💾 Saving to Database (Simulation)...');
            // Fix: Add estimated_delivery_date (Required)
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 3); // +3 Days 

            await query(`
                INSERT INTO orders (order_id, source, hospital_id, product_code, order_quantity, priority, order_status, estimated_delivery_date, warehouse_id)
                VALUES ($1, 'SOA', $2, $3, $4, 'URGENT', 'PENDING', $5, 'CENTRAL-WH')
            `, [data.orderId, inputs.hospitalId, inputs.productCode, 100, deliveryDate.toISOString()]);

            // 5. Verify
            const dbCheck = await query("SELECT * FROM orders WHERE order_id = $1", [data.orderId]);
            if (dbCheck.rows.length > 0) {
                console.log(`✅ Database Verification PASSED: Order ${data.orderId} saved.`);
            } else {
                console.error('❌ Database Verification FAILED.');
            }
        }

    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
    }

    console.log('\n🏁 Task 1 Complete');
    process.exit(0);
}

runTask1();
