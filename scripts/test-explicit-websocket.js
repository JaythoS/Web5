require('dotenv').config();
const { EventHubProducerClient } = require('@azure/event-hubs');
const WebSocket = require('ws');

async function testWithExplicitWebSocket() {
    // Get connection string and remove TransportType from it (let SDK handle it)
    let connectionString = process.env.EVENT_HUB_CONNECTION_STRING;
    const eventHubName = process.env.EVENT_HUB_NAME;

    // Remove TransportType from connection string if present
    connectionString = connectionString
        .split(';')
        .filter(part => !part.toLowerCase().startsWith('transporttype'))
        .join(';');

    console.log('--- Test with Explicit WebSocket Transport ---');
    console.log(`Event Hub: ${eventHubName}`);
    console.log(`Transport: WebSocket (explicit via ws library)`);
    console.log('');

    // Create producer with explicit WebSocket transport (v6 API)
    const producer = new EventHubProducerClient(connectionString, eventHubName, {
        webSocketOptions: {
            webSocket: WebSocket
        },
        retryOptions: {
            maxRetries: 2
        }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.log('⏰ 30 second timeout reached, aborting...');
        controller.abort();
    }, 30000);

    try {
        console.log('🔄 Attempting connection...');
        const startTime = Date.now();

        const props = await producer.getEventHubProperties({ abortSignal: controller.signal });

        const elapsed = Date.now() - startTime;
        clearTimeout(timeoutId);

        console.log(`✅ SUCCESS in ${elapsed}ms!`);
        console.log(`   Event Hub: ${props.name}`);
        console.log(`   Partitions: ${props.partitionIds.length}`);

        await producer.close();
        console.log('✅ Connection closed.');

    } catch (err) {
        clearTimeout(timeoutId);

        console.error('❌ Connection failed');
        console.error(`   Error: ${err.name}`);
        console.error(`   Message: ${err.message}`);

        // More specific error hints
        if (err.name === 'AbortError') {
            console.error('\n💡 Timeout - possible causes:');
            console.error('   1. Event Hub name is wrong');
            console.error('   2. Firewall is blocking WebSocket connection');
            console.error('   3. Azure namespace is not reachable');
        } else if (err.message.includes('NotFound') || err.message.includes('does not exist')) {
            console.error('\n💡 Event Hub not found!');
            console.error('   Check with Team 1 for correct Event Hub name.');
        } else if (err.message.includes('Unauthorized')) {
            console.error('\n💡 Authentication failed!');
            console.error('   The SharedAccessKey might be invalid or expired.');
        }

        await producer.close().catch(() => { });
        process.exit(1);
    }
}

testWithExplicitWebSocket();
