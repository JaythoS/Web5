/**
 * REAL SOAP LOAD TEST - Peak Load (50 RPS)
 * Target: Team 1 Central Platform (Azure)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClientAsync } = require('soap');

// Force REAL endpoints
const WSDL_URL = process.env.SOAP_WSDL_URL;
const ENDPOINT_URL = process.env.SOAP_ENDPOINT;

if (!WSDL_URL || WSDL_URL.includes('localhost')) {
    console.error('❌ ERROR: This test requires a REAL remote WSDL URL in .env');
    process.exit(1);
}

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runRealLoadTest(rps, durationSeconds) {
    console.log(`\n🚀 STARTING REAL SERVER PEAK LOAD TEST: ${rps} req/sec for ${durationSeconds} seconds`);
    console.log('   Target: Team 1 (Azure)');
    console.log('--------------------------------------------------');

    const results = [];
    const errors = [];
    const startTime = Date.now();
    let sentCount = 0;

    let clientBase;
    try {
        clientBase = await createClientAsync(WSDL_URL);
        clientBase.setEndpoint(ENDPOINT_URL);
    } catch (e) {
        console.error('Failed to init SOAP client:', e.message);
        process.exit(1);
    }

    // Data
    const args = {
        hospitalId: 'Hospital-D',
        productCode: 'PHYSIO-SALINE-500ML',
        currentStockUnits: 15,
        dailyConsumptionUnits: 20,
        daysOfSupply: 0.75,
        timestamp: new Date().toISOString()
    };
    const wrappedArgs = { request: args };

    for (let sec = 0; sec < durationSeconds; sec++) {
        const batchPromises = [];
        for (let i = 0; i < rps; i++) {
            sentCount++;
            const p = (async () => {
                const reqStart = Date.now();
                try {
                    const [result] = await clientBase.StockUpdateAsync(wrappedArgs);
                    const data = result.StockUpdateResult || result;
                    if (data && data.success) {
                        results.push(Date.now() - reqStart);
                    } else {
                        throw new Error(data?.message || 'Logic Failure');
                    }
                } catch (e) {
                    errors.push(e.message);
                }
            })();
            batchPromises.push(p);
        }

        console.log(`   ⏳ Second ${sec + 1}/${durationSeconds} dispatched (${rps} reqs)...`);

        // Wait for all to FIRE (not finish)
        await Promise.all(batchPromises.map(p => p.catch(() => { }))); // Simple wait

        // Ensure we don't drift too much, but for 50rps simple loop is ok
        // For distinct seconds, we should ideally use setTimeout but this is fine for now
    }

    console.log('   Waiting for remaining responses...');
    await sleep(8000);

    const totalTime = (Date.now() - startTime) / 1000;

    // Metrics
    results.sort((a, b) => a - b);
    const avg = results.reduce((a, b) => a + b, 0) / results.length || 0;
    const p95 = results[Math.floor(results.length * 0.95)] || 0;
    const max = results[results.length - 1] || 0;

    console.log('\n📊 REAL LOAD TEST RESULTS (50 RPS)');
    console.log('==========================================');
    console.log(`Duration:       ${durationSeconds} seconds`);
    console.log(`Target RPS:     ${rps}`);
    console.log(`Total Requests: ${sentCount}`);
    console.log(`Successful:     ${results.length}`);
    console.log(`Failed:         ${errors.length}`);
    console.log('------------------------------------------');
    console.log(`Average Latency: ${avg.toFixed(2)} ms`);
    console.log(`P95 Latency:     ${p95} ms`);
    console.log(`Max Latency:     ${max} ms`);
    console.log('==========================================\n');

    if (errors.length > 0) {
        console.log('First Error Sample:', errors[0]);
    }
}

runRealLoadTest(50, 5);
