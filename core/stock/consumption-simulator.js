/**
 * Consumption Simulator Module
 * Hospital-D Supply Chain Management
 * 
 * SHARED MODULE - Used by both SOAP and Serverless groups
 * 
 * Simulates daily consumption with realistic patterns:
 * - Weekend vs weekday variation
 * - Random variation (±15%)
 * - Spike probability (5% chance of 50% increase)
 */

const { getCurrentStock, insertConsumption, getAverageConsumption } = require('../database/db-operations');
const { updateStockLevel } = require('./stock-tracker');
const logger = require('../../utils/logger');

/**
 * Calculate daily consumption with realistic variations
 * 
 * @param {number} baseConsumption - Base consumption rate (default: 52 units/day)
 * @param {Date} date - Date for consumption (for weekday/weekend detection)
 * @returns {Object} Consumption details
 */
function calculateDailyConsumption(baseConsumption = 52, date = new Date()) {
    // Step 1: Weekday/Weekend factor
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const weekdayFactor = isWeekend ? 0.85 : 1.0; // 15% less on weekends

    // Step 2: Random variation (±15%)
    // Random value between 0.85 and 1.15
    const randomFactor = 0.85 + (Math.random() * 0.30);

    // Step 3: Spike probability (5% chance)
    const spikeRoll = Math.random() * 100;
    const hasSpike = (spikeRoll < 5); // 5% probability
    const spikeFactor = hasSpike ? 1.5 : 1.0; // 50% increase on spike

    // Step 4: Calculate final consumption
    const consumption = Math.round(
        baseConsumption * weekdayFactor * randomFactor * spikeFactor
    );

    return {
        consumption,
        isWeekend,
        hasSpike,
        factors: {
            weekday: weekdayFactor,
            random: randomFactor,
            spike: spikeFactor,
            final: weekdayFactor * randomFactor * spikeFactor
        }
    };
}

/**
 * Simulate one day's consumption
 * Updates stock and records consumption history
 * 
 * @param {Date} date - Date to simulate (default: today)
 * @returns {Promise<Object>} Simulation result
 */
async function simulateDayConsumption(date = new Date()) {
    try {
        // 1. Get current stock
        const stockRecord = await getCurrentStock('PHYSIO-SALINE-500ML');
        if (!stockRecord) {
            throw new Error('Stock record not found');
        }

        const openingStock = stockRecord.current_stock_units;
        const baseConsumption = stockRecord.daily_consumption_units;

        // 2. Calculate consumption for the day
        const { consumption, isWeekend, hasSpike, factors } = calculateDailyConsumption(baseConsumption, date);

        // 3. Calculate new stock level (cannot go negative)
        const closingStock = Math.max(0, openingStock - consumption);

        // 4. Get 7-day average consumption for days_of_supply calculation
        const avgConsumption = await getAverageConsumption(7) || baseConsumption;

        // 5. Update stock table
        await updateStockLevel(closingStock, avgConsumption, 'PHYSIO-SALINE-500ML');

        // 6. Record consumption history
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        const notes = hasSpike ? 'SPIKE DETECTED - High consumption day' : null;

        await insertConsumption({
            hospital_id: 'Hospital-D',
            product_code: 'PHYSIO-SALINE-500ML',
            consumption_date: date,
            units_consumed: consumption,
            opening_stock: openingStock,
            closing_stock: closingStock,
            day_of_week: dayOfWeek,
            is_weekend: isWeekend,
            notes
        });

        // 7. Log the simulation
        logger.info('Day consumption simulated', {
            date: date.toISOString().split('T')[0],
            consumed: consumption,
            opening: openingStock,
            closing: closingStock,
            isWeekend,
            hasSpike,
            factors: factors.final.toFixed(2)
        });

        if (hasSpike) {
            logger.warn('⚠️  SPIKE DETECTED - Consumption unusually high!');
        }

        return {
            date,
            consumed: consumption,
            openingStock,
            closingStock,
            daysOfSupply: closingStock / avgConsumption,
            isWeekend,
            hasSpike,
            factors
        };
    } catch (error) {
        logger.error('Failed to simulate day consumption', { error: error.message });
        throw error;
    }
}

/**
 * Analyze consumption trend
 * Compares first half vs second half of period
 * 
 * @param {number} days - Number of days to analyze (7 or 30)
 * @returns {Promise<Object>} Trend analysis
 */
async function analyzeTrend(days = 7) {
    try {
        const { getConsumptionHistory } = require('../database/db-operations');
        const history = await getConsumptionHistory(days, 'PHYSIO-SALINE-500ML');

        if (history.length === 0) {
            return {
                period: days,
                message: 'No historical data available',
                trendDirection: 'UNKNOWN'
            };
        }

        // Calculate overall average
        const average = history.reduce((sum, day) => sum + day.units_consumed, 0) / history.length;

        // Split into two halves
        const midpoint = Math.floor(history.length / 2);
        const firstHalf = history.slice(0, midpoint);
        const secondHalf = history.slice(midpoint);

        const firstAvg = firstHalf.reduce((sum, day) => sum + day.units_consumed, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, day) => sum + day.units_consumed, 0) / secondHalf.length;

        // Determine trend direction
        let trendDirection = 'STABLE';
        const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (Math.abs(changePercent) < 5) {
            trendDirection = 'STABLE';
        } else if (changePercent > 0) {
            trendDirection = 'INCREASING';
        } else {
            trendDirection = 'DECREASING';
        }

        return {
            period: days,
            average: Math.round(average * 100) / 100,
            firstHalfAvg: Math.round(firstAvg * 100) / 100,
            secondHalfAvg: Math.round(secondAvg * 100) / 100,
            trendDirection,
            changePercent: Math.round(changePercent * 100) / 100
        };
    } catch (error) {
        logger.error('Failed to analyze trend', { error: error.message });
        throw error;
    }
}

/**
 * Detect consumption anomalies
 * 
 * @param {number} consumption - Actual consumption
 * @param {number} expected - Expected consumption
 * @returns {Object} Anomaly detection result
 */
function detectAnomaly(consumption, expected) {
    // High consumption (50%+ above expected)
    if (consumption >= expected * 1.5) {
        return {
            type: 'HIGH_CONSUMPTION',
            severity: 'WARNING',
            message: `Consumption ${consumption} is 50%+ above expected ${expected}`,
            deviation: ((consumption - expected) / expected * 100).toFixed(1) + '%'
        };
    }

    // Zero consumption (possible system error)
    if (consumption === 0) {
        return {
            type: 'ZERO_CONSUMPTION',
            severity: 'ERROR',
            message: 'Zero consumption detected - possible system error'
        };
    }

    // Negative consumption (data corruption)
    if (consumption < 0) {
        return {
            type: 'NEGATIVE_CONSUMPTION',
            severity: 'CRITICAL',
            message: 'Negative consumption - data corruption detected'
        };
    }

    // Normal range
    return {
        type: 'NO_ANOMALY',
        severity: 'NORMAL',
        message: 'Consumption within normal range'
    };
}

module.exports = {
    calculateDailyConsumption,
    simulateDayConsumption,
    analyzeTrend,
    detectAnomaly
};
