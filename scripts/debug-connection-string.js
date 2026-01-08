require('dotenv').config();

// Parse connection string to show all components
const connectionString = process.env.EVENT_HUB_CONNECTION_STRING;
const eventHubName = process.env.EVENT_HUB_NAME;

console.log('=== Connection String Analysis ===\n');

if (!connectionString) {
    console.error('❌ EVENT_HUB_CONNECTION_STRING not found');
    process.exit(1);
}

// Parse the connection string
const parts = connectionString.split(';');
const parsed = {};

parts.forEach(part => {
    const [key, ...valueParts] = part.split('=');
    if (key && valueParts.length > 0) {
        parsed[key] = valueParts.join('='); // Handle = in values
    }
});

console.log('Parsed Connection String:');
console.log('  Endpoint:', parsed.Endpoint || 'NOT FOUND');
console.log('  SharedAccessKeyName:', parsed.SharedAccessKeyName || 'NOT FOUND');
console.log('  SharedAccessKey:', parsed.SharedAccessKey ? '***HIDDEN***' : 'NOT FOUND');
console.log('  TransportType:', parsed.TransportType || 'NOT SPECIFIED');
console.log('  EntityPath:', parsed.EntityPath || 'NOT SPECIFIED (using EVENT_HUB_NAME instead)');

console.log('\n.env Configuration:');
console.log('  EVENT_HUB_NAME:', eventHubName || 'NOT FOUND');
console.log('  CONSUMER_GROUP:', process.env.CONSUMER_GROUP || 'NOT FOUND');

// Warnings
console.log('\n=== Potential Issues ===');

if (parsed.EntityPath && eventHubName && parsed.EntityPath !== eventHubName) {
    console.warn('⚠️  WARNING: EntityPath in connection string differs from EVENT_HUB_NAME!');
    console.warn(`   EntityPath: ${parsed.EntityPath}`);
    console.warn(`   EVENT_HUB_NAME: ${eventHubName}`);
    console.warn('   → Use EntityPath if connection string includes it.');
}

if (parsed.TransportType === 'AmqpWebSockets') {
    console.log('ℹ️  TransportType=AmqpWebSockets is already in connection string');
    console.log('   → SDK should auto-detect this, no need to set in code.');
}

if (!parsed.Endpoint) {
    console.error('❌ CRITICAL: No Endpoint found in connection string!');
}

if (!eventHubName && !parsed.EntityPath) {
    console.error('❌ CRITICAL: No Event Hub name specified!');
}

console.log('\n=== Recommendation ===');
const effectiveHubName = parsed.EntityPath || eventHubName;
console.log(`Use Event Hub name: "${effectiveHubName}"`);
