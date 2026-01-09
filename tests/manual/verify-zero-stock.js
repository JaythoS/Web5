/**
 * Verify Zero Stock Alert Creation (OUT_OF_STOCK)
 * This script manually sets stock to 0 to verify CRITICAL alert logic.
 */

const { checkAndTriggerAlert } = require('../../core/alert/alert-system');
const { query } = require('../../core/database/connection');
const { updateStock } = require('../../core/database/db-operations');

async function verifyZeroStockAlert() {
    console.log('🧪 OUT OF STOCK VERIFICATION');
    console.log('============================\n');

    // 1. Force Stock to Zero
    console.log('1️⃣  Setting Stock to 0 units...');
    // 0 units / 20 daily = 0.0 Days of Supply. Should trigger CRITICAL / OUT_OF_STOCK
    await updateStock(0, 20, 0.0);
    console.log('   ✅ Stock updated to 0 units (0.0 days supply)');

    // 2. Run Application Logic
    console.log('\n2️⃣  Running checkAndTriggerAlert()...');
    const result = await checkAndTriggerAlert();

    console.log('\n   📊 Logic Result:', result);

    if (result.alertTriggered && result.status === 'CRITICAL') {
        console.log('   ✅ STATUS = CRITICAL confirmed.');
    } else {
        console.error('   ❌ Logic did NOT trigger expected CRITICAL alert.');
    }

    // 3. Check Database for OUT_OF_STOCK Alert
    console.log('\n3️⃣  Checking "alerts" database table...');
    const res = await query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 1");

    if (res.rows.length > 0) {
        const alert = res.rows[0];

        if (alert.alert_type === 'OUT_OF_STOCK') {
            console.log('   ✅ ALERT TYPE "OUT_OF_STOCK" CONFIRMED!');
        } else {
            console.warn(`   ⚠️  Alert created but type is ${alert.alert_type} (Expected OUT_OF_STOCK)`);
        }

        console.table([{
            alert_id: alert.alert_id,
            type: alert.alert_type,
            severity: alert.severity,
            stock: alert.current_stock,
            days: alert.days_of_supply,
            created_at: alert.created_at
        }]);
    } else {
        console.error('   ❌ Alerts table is still EMPTY or not updated.');
    }

    process.exit(0);
}

verifyZeroStockAlert().catch(e => {
    console.error(e);
    process.exit(1);
});
