/**
 * Notification Adapter (INTERFACE)
 * Hospital-D Supply Chain Management
 * 
 * ⚠️⚠️⚠️ CRITICAL SPLIT POINT ⚠️⚠️⚠️
 * 
 * This is WHERE GROUPS SEPARATE!
 * 
 * This file defines the INTERFACE that both groups must implement.
 * Each group will create their own implementation in their respective folders:
 * 
 * - SOAP GROUP: Create `soap-group/soap-notification.js`
 * - SERVERLESS GROUP: Create `serverless-group/serverless-notification.js`
 * 
 * DO NOT MODIFY THIS FILE AFTER GROUP SPLIT!
 */

const { logEvent } = require('../core/database/db-operations');
const logger = require('../utils/logger');

/**
 * Notify External System (INTERFACE - TO BE IMPLEMENTED BY EACH GROUP)
 * 
 * @param {Object} alertData - Alert information from alert-manager
 * @param {string} alertData.hospital_id - Hospital identifier
 * @param {string} alertData.alert_type - LOW_STOCK/CRITICAL_STOCK/OUT_OF_STOCK
 * @param {string} alertData.severity - HIGH/URGENT/CRITICAL
 * @param {number} alertData.current_stock - Current stock units
 * @param {number} alertData.daily_consumption - Daily consumption rate
 * @param {number} alertData.days_of_supply - Days remaining
 * @param {number} alertData.threshold - Threshold value (2.0)
 * @param {string} alertData.timestamp - Alert timestamp
 * 
 * @returns {Promise<void>}
 * 
 * ========================================
 * SOAP GROUP IMPLEMENTATION REQUIREMENTS:
 * ========================================
 * 
 * FILE: soap-group/soap-notification.js
 * 
 * 1. Transform alertData to SOAP StockUpdateRequest format:
 *    ```xml
 *    <StockUpdateRequest>
 *      <HospitalID>Hospital-D</HospitalID>
 *      <ProductCode>PHYSIO-SALINE-500ML</ProductCode>
 *      <CurrentStock>50</CurrentStock>
 *      <DailyConsumption>52</DailyConsumption>
 *      <DaysOfSupply>0.96</DaysOfSupply>
 *      <AlertSeverity>HIGH</AlertSeverity>
 *      <Timestamp>2026-01-07T12:00:00Z</Timestamp>
 *    </StockUpdateRequest>
 *    ```
 * 
 * 2. Call SOAP web service:
 *    - Endpoint: From config.soap.endpoint (Team 1 provides)
 *    - Authentication: config.soap.username, config.soap.password
 *    - Timeout: config.soap.timeout (default: 30000ms)
 * 
 * 3. Measure latency:
 *    ```javascript
 *    const startTime = Date.now();
 *    // ... SOAP call ...
 *    const latency = Date.now() - startTime;
 *    ```
 * 
 * 4. Log event to database:
 *    ```javascript
 *    await logEvent(
 *      'STOCK_UPDATE_SENT',
 *      'OUTGOING',
 *      'SOA',  // ← CRITICAL! Use 'SOA' for performance tracking
 *      alertData,
 *      'SUCCESS',
 *      latency
 *    );
 *    ```
 * 
 * 5. Handle SOAP response:
 *    - If order triggered: Parse OrderID from response
 *    - Save order using: insertOrder(orderData, 'SOA')  // ← Use 'SOA' source
 *    - Log order received: logEvent('ORDER_RECEIVED', 'INCOMING', 'SOA', ...)
 * 
 * 6. Error handling & retry:
 *    - Retry 3 times: 5s, 15s, 30s delays
 *    - Log failures: logEvent(..., 'FAILURE', latency, errorMessage)
 *    - Throw error after all retries exhausted
 * 
 * ================================================
 * SERVERLESS GROUP IMPLEMENTATION REQUIREMENTS:
 * ================================================
 * 
 * FILE: serverless-group/serverless-notification.js
 * 
 * 1. Transform alertData to InventoryLowEvent JSON:
 *    ```json
 *    {
 *      "eventType": "InventoryLow",
 *      "hospitalId": "Hospital-D",
 *      "productCode": "PHYSIO-SALINE-500ML",
 *      "currentStock": 50,
 *      "dailyConsumption": 52,
 *      "daysOfSupply": 0.96,
 *      "severity": "HIGH",
 *      "threshold": 2.0,
 *      "timestamp": "2026-01-07T12:00:00Z"
 *    }
 *    ```
 * 
 * 2. Publish to Azure Event Hub:
 *    - Connection String: config.serverless.eventHubConnectionString
 *    - Topic: config.serverless.inventoryTopic (default: 'inventory-low-events')
 *    - Use Azure Event Hubs SDK: @azure/event-hubs
 * 
 * 3. Measure latency:
 *    ```javascript
 *    const startTime = Date.now();
 *    // ... Event Hub publish ...
 *    const latency = Date.now() - startTime;
 *    ```
 * 
 * 4. Log event to database:
 *    ```javascript
 *    await logEvent(
 *      'INVENTORY_EVENT_PUBLISHED',
 *      'OUTGOING',
 *      'SERVERLESS',  // ← CRITICAL! Use 'SERVERLESS' for performance tracking
 *      eventData,
 *      'SUCCESS',
 *      latency
 *    );
 *    ```
 * 
 * 5. Order processing (separate consumer):
 *    - Create OrderMS microservice (Section C.2)
 *    - Subscribe to order-commands topic
 *    - When order arrives:
 *      - Save using: insertOrder(orderData, 'SERVERLESS')  // ← Use 'SERVERLESS' source
 *      - Log: logEvent('ORDER_RECEIVED', 'INCOMING', 'SERVERLESS', ...)
 * 
 * 6. Error handling & retry:
 *    - Retry 3 times with exponential backoff
 *    - Log failures: logEvent(..., 'FAILURE', latency, errorMessage)
 *    - Throw error after retries exhausted
 * 
 * ========================================
 * CRITICAL NOTES FOR BOTH GROUPS:
 * ========================================
 * 
 * 1. **MANDATORY Parameters:**
 *    - SOAP: Use 'SOA' for source (insertOrder) and architecture (logEvent)
 *    - Serverless: Use 'SERVERLESS' for source and architecture
 * 
 * 2. **Performance Tracking:**
 *    - ALWAYS measure latency
 *    - ALWAYS log to event_log with correct architecture
 *    - This data is used for SOA vs Serverless comparison!
 * 
 * 3. **DO NOT:**
 *    - Modify core/ files after split
 *    - Use hardcoded values
 *    - Skip error handling
 *    - Forget to log events
 * 
 * 4. **Testing:**
 *    - Before Team 1 integration: Use mock/stub
 *    - Test with both success and failure scenarios
 *    - Verify database logs (event_log, orders tables)
 */

