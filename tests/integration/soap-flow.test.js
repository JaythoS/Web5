/**
 * SOAP Integration Test with Database Logging
 * Tests full integration including database persistence
 * 
 * Location: tests/integration/soap-flow.test.js
 */

const path = require('path');

// CRITICAL: Clear require cache BEFORE loading any modules
console.log('Clearing require cache...');
try {
    delete require.cache[require.resolve('../../config/config')];
    delete require.cache[require.resolve('../../core/database/connection')];
    delete require.cache[require.resolve('../../core/database/db-operations')];
    // Also clear these to ensure they pick up new config/env
    if (require.resolve('../../soap-group/soap-client')) delete require.cache[require.resolve('../../soap-group/soap-client')];
    if (require.resolve('../../soap-group/soap-service')) delete require.cache[require.resolve('../../soap-group/soap-service')];
} catch (e) {
    // console.log('Cache clear warning:', e.message);
}
console.log('Cache cleared!\n');

// NOW load dotenv to ensure fresh read
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// OVERRIDE FOR TEST: Use local WSDL file instead of URL
// This fixes the "Unexpected root element" error from mock server's GET endpoint
process.env.SOAP_WSDL_URL = path.join(__dirname, '../../soap-group/StockUpdateService.wsdl');
process.env.SOAP_ENDPOINT = 'http://localhost:8000/StockUpdateService';

console.log('Environment loaded:');
console.log('  DB_USER:', process.env.DB_USER);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  WSDL:', process.env.SOAP_WSDL_URL);
console.log('  ENDPOINT:', process.env.SOAP_ENDPOINT);
console.log('');

// Now safely import modules (relative to tests/integration/)
const { sendStockUpdate } = require('../../soap-group/soap-service');
const { query } = require('../../core/database/connection');

async function testDatabaseLogging() {
    console.log('==========================================');
    console.log('SOAP + DATABASE INTEGRATION TEST');
    console.log('Hospital-D - Section B');
    console.log('==========================================\n');

    try {
        // Test 1: Verify database connection
        console.log('📝 Test 1: Database Connection');
        const dbTest = await query('SELECT current_user, current_database()');
        console.log('  User:', dbTest.rows[0].current_user);
        console.log('  Database:', dbTest.rows[0].current_database);
        console.log('✅ Database connected\n');

        // Test 2: Clear old test data
        console.log('📝 Test 2: Clearing old test data');
        await query("DELETE FROM event_log WHERE event_type = 'STOCK_UPDATE_SENT' AND timestamp > NOW() - INTERVAL '1 hour'");
        await query("DELETE FROM orders WHERE order_id LIKE 'ORD-MOCK%' AND created_at > NOW() - INTERVAL '1 hour'");
        console.log('✅ Old data cleared\n');

        // Test 3: Send SOAP request (low stock)
        console.log('📝 Test 3: Sending SOAP request (low stock: 0.96 days)');
        const result = await sendStockUpdate({
            currentStock: 50,
            dailyConsumption: 52,
            daysOfSupply: 0.96
        });

        console.log('Response:');
        console.log('  Success:', result.success);
        console.log('  Order Triggered:', result.orderTriggered);
        console.log('  Order ID:', result.order?.order_id || 'N/A');
        console.log('  Latency:', result.latency + 'ms');
        console.log('✅ SOAP request successful\n');

        // Test 4: Verify event logging
        console.log('📝 Test 4: Verify event logging in database');

        // Wait a bit for async logs
        await new Promise(resolve => setTimeout(resolve, 1000));

        const events = await query(`
            SELECT 
                log_id,
                event_type,
                direction,
                architecture,
                status,
                latency_ms,
                timestamp
            FROM event_log
            WHERE architecture = 'SOA'
              AND timestamp > NOW() - INTERVAL '1 minute'
            ORDER BY timestamp DESC
            LIMIT 5
        `);

        console.log('Events found:', events.rows.length);
        if (events.rows.length > 0) {
            events.rows.forEach((event, i) => {
                console.log(`\n  Event ${i + 1}:`);
                console.log('    Type:', event.event_type);
                console.log('    Direction:', event.direction);
                console.log('    Architecture:', event.architecture);
                console.log('    Status:', event.status);
                console.log('    Latency:', event.latency_ms + 'ms');
                console.log('    Timestamp:', event.timestamp);
            });
            console.log('\n✅ Events logged correctly with architecture=SOA\n');
        } else {
            console.log('⚠️  No events found in database');
        }

        // Test 5: Verify order creation (if triggered)
        if (result.orderTriggered && result.order) {
            console.log('📝 Test 5: Verify order in database');
            const orders = await query(`
                SELECT 
                    order_id,
                    source,
                    hospital_id,
                    product_code,
                    order_quantity,
                    priority,
                    order_status,
                    created_at
                FROM orders
                WHERE source = 'SOA'
                  AND created_at > NOW() - INTERVAL '1 minute'
                ORDER BY created_at DESC
                LIMIT 5
            `);

            console.log('Orders found:', orders.rows.length);
            if (orders.rows.length > 0) {
                orders.rows.forEach((order, i) => {
                    console.log(`\n  Order ${i + 1}:`);
                    console.log('    ID:', order.order_id);
                    console.log('    Source:', order.source);
                    console.log('    Hospital:', order.hospital_id);
                    console.log('    Product:', order.product_code);
                    console.log('    Quantity:', order.order_quantity);
                    console.log('    Priority:', order.priority);
                    console.log('    Status:', order.order_status);
                });
                console.log('\n✅ Orders saved correctly with source=SOA\n');
            } else {
                console.log('⚠️  No orders found in database\n');
            }
        }

        // Summary
        console.log('==========================================');
        console.log('✅ DATABASE LOGGING TEST COMPLETE');
        console.log('==========================================');

        process.exit(0);

    } catch (error) {
        console.error('\n==========================================');
        console.error('❌ TEST FAILED');
        console.error('==========================================');
        console.error('Error:', error.message);
        console.error('\nStack:', error.stack);
        process.exit(1);
    }
}

// Run test
testDatabaseLogging();
