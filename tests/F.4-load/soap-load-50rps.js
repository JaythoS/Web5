/**
 * SOAP Load Test - Peak Load (50 RPS)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

process.env.SOAP_WSDL_URL = path.join(__dirname, '../../soap-group/StockUpdateService.wsdl');
process.env.SOAP_ENDPOINT = 'http://localhost:8000/StockUpdateService';

const { sendStockUpdate } = require('../../soap-group/soap-service');

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runLoadTest(rps, durationSeconds) {
    // Silence internal logs
    require('../../utils/logger').info = () => { };
    require('../../utils/logger').warn = () => { };
    require('../../utils/logger').error = () => { };

    console.log(`\n🚀 STARTING PEAK LOAD TEST: ${rps} req/sec for ${durationSeconds} seconds`);
    console.log('--------------------------------------------------');

    const results = [];
    const errors = [];
    const startTime = Date.now();
    let sentCount = 0;

    for (let sec = 0; sec < durationSeconds; sec++) {
        for (let i = 0; i < rps; i++) {
            sentCount++;
            (async () => {
                const reqStart = Date.now();
                try {
                    await sendStockUpdate({ currentStock: 50, dailyConsumption: 20 });
                    results.push(Date.now() - reqStart);
                } catch (e) { errors.push(e.message); }
            })();
        }
        await sleep(1000);
    }

    await sleep(3000); // 3s cooldown for peak load
    const totalTime = (Date.now() - startTime) / 1000;

    // Metrics
    results.sort((a, b) => a - b);
    const avg = results.reduce((a, b) => a + b, 0) / results.length || 0;
    const p95 = results[Math.floor(results.length * 0.95)] || 0;
    const p99 = results[Math.floor(results.length * 0.99)] || 0;
    const max = results[results.length - 1] || 0;

    console.log('\n📊 LOAD TEST RESULTS (50 RPS)');
    console.log('==========================================');
    console.log(`Duration:       ${durationSeconds} seconds`);
    console.log(`Target RPS:     ${rps}`);
    console.log(`Actual RPS:     ${(results.length / totalTime).toFixed(2)}`);
    console.log(`Total Requests: ${sentCount}`);
    console.log(`Successful:     ${results.length}`);
    console.log(`Failed:         ${errors.length}`);
    console.log('------------------------------------------');
    console.log(`Average Latency: ${avg.toFixed(2)} ms`);
    console.log(`P95 Latency:     ${p95} ms`);
    console.log(`P99 Latency:     ${p99} ms`);
    console.log(`Max Latency:     ${max} ms`);
    console.log('==========================================\n');
}

runLoadTest(50, 5);
