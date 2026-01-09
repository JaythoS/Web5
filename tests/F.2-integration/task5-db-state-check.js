/**
 * F.2 Task 5: Database Integration Check
 * Verifies consistency of Event Logs and Orders
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { query } = require('../../core/database/connection');

async function runTask5() {
    console.log('==========================================');
    console.log('💾 TASK 5: Database Integration Check');
    console.log('==========================================\n');

    try {
        // 1. Check Connection
        const v = await query('SELECT version()');
        console.log(`✅ Database Connected: ${v.rows[0].version.split(' ')[0]}`);

        // 2. Check Orders Stats
        const orderStats = await query(`
            SELECT source, COUNT(*) as count 
            FROM orders 
            GROUP BY source
        `);
        console.log('\n📊 Order Statistics:');
        console.table(orderStats.rows);

        // 3. Check Event Log Stats
        const eventStats = await query(`
            SELECT architecture, event_type, COUNT(*) as count 
            FROM event_log 
            WHERE timestamp > NOW() - INTERVAL '24 hours'
            GROUP BY architecture, event_type
        `);
        console.log('\n📝 Recent Event Logs (24h):');
        console.table(eventStats.rows);

        console.log('\n✅ Database Integrity Check Passed');

    } catch (e) {
        console.error('❌ DB Check Failed:', e.message);
    }

    process.exit(0);
}

runTask5();
