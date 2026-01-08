require('dotenv').config();
const { EventHubProducerClient } = require('@azure/event-hubs');

async function checkEventHubExists() {
    const connectionString = process.env.EVENT_HUB_CONNECTION_STRING;
    const eventHubName = process.env.EVENT_HUB_NAME;

    console.log('--- Checking Event Hub Properties ---');
    console.log(`Namespace: medical-supply-chain-ns`);
    console.log(`Event Hub Name: ${eventHubName}`);

    const producer = new EventHubProducerClient(connectionString, eventHubName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        console.log('🔄 Getting Event Hub properties...');

        const props = await producer.getEventHubProperties({ abortSignal: controller.signal });

        clearTimeout(timeoutId);

        console.log('✅ Event Hub Found!');
        console.log(`   Name: ${props.name}`);
        console.log(`   Created: ${props.createdOn}`);
        console.log(`   Partitions: ${props.partitionIds.join(', ')}`);

        await producer.close();

    } catch (err) {
        clearTimeout(timeoutId);

        console.error('❌ Error:', err.name);
        console.error('   Message:', err.message);

        if (err.message.includes('does not exist')) {
            console.error('\n💡 The Event Hub name might be wrong!');
            console.error('   Check with Team 1 for the correct Event Hub name.');
        }

        await producer.close().catch(() => { });
        process.exit(1);
    }
}

checkEventHubExists();
