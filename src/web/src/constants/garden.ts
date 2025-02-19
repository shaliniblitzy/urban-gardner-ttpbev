import { SunlightCondition } from '../types/zone.types';

/**
 * Garden area validation limits in square feet
 * Based on requirement F-001-RQ-001: Input garden dimensions
 */
export const GARDEN_VALIDATION = {
    AREA_LIMITS: {
        MIN: 1,    // Minimum garden area in sq ft
        MAX: 1000  // Maximum garden area in sq ft
    },
    MIN_ZONE_SIZE: 4  // Minimum zone size in sq ft for viable planting
} as const;

/**
 * Default garden configuration values
 * Derived from space optimization requirements and best practices
 */
export const GARDEN_DEFAULTS = {
    ZONE_SIZE: 25,               // Default zone size in sq ft
    TARGET_UTILIZATION: 0.92     // Target space utilization (92%)
} as const;

/**
 * Sunlight requirements in hours per day for different conditions
 * Based on horticultural standards and plant growth requirements
 */
export const SUNLIGHT_REQUIREMENTS = {
    [SunlightCondition.FULL_SUN]: {
        min: 6,    // Minimum hours of direct sunlight
        max: 14    // Maximum hours of direct sunlight
    },
    [SunlightCondition.PARTIAL_SHADE]: {
        min: 3,    // Minimum hours of direct sunlight
        max: 6     // Maximum hours of direct sunlight
    },
    [SunlightCondition.FULL_SHADE]: {
        min: 0,    // Minimum hours of direct sunlight
        max: 3     // Maximum hours of direct sunlight
    }
} as const;

/**
 * Plant spacing multipliers for different sunlight conditions
 * Used in space optimization calculations
 */
export const SPACING_MULTIPLIERS = {
    [SunlightCondition.FULL_SUN]: 1.0,      // Standard spacing
    [SunlightCondition.PARTIAL_SHADE]: 1.2,  // 20% more space for partial shade
    [SunlightCondition.FULL_SHADE]: 1.5      // 50% more space for full shade
} as const;

/**
 * Zone optimization parameters
 * Used by the space optimization algorithm
 */
export const OPTIMIZATION_PARAMS = {
    MIN_PATH_WIDTH: 2,           // Minimum width for paths between zones in ft
    EDGE_BUFFER: 1,              // Buffer space at garden edges in ft
    MAX_ZONE_ASPECT_RATIO: 3,    // Maximum length:width ratio for zones
    MIN_ZONE_DIMENSION: 2        // Minimum zone dimension in any direction in ft
} as const;

/**
 * Error margin constants for calculations
 * Used in validation and optimization processes
 */
export const ERROR_MARGINS = {
    AREA_CALCULATION: 0.1,       // 10% margin for area calculations
    SUNLIGHT_HOURS: 0.5,         // 30-minute margin for sunlight calculations
    SPACE_UTILIZATION: 0.05      // 5% margin for utilization calculations
} as const;