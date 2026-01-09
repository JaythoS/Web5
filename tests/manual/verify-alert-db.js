/**
 * Verify Alert Creation in Database
 * This script manually triggers the alert logic to prove the 'alerts' table gets populated.
 */

const { checkAndTriggerAlert } = require('../../core/alert/alert-system');
const { query } = require('../../core/database/connection');
const { updateStock } = require('../../core/database/db-operations');

async function verifyAlertCreation() {
    console.log('🧪 ALERT CREATION VERIFICATION');
    console.log('============================\n');

    // 1. Ensure Stock is Critical
    console.log('1️⃣  Setting Stock to Critical Level...');
    // 10 units / 20 daily = 0.5 Days of Supply (< 2.0 Threshold)
    await updateStock(10, 20, 0.5);
    console.log('   ✅ Stock updated to 10 units (0.5 days supply)');

    // 2. Run the actual Application Logic
    console.log('\n2️⃣  Running checkAndTriggerAlert()...');
    const result = await checkAndTriggerAlert();

    console.log('\n   📊 Logic Result:', result);

    if (result.alertTriggered) {
        console.log('   ✅ Logic reports alert triggered.');
    } else {
        console.error('   ❌ Logic did NOT trigger alert. Check thresholds.');
    }

    // 3. Check Database
    console.log('\n3️⃣  Checking "alerts" database table...');
    const res = await query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 1");

    if (res.rows.length > 0) {
        const alert = res.rows[0];
        console.log('   ✅ ALERT FOUND IN DB!');
        console.table([{
            alert_id: alert.alert_id,
            type: alert.alert_type,
            severity: alert.severity,
            days: alert.days_of_supply,
            created_at: alert.created_at
        }]);
    } else {
        console.error('   ❌ Alerts table is still EMPTY.');
    }

    process.exit(0);
}

verifyAlertCreation().catch(e => {
    console.error(e);
    process.exit(1);
});
