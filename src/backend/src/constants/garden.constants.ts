/**
 * Garden Constants
 * @packageVersion 5.0
 * 
 * Defines constant values and configuration parameters for garden-related functionality
 * including area limits, sunlight conditions, spacing rules and optimization parameters.
 */

/**
 * Garden area validation limits in square feet
 * Enforces the acceptable range for garden dimensions (F-001-RQ-001)
 */
export const GARDEN_AREA_LIMITS = {
    MIN_AREA: 1,
    MAX_AREA: 1000
} as const;

/**
 * Predefined sunlight condition types for garden zones (F-001-RQ-002)
 * Used to categorize different areas of the garden based on sun exposure
 */
export const SUNLIGHT_CONDITIONS = {
    FULL_SUN: 'FULL_SUN',
    PARTIAL_SHADE: 'PARTIAL_SHADE',
    FULL_SHADE: 'FULL_SHADE'
} as const;

/**
 * Required daily sunlight hours for each condition type
 * Used in space optimization calculations and plant placement
 */
export const SUNLIGHT_HOURS = {
    FULL_SUN: 6,
    PARTIAL_SHADE: 4,
    FULL_SHADE: 2
} as const;

/**
 * Minimum size requirement for a garden zone in square feet
 * Ensures zones are large enough for practical planting
 */
export const MIN_ZONE_SIZE = 4;

/**
 * Default spacing between plants in inches
 * Used when specific plant spacing is not provided
 */
export const DEFAULT_PLANT_SPACING = 12;

/**
 * Target percentage for garden space utilization
 * Aligns with technical specification requirement of 92% space utilization
 */
export const SPACE_UTILIZATION_TARGET = 92;

/**
 * Time-to-live for optimization cache in seconds (24 hours)
 * Controls how long optimization results are cached
 */
export const OPTIMIZATION_CACHE_TTL = 86400;

/**
 * Maximum time allowed for layout generation in milliseconds
 * Ensures layout generation meets the 3-second performance requirement
 */
export const LAYOUT_GENERATION_TIMEOUT = 3000;

// Type definitions for enhanced type safety
export type SunlightCondition = typeof SUNLIGHT_CONDITIONS[keyof typeof SUNLIGHT_CONDITIONS];
export type SunlightHours = typeof SUNLIGHT_HOURS[keyof typeof SUNLIGHT_HOURS];

// Validation type guards
export const isSunlightCondition = (value: string): value is SunlightCondition => {
    return Object.values(SUNLIGHT_CONDITIONS).includes(value as SunlightCondition);
};

export const isValidGardenArea = (area: number): boolean => {
    return area >= GARDEN_AREA_LIMITS.MIN_AREA && area <= GARDEN_AREA_LIMITS.MAX_AREA;
};