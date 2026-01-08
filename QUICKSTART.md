# 🚀 QUICK START GUIDE
## Hospital-D Medical Supply Chain System

**Status:** ✅ ALL SECTIONS COMPLETE - PRODUCTION READY

---

## ✅ Prerequisites

```bash
# Check versions
node --version  # Need >= 18.0.0
npm --version   # Need >= 9.0.0
docker --version # (optional, for database)
```

---

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Database
```bash
# Using Docker (recommended)
npm run docker:up

# Verify it's running
docker ps | grep hospital-d-db
# Should show: Up XX hours (healthy)
```

### 3. Environment Configuration
```bash
# .env file is already configured with:
# - Database credentials
# - Azure Event Hub connection (Team 1)
# - Azure SOAP endpoint (Team 1)

# View configuration
cat .env
```

**Current Configuration:**
```env
# Database (Local Docker)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hospital_d_db
DB_USER=postgres
DB_PASSWORD=postgres

# Azure Event Hub (Team 1 - Production)
EVENT_HUB_CONNECTION_STRING=Endpoint=sb://medical-supply-chain-ns...
EVENT_HUB_INVENTORY_TOPIC=inventory-low-events
EVENT_HUB_ORDER_TOPIC=order-commands

# Azure SOAP Service (Team 1 - Production)
SOAP_WSDL_URL=https://team1-central-platform-...azurewebsites.net/CentralServices?wsdl
SOAP_ENDPOINT=https://team1-central-platform-...azurewebsites.net/CentralServices

# Hospital Configuration
HOSPITAL_ID=Hospital-D
PRODUCT_CODE=PHYSIO-SALINE-500ML
```

### 4. Seed Database
```bash
npm run seed
```

**Expected Output:**
```
🌱 Starting database seed...
Hospital: Hospital-D
Product: PHYSIO-SALINE-500ML
✅ Stock data seeded successfully
🎉 Database seeding completed successfully!
```

### 5. Verify Setup
```bash
# Test database connection
node -e "const db = require('./core/database/connection'); db.testConnection().then(() => console.log('✅ Connected!')).then(() => process.exit(0))"
```

---

## 🎯 Running the System

### Option 1: Run Individual Components

**Stock Monitoring Service (Section C - StockMS):**
```bash
node serverless-group/stockms/index.js
```
This will:
- Monitor stock levels
- Publish events to Azure Event Hub when stock is low
- Log events with `architecture='SERVERLESS'`

**Order Processing Service (Section C - OrderMS):**
```bash
node serverless-group/orderms/index.js
```
This will:
- Listen for order commands from Azure Event Hub
- Process and save orders to database
- Log events with `architecture='SERVERLESS'`

### Option 2: Run Tests

**Integration Tests:**
```bash
# Test Serverless flow (with Azure)
node tests/integration/section-c-full-test.js

# Test SOAP flow  
node tests/integration/soap-flow.test.js
```

**Unit Tests:**
```bash
npm test
```

---

## 🗄 Database Access

### Adminer Web UI (Recommended)
```
URL: http://localhost:8080
System: PostgreSQL
Server: hospital-d-db (or: database)
Username: postgres
Password: postgres
Database: hospital_d_db
```

### Command Line
```bash
# Connect to database
docker exec -it hospital-d-db psql -U postgres -d hospital_d_db

# View tables
\dt

# Check stock
SELECT * FROM stock;

# Check orders by source
SELECT source, COUNT(*) FROM orders GROUP BY source;

# Check events by architecture  
SELECT architecture, COUNT(*) FROM event_log GROUP BY architecture;

# Exit
\q
```

---

## ✅ Verification Queries

### Check Data Separation
```sql
-- Should show both SOA and SERVERLESS
SELECT architecture, COUNT(*) as count 
FROM event_log 
GROUP BY architecture;

-- Expected:
-- SOA         | 3
-- SERVERLESS  | 6
```

### Check Order Sources
```sql
-- Should show both SOA and SERVERLESS
SELECT source, COUNT(*) as count 
FROM orders 
GROUP BY source;

-- Expected:
-- SOA         | 1
-- SERVERLESS  | 3
```

### View Recent Events
```sql
SELECT 
  event_type,
  architecture,
  direction,
  status,
  latency_ms,
  timestamp
FROM event_log
ORDER BY timestamp DESC
LIMIT 10;
```

---

## 🧪 Testing Azure Connections

### Test Event Hub Connection
```bash
node scripts/verify-eventhub-connection.js
```

**Expected Output:**
```
--- Azure Event Hub Connection Test ---
Topic: inventory-low-events
Connection string: Found
🔄 Attempting to connect (60s timeout)...
✅ SUCCESS: Connected to Azure Event Hub!
✅ Verified: Credentials are correct.
✅ Verified: WebSocket transport is working.
✅ Connection closed gracefully.
```

