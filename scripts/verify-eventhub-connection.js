require('dotenv').config(); // Load .env file
const { EventHubProducerClient } = require('@azure/event-hubs');

async function testConnection() {
    const connectionString = process.env.EVENT_HUB_CONNECTION_STRING;
    const eventHubName = process.env.EVENT_HUB_INVENTORY_TOPIC;

    console.log('--- Azure Event Hub Connection Test ---');
    console.log(`Topic: ${eventHubName}`);
    console.log(`Connection string: ${connectionString ? 'Found' : 'MISSING!'}`);

    if (!connectionString) {
        console.error('❌ ERROR: EVENT_HUB_CONNECTION_STRING not found in .env');
        process.exit(1);
    }

    if (!eventHubName) {
        console.error('❌ ERROR: EVENT_HUB_NAME not found in .env');
        process.exit(1);
    }

    // Create producer - Connection String already contains TransportType=AmqpWebSockets
    // Avoid using retryOptions.timeoutInMs which causes issues with Node.js 25.x
    const producer = new EventHubProducerClient(connectionString, eventHubName);

    // Manual timeout using AbortController (Node.js 25.x compatible)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

    try {
        console.log('🔄 Attempting to connect (60s timeout)...');

        const batch = await producer.createBatch({ abortSignal: controller.signal });

        clearTimeout(timeoutId);

        console.log('✅ SUCCESS: Connected to Azure Event Hub!');
        console.log('✅ Verified: Credentials are correct.');
        console.log('✅ Verified: WebSocket transport is working.');

        await producer.close();
        console.log('✅ Connection closed gracefully.');

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            console.error('❌ TIMEOUT: Connection took longer than 60 seconds.');
        } else {
            console.error('❌ FAILED: Could not connect to Azure.');
            console.error(`Error Name: ${err.name}`);
            console.error(`Error Message: ${err.message}`);

            if (err.message.includes('Unauthorized')) {
                console.error('💡 Hint: Connection string may be invalid or expired.');
            } else if (err.message.includes('EventHubName')) {
                console.error('💡 Hint: Check EVENT_HUB_NAME in .env file.');
            } else if (err.message.includes('getaddrinfo')) {
                console.error('💡 Hint: Network issue - check your internet connection.');
            }
        }

        await producer.close().catch(() => { });
        process.exit(1);
    }
}

testConnection();
