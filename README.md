# Hospital-D Medical Supply Chain Management System

## 🌟 Overview
This project implements a distributed medical supply chain management system for "Hospital-D". It operates in a hybrid architecture environment, integrating with Team 1's Central Platform via both **SOA (SOAP)** and **Serverless (Azure Event Hubs)** technologies.

The system monitors stock levels, tracks orders, handles critical alerts, and logs all events for audit purposes.

## 📊 Project Status

| Section | Description | Status | Completion |
| :--- | :--- | :---: | :---: |
| **A** | **Stock Monitoring & Simulation** | ✅ Complete | 100% |
| **B** | **SOA Integration (SOAP)** | ✅ Complete | 100% |
| **C** | **Serverless Integration** | ✅ Complete | 100% |
| **D** | **Database Management** | ✅ Complete | 100% |
| **E** | **Containerization** | 🟡 Optional | 90% |

### 🚀 Section Details

#### Section A: Stock Monitoring ✅
**Status:** Production Ready  
**Features:**
- Stock tracking logic
- Consumption simulator (52 units/day for 300-bed hospital)
- Alert system (2.0 days threshold)
- Threshold monitoring

#### Section B: SOA Integration (SOAP) ✅
**Status:** Production Ready - Azure Connected  
**Features:**
- ✅ 7 SOAP modules (1,275 lines of code)
- ✅ SOAP client, message builder, error handling
- ✅ Retry logic (3 attempts, exponential backoff)
- ✅ Performance tracking
- ✅ Database logging (`architecture='SOA'`)

**Azure Production:**
```
Endpoint: https://team1-central-platform-eqajhdbjbggkfxhf.westeurope-01.azurewebsites.net/CentralServices
Status: ✅ Connected and Verified
Database: 3 SOA events, 1 SOA order logged
```

#### Section C: Serverless Integration ✅
**Status:** Production Ready - Azure Connected  
**Features:**
- ✅ 9 serverless modules
- ✅ StockMS (Event Publisher) and OrderMS (Event Consumer)
- ✅ WebSocket transport (firewall-friendly)
- ✅ Error handling and performance tracking
- ✅ Database logging (`architecture='SERVERLESS'`)

**Azure Production:**
```
Event Hub: inventory-low-events
Namespace: medical-supply-chain-ns.servicebus.windows.net
Status: ✅ Connected and Tested
Test Results: All E2E tests passed (957ms publish, 6ms process)
Database: 6 SERVERLESS events, 3 SERVERLESS orders logged
```

#### Section D: Database Management ✅
**Status:** Running (32+ hours uptime)  
**Features:**
- PostgreSQL 13+ with strict constraints
- SOA/SERVERLESS architecture separation
- Event logging with latency tracking
- Adminer web UI: http://localhost:8080

**Database Status:**
```
Container: hospital-d-db (Up 32 hours - healthy)
Port: 5432
Tables: stock, orders, event_log, alerts, consumption_history
```

#### Section E: Containerization 🟡
**Status:** Docker Files Ready (Optional)  
**Completed:**
- ✅ Dockerfile.stockms
- ✅ Dockerfile.orderms
- ✅ Dockerfile.db
- ✅ docker-compose.yml

