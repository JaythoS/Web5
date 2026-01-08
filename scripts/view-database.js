#!/usr/bin/env node
/**
 * Database Viewer - Section C Data
 * Quick view of SERVERLESS events and orders
 */

const { query } = require('../core/database/connection');

async function viewDatabase() {
    console.log('='.repeat(70));
    console.log('DATABASE VIEWER - SECTION C (SERVERLESS) DATA');
    console.log('='.repeat(70));
    console.log('');

    try {
        // 1. Stock Status
        console.log('📦 CURRENT STOCK STATUS:');
        console.log('-'.repeat(70));
        const stock = await query(`
            SELECT 
                product_code,
                current_stock_units,
                daily_consumption_units,
                days_of_supply,
                threshold,
                updated_at
            FROM stock
            ORDER BY updated_at DESC
            LIMIT 1
        `);

        if (stock.rows.length > 0) {
            const s = stock.rows[0];
            console.log(`Product Code:       ${s.product_code}`);
            console.log(`Current Stock:      ${s.current_stock_units} units`);
            console.log(`Daily Consumption:  ${s.daily_consumption_units} units/day`);
            console.log(`Days of Supply:     ${s.days_of_supply} days`);
            console.log(`Threshold:          ${s.threshold} days`);
            console.log(`Last Updated:       ${s.updated_at}`);

            if (parseFloat(s.days_of_supply) < parseFloat(s.threshold)) {
                console.log(`⚠️  WARNING: Stock is below threshold!`);
            } else {
                console.log(`✅ Stock is above threshold`);
            }
        }
        console.log('');

        // 2. Serverless Events
        console.log('📡 SERVERLESS EVENTS (Last 10):');
        console.log('-'.repeat(70));
        const events = await query(`
            SELECT 
                log_id,
                event_type,
                direction,
                status,
                latency_ms,
                timestamp
            FROM event_log
            WHERE architecture = 'SERVERLESS'
            ORDER BY timestamp DESC
            LIMIT 10
        `);

        if (events.rows.length === 0) {
            console.log('No SERVERLESS events found yet.');
        } else {
            events.rows.forEach((e, i) => {
                console.log(`${i + 1}. [${e.timestamp.toISOString()}] ${e.event_type}`);
                console.log(`   Status: ${e.status}, Direction: ${e.direction}, Latency: ${e.latency_ms}ms`);
            });
        }
        console.log('');

        // 3. Serverless Orders
        console.log('📋 SERVERLESS ORDERS (Last 10):');
        console.log('-'.repeat(70));
        const orders = await query(`
            SELECT 
                order_id,
                product_code,
                order_quantity,
                priority,
                order_status,
                created_at
            FROM orders
            WHERE source = 'SERVERLESS'
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (orders.rows.length === 0) {
            console.log('No SERVERLESS orders found yet.');
        } else {
            orders.rows.forEach((o, i) => {
                console.log(`${i + 1}. [${o.created_at.toISOString()}] ${o.order_id}`);
                console.log(`   Product: ${o.product_code}, Qty: ${o.order_quantity}, Priority: ${o.priority}, Status: ${o.order_status}`);
            });
        }
        console.log('');

        // 4. Architecture Comparison
        console.log('📊 EVENT COUNT BY ARCHITECTURE:');
        console.log('-'.repeat(70));
        const archStats = await query(`
            SELECT 
                architecture,
                COUNT(*) as total_events,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'FAILURE' THEN 1 ELSE 0 END) as failure_count,
                ROUND(AVG(latency_ms), 2) as avg_latency_ms
            FROM event_log
            GROUP BY architecture
            ORDER BY architecture
        `);

        archStats.rows.forEach(a => {
            console.log(`${a.architecture}:`);
            console.log(`  Total: ${a.total_events}, Success: ${a.success_count}, Failure: ${a.failure_count}`);
            console.log(`  Avg Latency: ${a.avg_latency_ms}ms`);
        });
        console.log('');

        // 5. Order Source Comparison
        console.log('📦 ORDER COUNT BY SOURCE:');
        console.log('-'.repeat(70));
        const sourceStats = await query(`
            SELECT 
                source,
                COUNT(*) as total_orders,
                SUM(order_quantity) as total_quantity
            FROM orders
            GROUP BY source
            ORDER BY source
        `);

        sourceStats.rows.forEach(s => {
            console.log(`${s.source}: ${s.total_orders} orders, ${s.total_quantity} units total`);
        });
        console.log('');

        console.log('='.repeat(70));
        console.log('✅ DATABASE VIEW COMPLETE');
        console.log('='.repeat(70));

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

viewDatabase();