// ========================================
// DYNAMIC ARCHITECTURE SWITCHING
// ========================================

/**
 * Main notification dispatcher
 * Routes to appropriate implementation based on ARCHITECTURE env var
 * 
 * Set in .env:
 * ARCHITECTURE=MOCK       → Use mock for testing (default)
 * ARCHITECTURE=SOA        → Use SOAP implementation (Section B)
 * ARCHITECTURE=SERVERLESS → Use Event Hub implementation (Section C)
 */
async function notifyExternalSystem(alertData) {
    const architecture = process.env.ARCHITECTURE || 'MOCK';

    logger.info(`🔔 Notification triggered (Architecture: ${architecture})`, {
        hospital: alertData.hospital_id,
        severity: alertData.severity,
        daysOfSupply: alertData.days_of_supply
    });

    switch (architecture.toUpperCase()) {
        case 'SOA': {
            try {
                // Load SOAP implementation (Section B)
                const soapNotification = require('../soap-group/soap-notification');
                return await soapNotification.notifyExternalSystem(alertData);
            } catch (error) {
                if (error.code === 'MODULE_NOT_FOUND') {
                    logger.error('❌ SOAP implementation not found!');
                    logger.error('   Create soap-group/soap-notification.js (Section B)');
                    logger.warn('   Falling back to MOCK implementation...');
                    return await notifyExternalSystemMock(alertData);
                }
                throw error;
            }
        }

        case 'SERVERLESS': {
            try {
                // Load Serverless implementation (Section C)
                const serverlessNotification = require('../serverless-group/serverless-notification');
                return await serverlessNotification.notifyExternalSystem(alertData);
            } catch (error) {
                if (error.code === 'MODULE_NOT_FOUND') {
                    logger.error('❌ Serverless implementation not found!');
                    logger.error('   Create serverless-group/serverless-notification.js (Section C)');
                    logger.warn('   Falling back to MOCK implementation...');
                    return await notifyExternalSystemMock(alertData);
                }
                throw error;
            }
        }

        case 'MOCK':
        default: {
            if (architecture !== 'MOCK') {
                logger.warn(`⚠️  Unknown architecture: ${architecture}, using MOCK`);
            }
            return await notifyExternalSystemMock(alertData);
        }
    }
}

// ========================================
// MOCK IMPLEMENTATION (FOR TESTING)
// ========================================
async function notifyExternalSystemMock(alertData) {
    logger.info('🔔 MOCK: External notification triggered', {
        hospital: alertData.hospital_id,
        severity: alertData.severity,
        daysOfSupply: alertData.days_of_supply
    });

    // Simulate latency
    const mockLatency = Math.floor(Math.random() * 200) + 50; // 50-250ms
    await new Promise(resolve => setTimeout(resolve, mockLatency));

    // Log mock event
    await logEvent(
        'MOCK_NOTIFICATION',
        'OUTGOING',
        'MOCK',
        alertData,
        'SUCCESS',
        mockLatency,
        null
    );

    logger.info(`✅ MOCK notification sent (${mockLatency}ms)`);
    logger.warn('⚠️  Set ARCHITECTURE=SOA or ARCHITECTURE=SERVERLESS in .env for real implementation');

    return {
        success: true,
        latency: mockLatency,
        mock: true
    };
}

module.exports = {
    notifyExternalSystem
};