**Not Required:**
- Docker build (system runs natively with Node.js)
- Azure Container Apps deployment (already using Team 1's Azure services)

---

## ✅ System Verification

**Integration Status:**
```
✅ SOAP Service:  Connected to Team 1's Azure
✅ Event Hub:     Connected to Team 1's Azure
✅ Database:      SOA/SERVERLESS data verified
✅ System:        PRODUCTION READY
```

**Critical Data Verification:**
```sql
-- Architecture Distribution
SOA Events:        3 ✅
SERVERLESS Events: 6 ✅
Total Events:      9

-- Order Sources
SOA Orders:        1 ✅
SERVERLESS Orders: 3 ✅
Total Orders:      4

-- Separation Verified: No mixing of architectures ✅
```

---

## 🏗 Architecture

**Microservices-Ready Architecture:**
- **Core Logic:** Shared business logic (stock tracking, alerts, consumption simulation)
- **Database:** PostgreSQL with strict SOA/SERVERLESS constraints
- **Serverless Group:** StockMS (Producer) & OrderMS (Consumer) for Azure Event Hubs
- **SOAP Group:** SOAP client for legacy Central Platform integration

---

## 📂 Project Structure

```
/
├── core/                   # Shared business logic
│   ├── alert/              # Alert generation system
│   ├── database/           # PostgreSQL connection & operations
│   ├── models/             # Data models
│   └── stock/              # Stock tracking & consumption logic
├── config/                 # Environment configuration
├── serverless-group/       # SECTION C (Azure Event Hubs)
│   ├── common/             # Shared utilities
│   ├── stockms/            # Stock Monitoring Service (Producer)
│   └── orderms/            # Order Processing Service (Consumer)
├── soap-group/             # SECTION B (SOAP Integration)
│   ├── soap-client.js      # SOAP client implementation
│   ├── soap-service.js     # Service logic
│   ├── error-handler.js    # SOAP fault handling
│   └── retry-handler.js    # Retry mechanism
├── docker/                 # Containerization (optional)
│   ├── Dockerfile.stockms
│   ├── Dockerfile.orderms
│   └── docker-compose.yml
├── utils/                  # Logging utilities
├── tests/                  # Testing Suite (F1-F4)
│   ├── F.1-unit/           # Core logic unit tests
│   ├── F.2-integration/    # Real Azure integration tests
│   ├── F.3-scenarios/      # Chaos & resilience tests
│   ├── F.4-load/           # Load & stress testing
│   └── manual/             # Manual verification scripts
```

---

## 🚀 Getting Started

### Prerequisites
```bash
node --version  # >= 18.0.0
npm --version   # >= 9.0.0
docker --version # (optional, for database)
```

### Quick Setup
```bash
# 1. Install dependencies
npm install

# 2. Start database (Docker)
npm run docker:up

# 3. Configure environment
# Edit .env with your settings (already pre-configured)

# 4. Seed database
npm run seed

# 5. Verify setup
npm test
```

**For detailed instructions, see:** `QUICKSTART.md`

---

## 🔗 Azure Integrations

### SOAP (Section B)
```
WSDL: https://team1-central-platform-eqajhdbjbggkfxhf.westeurope-01.azurewebsites.net/CentralServices?wsdl
Methods: StockUpdate, CreateOrder
Status: ✅ Connected
```

### Event Hub (Section C)
```
Namespace: medical-supply-chain-ns.servicebus.windows.net
Topics: inventory-low-events, order-commands
Transport: AmqpWebSockets
Status: ✅ Connected
```

---

## 📊 Database Access

**Adminer UI:**
```
URL: http://localhost:8080
Server: hospital-d-db (or: database)
Username: postgres
Password: postgres
Database: hospital_d_db
```

**Command Line:**
```bash
docker exec -it hospital-d-db psql -U postgres -d hospital_d_db
```

---

## 🎯 Production Deployment

**Current Status:** ✅ READY FOR PRODUCTION

The system is:
- ✅ Fully implemented (Sections A, B, C, D)
- ✅ Connected to Team 1's Azure services
- ✅ Database verified with correct architecture separation
- ✅ Tested end-to-end

**Optional:** Docker containerization (Section E) is available but not required.

---

## 📜 System Status

| Component | Status | Uptime |
|-----------|--------|--------|
| Database | ✅ Running | 32+ hours |
| SOAP Integration | ✅ Connected | Azure Production |
| Event Hub | ✅ Connected | Azure Production |
| Node.js Services | ✅ Ready | Can start anytime |

---

## 📚 Documentation

- `QUICKSTART.md` - Setup guide
- `docs/SECTION_A_STOCK_MONITORING.md` - Stock monitoring details
- `docs/SECTION_B_SOA_INTEGRATION.md` - SOAP integration guide
- `docs/SECTION_C_SERVERLESS_INTEGRATION.md` - Event Hub integration
- `DATABASE_VERIFICATION_REPORT.md` - Database verification results
- `SECTION_E_STATUS_REPORT.md` - Containerization status

---

## 📜 License
Private Project - COMP464 Team 5 - Hospital-D
