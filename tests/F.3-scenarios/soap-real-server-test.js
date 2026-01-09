/**
 * REAL SERVER INTEGRATION TEST (Hospital-D)
 * 
 * Target: Team 1 Central Platform (Azure)
 * Scenario: Send Stock Update -> Receive Real Order
 * 
 * Note: This test connects to the production environment!
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClientAsync } = require('soap');
const { query } = require('../../core/database/connection');
const logger = require('../../utils/logger');

// Force REAL endpoint from .env
const WSDL_URL = process.env.SOAP_WSDL_URL;
const ENDPOINT_URL = process.env.SOAP_ENDPOINT;

if (!WSDL_URL || WSDL_URL.includes('localhost')) {
    console.error('❌ ERROR: This test requires a REAL remote WSDL URL in .env');
    process.exit(1);
}

async function runRealIntegrationTest() {
    console.log('==========================================');
    console.log('🌍 REAL SERVER INTEGRATION TEST');
    console.log('   Target: Team 1 (Azure)');
    console.log('==========================================\n');

    console.log('📝 Configuration:');
    console.log(`   WSDL:     ${WSDL_URL}`);
    console.log(`   Endpoint: ${ENDPOINT_URL}\n`);

    // 1. Prepare Data
    const args = {
        hospitalId: 'Hospital-D',
        productCode: 'PHYSIO-SALINE-500ML',
        currentStockUnits: 15,
        dailyConsumptionUnits: 20,
        daysOfSupply: 0.75, // Critical (< 2.0)
        timestamp: new Date().toISOString()
    };

    console.log('🚀 Sending Request:', JSON.stringify(args, null, 2));

    const startTime = Date.now();

    try {
        const client = await createClientAsync(WSDL_URL);
        client.setEndpoint(ENDPOINT_URL);

        // Wrapper Fix
        const wrappedArgs = { request: args };

        const [result] = await client.StockUpdateAsync(wrappedArgs);

        const latency = Date.now() - startTime;

        console.log('\n✅ RESPONSE RECEIVED!');
        console.log(`   Latency: ${latency}ms`);
        // console.log('   Raw Result:', JSON.stringify(result, null, 2));

        // FIX: Handle nested result object
        const data = result.StockUpdateResult || result;

        if (data && data.success) {
            console.log('\n🎉 SUCCESS: Team 1 processed our update.');
            if (data.orderId) {
                console.log(`   📦 Real Order Created: ${data.orderId}`);
            } else {
                console.log('   ℹ️  No order triggered (maybe stock was sufficient?)');
            }
        } else {
            console.warn('\n⚠️  SERVER RETURNED FAILURE:', data?.message || 'Unknown error');
        }

    } catch (error) {
        console.error('\n❌ REQUEST FAILED');
        console.error('   Error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Body:', error.response.data);
        }
    }

    console.log('\n==========================================');
    console.log('🏁 TEST COMPLETE');
    console.log('==========================================');
    process.exit(0);
}

runRealIntegrationTest();
