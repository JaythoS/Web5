/**
 * F.2 Task 4: Integration Test with Team 1
 * Uses Test_Scenarios dataset (e.g., Scenario 1: Urgent Order)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClientAsync } = require('soap');

const WSDL = process.env.SOAP_WSDL_URL;
const ENDPOINT = process.env.SOAP_ENDPOINT;

async function runTask4() {
    console.log('==========================================');
    console.log('🤝 TASK 4: Integration Test with Team 1');
    console.log('   Running Dataset Scenario: Urgent Order');
    console.log('==========================================\n');

    const inputs = {
        hospitalId: 'Hospital-D',
        productCode: 'SCENARIO-TEST-001',
        currentStockUnits: 50,
        dailyConsumptionUnits: 40,
        daysOfSupply: 1.25, // < 2.0 (Urgent)
        timestamp: new Date().toISOString()
    };

    console.log('🚀 Sending Scenario Payload:', inputs);

    try {
        const client = await createClientAsync(WSDL);
        client.setEndpoint(ENDPOINT);
        const [res] = await client.StockUpdateAsync({ request: inputs });
        const data = res.StockUpdateResult || res;

        console.log('\n✅ Response:', JSON.stringify(data, null, 2));

        if (data.orderTriggered) {
            console.log('✅ PASS: Order Triggered as expected.');
        } else {
            console.log('❌ FAIL: Order SHOULD have been triggered.');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    }

    process.exit(0);
}

runTask4();
