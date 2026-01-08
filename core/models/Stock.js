/**
 * Stock Model
 * Represents stock inventory record
 */

class Stock {
    constructor(data = {}) {
        this.stock_id = data.stock_id || null;
        this.hospital_id = data.hospital_id || 'Hospital-D';
        this.product_code = data.product_code || 'PHYSIO-SALINE-500ML';
        this.current_stock_units = data.current_stock_units || 0;
        this.daily_consumption_units = data.daily_consumption_units || 0;
        this.days_of_supply = data.days_of_supply || 0;
        this.reorder_threshold = data.reorder_threshold || 2.0;
        this.max_stock_level = data.max_stock_level || 0;
        this.last_updated = data.last_updated || new Date();
        this.created_at = data.created_at || new Date();
    }

    /**
     * Calculate days of supply
     * @returns {number}
     */
    calculateDaysOfSupply() {
        if (this.daily_consumption_units === 0) {
            return Number.MAX_VALUE;
        }
        return Math.round((this.current_stock_units / this.daily_consumption_units) * 100) / 100;
    }

    /**
     * Check if stock is below threshold
     * @returns {boolean}
     */
    isBelowThreshold() {
        return this.days_of_supply < this.reorder_threshold;
    }

    /**
     * Validate stock data
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validate() {
        const errors = [];

        if (this.current_stock_units < 0) {
            errors.push('current_stock_units must be >= 0');
        }

        if (this.daily_consumption_units <= 0) {
            errors.push('daily_consumption_units must be > 0');
        }

        if (this.days_of_supply < 0) {
            errors.push('days_of_supply must be >= 0');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Convert to plain object
     * @returns {Object}
     */
    toJSON() {
        return {
            stock_id: this.stock_id,
            hospital_id: this.hospital_id,
            product_code: this.product_code,
            current_stock_units: this.current_stock_units,
            daily_consumption_units: this.daily_consumption_units,
            days_of_supply: this.days_of_supply,
            reorder_threshold: this.reorder_threshold,
            max_stock_level: this.max_stock_level,
            last_updated: this.last_updated,
            created_at: this.created_at
        };
    }
}

module.exports = Stock;
