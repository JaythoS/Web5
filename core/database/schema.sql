-- Hospital-D Medical Supply Chain Database Schema
-- PostgreSQL 14+
-- Team 5 - Hospital-D

-- =====================================================
-- TABLE 1: STOCK
-- =====================================================
CREATE TABLE IF NOT EXISTS stock (
    stock_id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(50) NOT NULL DEFAULT 'Hospital-D',
    product_code VARCHAR(100) NOT NULL,
    current_stock_units INTEGER NOT NULL CHECK (current_stock_units >= 0),
    daily_consumption_units INTEGER NOT NULL CHECK (daily_consumption_units > 0),
    days_of_supply NUMERIC(5,2) NOT NULL CHECK (days_of_supply >= 0),
    reorder_threshold NUMERIC(3,1) NOT NULL DEFAULT 2.0,
    max_stock_level INTEGER NOT NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(hospital_id, product_code)
);

-- =====================================================
-- TABLE 2: ORDERS
-- CRITICAL: source column for SOA/SERVERLESS distinction
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(100) PRIMARY KEY,
    command_id VARCHAR(100) UNIQUE,
    hospital_id VARCHAR(50) NOT NULL,
    product_code VARCHAR(100) NOT NULL,
    order_quantity INTEGER NOT NULL CHECK (order_quantity > 0),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('URGENT', 'HIGH', 'NORMAL')),
    order_status VARCHAR(20) NOT NULL CHECK (order_status IN ('PENDING', 'RECEIVED', 'DELIVERED')),
    estimated_delivery_date TIMESTAMP NOT NULL,
    actual_delivery_date TIMESTAMP,
    warehouse_id VARCHAR(50) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('SOA', 'SERVERLESS')),
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE 3: EVENT_LOG
-- CRITICAL: architecture column for performance comparison
-- =====================================================
CREATE TABLE IF NOT EXISTS event_log (
    log_id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('STOCK_UPDATE_SENT', 'INVENTORY_EVENT_PUBLISHED', 'ORDER_RECEIVED')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('OUTGOING', 'INCOMING')),
    architecture VARCHAR(20) NOT NULL CHECK (architecture IN ('SOA', 'SERVERLESS')),
    payload TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
    error_message TEXT,
    latency_ms INTEGER CHECK (latency_ms >= 0),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE 4: CONSUMPTION_HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS consumption_history (
    consumption_id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(50) NOT NULL,
    product_code VARCHAR(100) NOT NULL,
    consumption_date DATE NOT NULL,
    units_consumed INTEGER NOT NULL CHECK (units_consumed >= 0),
    opening_stock INTEGER NOT NULL CHECK (opening_stock >= 0),
    closing_stock INTEGER NOT NULL CHECK (closing_stock >= 0),
    day_of_week VARCHAR(10) NOT NULL,
    is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(hospital_id, product_code, consumption_date)
);

-- =====================================================
-- TABLE 5: ALERTS
-- =====================================================
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(50) NOT NULL,
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('LOW_STOCK', 'CRITICAL_STOCK', 'OUT_OF_STOCK')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('NORMAL', 'HIGH', 'URGENT', 'CRITICAL')),
    current_stock INTEGER NOT NULL CHECK (current_stock >= 0),
    daily_consumption INTEGER NOT NULL CHECK (daily_consumption > 0),
    days_of_supply NUMERIC(5,2) NOT NULL CHECK (days_of_supply >= 0),
    threshold NUMERIC(3,1) NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Stock indexes
CREATE INDEX IF NOT EXISTS idx_stock_hospital_product ON stock(hospital_id, product_code);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_hospital ON orders(hospital_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- EventLog indexes (CRITICAL for performance comparison)
CREATE INDEX IF NOT EXISTS idx_event_log_timestamp ON event_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_architecture ON event_log(architecture);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);

-- ConsumptionHistory indexes
CREATE INDEX IF NOT EXISTS idx_consumption_date ON consumption_history(consumption_date DESC);
CREATE INDEX IF NOT EXISTS idx_consumption_hospital ON consumption_history(hospital_id, product_code);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE stock IS 'Main inventory table for Hospital-D';
COMMENT ON COLUMN orders.source IS 'CRITICAL: SOA or SERVERLESS - for performance comparison';
COMMENT ON COLUMN event_log.architecture IS 'CRITICAL: SOA or SERVERLESS - for metrics analysis';
COMMENT ON TABLE event_log IS 'All system events for both SOA and Serverless paths';
COMMENT ON TABLE consumption_history IS 'Daily consumption records';
COMMENT ON TABLE alerts IS 'Stock alert history';