### Test SOAP Connection
```bash
# The SOAP service will auto-connect when you run it
# Or test directly:
node -e "const soap = require('./soap-group/soap-client'); soap.initialize().then(() => console.log('✅ SOAP Connected!')).catch(e => console.error('❌ Error:', e.message))"
```

---

## 📊 System Status Check

### Check All Services
```bash
# Database
docker ps | grep hospital-d-db
# Should show: Up XX hours (healthy)

# Adminer
docker ps | grep adminer
# Should show: Up XX hours

# Test Event Hub
node scripts/verify-eventhub-connection.js

# View database
open http://localhost:8080
```

---

## 🐛 Troubleshooting

### Database Not Running
```bash
# Check status
docker ps -a | grep hospital-d-db

# Restart
npm run docker:down
npm run docker:up

# Check logs
docker logs hospital-d-db
```

### Connection Refused (Port 5432)
```bash
# Check if port is in use
lsof -i :5432

# Verify .env configuration
cat .env | grep DB_

# Try restart
docker restart hospital-d-db
```

### Event Hub Connection Timeout
```bash
# Verify connection string in .env
cat .env | grep EVENT_HUB

# Test network connectivity
curl -I https://medical-supply-chain-ns.servicebus.windows.net

# Check firewall/VPN settings
```

### SOAP Connection Error
```bash
# Verify SOAP endpoint
cat .env | grep SOAP_

# Test endpoint availability
curl -I https://team1-central-platform-eqajhdbjbggkfxhf.westeurope-01.azurewebsites.net/CentralServices

# Check if WSDL is accessible
curl https://team1-central-platform-eqajhdbjbggkfxhf.westeurope-01.azurewebsites.net/CentralServices?wsdl | head -5
```

---

## 🔧 Common Tasks

### Reset Database
```bash
# WARNING: This deletes all data!
npm run docker:down
docker volume rm hospital_d_data
npm run docker:up
npm run seed
```

### View Logs
```bash
# Database logs
docker logs hospital-d-db

# Follow logs
docker logs -f hospital-d-db

# View recent errors
docker logs hospital-d-db 2>&1 | grep -i error | tail -20
```

### Clear Test Data
```bash
docker exec -it hospital-d-db psql -U postgres -d hospital_d_db -c "DELETE FROM orders WHERE order_id LIKE 'TEST-%' OR order_id LIKE 'ORD-E2E-%';"

docker exec -it hospital-d-db psql -U postgres -d hospital_d_db -c "DELETE FROM event_log WHERE payload::text LIKE '%test%';"
```

---

## 🎯 Success Criteria

You're fully set up when:

- ✅ Database is running (`docker ps` shows healthy)
- ✅ Adminer accessible at http://localhost:8080
- ✅ Stock data loaded (1 row for Hospital-D)
- ✅ Event logging working (both SOA and SERVERLESS)
- ✅ Order tracking working (both SOA and SERVERLESS)
- ✅ Azure Event Hub connection verified
- ✅ Azure SOAP endpoint accessible

---

## 📚 Next Steps

### For Testing
```bash
# Run all tests
npm test

# Run specific integration test
node tests/integration/section-c-full-test.js

# Check performance
node -e "const perf = require('./serverless-group/common/performance-tracker'); perf.getServerlessPerformanceMetrics().then(m => console.log(m))"
```

### For Deployment (Optional)
```bash
# Build Docker images
docker-compose -f docker/docker-compose.yml build

# Start containers
docker-compose -f docker/docker-compose.yml up
```

---

## 🔗 Useful Commands

```bash
# Database
npm run docker:up          # Start PostgreSQL
npm run docker:down        # Stop PostgreSQL
npm run docker:logs        # View logs
npm run seed               # Load initial data

# Testing
npm test                   # Run all tests
node tests/integration/section-c-full-test.js  # Section C E2E test

# Database Access
docker exec -it hospital-d-db psql -U postgres -d hospital_d_db  # CLI access
open http://localhost:8080 # Web UI (Adminer)

# Verification
node scripts/verify-eventhub-connection.js  # Test Event Hub
cat DATABASE_VERIFICATION_REPORT.md         # View database status
```

---

## ✅ System Status

**Current State:**
```
✅ Section A (Stock Monitoring): Complete
✅ Section B (SOA/SOAP): Complete + Azure Connected
✅ Section C (Serverless): Complete + Azure Connected
✅ Section D (Database): Complete + Running
🟡 Section E (Docker): Optional - Files ready

Overall: PRODUCTION READY ✅
```

**Azure Integrations:**
```
✅ SOAP Endpoint: Connected
✅ Event Hub: Connected & Tested
✅ Database: Verified (SOA/SERVERLESS separation working)
```

---

**Ready to go!** 🚀

For detailed documentation, see `README.md`
