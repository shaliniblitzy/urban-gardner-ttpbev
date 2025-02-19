/**
 * Plant-related constants and enums for garden planning and maintenance
 * Provides foundational data for garden optimization algorithms and scheduling
 * @version 1.0.0
 */

/**
 * Supported plant types for garden planning and maintenance
 */
export enum PLANT_TYPES {
    TOMATOES = 'tomatoes',
    LETTUCE = 'lettuce',
    CARROTS = 'carrots'
}

/**
 * Plant lifecycle stages for maintenance scheduling
 */
export enum GROWTH_STAGES {
    SEEDLING = 'seedling',
    GROWING = 'growing',
    MATURE = 'mature',
    HARVESTING = 'harvesting'
}

/**
 * Sunlight categories for garden zone planning
 */
export enum SUNLIGHT_REQUIREMENTS {
    FULL_SUN = 'full_sun',
    PARTIAL_SHADE = 'partial_shade',
    FULL_SHADE = 'full_shade'
}

/**
 * Required spacing in inches between plants for layout optimization
 * Based on standard horticultural spacing guidelines
 */
export const DEFAULT_PLANT_SPACING: Record<PLANT_TYPES, number> = {
    [PLANT_TYPES.TOMATOES]: 24, // 2 feet spacing for proper growth
    [PLANT_TYPES.LETTUCE]: 12,  // 1 foot spacing for leaf development
    [PLANT_TYPES.CARROTS]: 3    // 3 inches for root development
};

/**
 * Expected days until plant maturity for harvest planning
 * Based on average growing conditions
 */
export const DAYS_TO_MATURITY: Record<PLANT_TYPES, number> = {
    [PLANT_TYPES.TOMATOES]: 80, // From transplant to first harvest
    [PLANT_TYPES.LETTUCE]: 45,  // From seed to harvest
    [PLANT_TYPES.CARROTS]: 70   // From seed to harvest
};

/**
 * Watering interval in days for maintenance scheduling
 * Assumes average climate conditions - adjust based on weather
 */
export const WATERING_FREQUENCY_DAYS: Record<PLANT_TYPES, number> = {
    [PLANT_TYPES.TOMATOES]: 3,  // Deep watering every 3 days
    [PLANT_TYPES.LETTUCE]: 2,   // Frequent light watering
    [PLANT_TYPES.CARROTS]: 3    // Consistent moisture for root development
};

/**
 * Fertilizing interval in days for maintenance scheduling
 * Based on standard growing season requirements
 */
export const FERTILIZING_FREQUENCY_DAYS: Record<PLANT_TYPES, number> = {
    [PLANT_TYPES.TOMATOES]: 14, // Heavy feeders need frequent fertilizing
    [PLANT_TYPES.LETTUCE]: 21,  // Moderate feeding requirements
    [PLANT_TYPES.CARROTS]: 30   // Light feeding requirements
};

/**
 * Minimum daily sunlight hours required for optimal growth
 * Critical for garden zone planning and plant placement
 */
export const MIN_SUNLIGHT_HOURS: Record<PLANT_TYPES, number> = {
    [PLANT_TYPES.TOMATOES]: 6, // Full sun vegetables
    [PLANT_TYPES.LETTUCE]: 4,  // Tolerates partial shade
    [PLANT_TYPES.CARROTS]: 5   // Moderate sun requirements
};

/**
 * Compatible companion plants for optimizing garden layout
 * Based on beneficial plant relationships
 */
export const COMPANION_PLANTS: Record<PLANT_TYPES, PLANT_TYPES[]> = {
    [PLANT_TYPES.TOMATOES]: [PLANT_TYPES.LETTUCE],     // Lettuce provides ground cover
    [PLANT_TYPES.LETTUCE]: [PLANT_TYPES.CARROTS],      // Carrots break up soil for lettuce
    [PLANT_TYPES.CARROTS]: [PLANT_TYPES.TOMATOES]      // Tomatoes provide shade
};