/**
 * Order Model
 * Represents an order record
 * CRITICAL: source field (SOA/SERVERLESS)
 */

class Order {
    constructor(data = {}) {
        this.order_id = data.order_id || null;
        this.command_id = data.command_id || null;
        this.hospital_id = data.hospital_id || 'Hospital-D';
        this.product_code = data.product_code || 'PHYSIO-SALINE-500ML';
        this.order_quantity = data.order_quantity || 0;
        this.priority = data.priority || 'NORMAL';  // URGENT, HIGH, NORMAL
        this.order_status = data.order_status || 'PENDING';  // PENDING, RECEIVED, DELIVERED
        this.estimated_delivery_date = data.estimated_delivery_date || null;
        this.actual_delivery_date = data.actual_delivery_date || null;
        this.warehouse_id = data.warehouse_id || 'CENTRAL-WAREHOUSE';
        this.source = data.source || null;  // CRITICAL: SOA or SERVERLESS
        this.received_at = data.received_at || new Date();
        this.created_at = data.created_at || new Date();
    }

    /**
     * Validate order data
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validate() {
        const errors = [];

        if (!this.order_id) {
            errors.push('order_id is required');
        }

        if (!this.hospital_id) {
            errors.push('hospital_id is required');
        }

        if (!this.product_code) {
            errors.push('product_code is required');
        }

        if (this.order_quantity <= 0) {
            errors.push('order_quantity must be > 0');
        }

        if (!['URGENT', 'HIGH', 'NORMAL'].includes(this.priority)) {
            errors.push('priority must be URGENT, HIGH, or NORMAL');
        }

        if (!['PENDING', 'RECEIVED', 'DELIVERED'].includes(this.order_status)) {
            errors.push('order_status must be PENDING, RECEIVED, or DELIVERED');
        }

        // CRITICAL VALIDATION
        if (!['SOA', 'SERVERLESS'].includes(this.source)) {
            errors.push('source must be SOA or SERVERLESS');
        }

        if (!this.estimated_delivery_date) {
            errors.push('estimated_delivery_date is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if order is urgent
     * @returns {boolean}
     */
    isUrgent() {
        return this.priority === 'URGENT';
    }

    /**
     * Check if order is delivered
     * @returns {boolean}
     */
    isDelivered() {
        return this.order_status === 'DELIVERED';
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
        return {
            order_id: this.order_id,
            command_id: this.command_id,
            hospital_id: this.hospital_id,
            product_code: this.product_code,
            order_quantity: this.order_quantity,
            priority: this.priority,
            order_status: this.order_status,
            estimated_delivery_date: this.estimated_delivery_date,
            actual_delivery_date: this.actual_delivery_date,
            warehouse_id: this.warehouse_id,
            source: this.source,
            received_at: this.received_at,
            created_at: this.created_at
        };
    }
}

module.exports = Order;
