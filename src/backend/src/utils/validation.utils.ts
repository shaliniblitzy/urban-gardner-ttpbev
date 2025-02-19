/**
 * Garden Validation Utilities
 * @packageVersion 5.0
 * 
 * Provides comprehensive validation functions for garden-related data including
 * dimensions, sunlight conditions, and zone configurations. Implements validation
 * requirements from F-001-RQ-001 and F-001-RQ-002.
 */

import { ValidationError } from 'class-validator'; // @version 0.14.0
import { sanitizeNumber } from 'validator'; // @version 13.7.0

import { IGarden, IGardenZone } from '../interfaces/garden.interface';
import { 
    GARDEN_AREA_LIMITS,
    SUNLIGHT_CONDITIONS,
    MIN_ZONE_SIZE,
    isValidGardenArea,
    isSunlightCondition
} from '../constants/garden.constants';

/**
 * Validates and sanitizes garden area input
 * Implements requirement F-001-RQ-001 for garden dimension validation
 * 
 * @param area - Garden area in square feet
 * @returns true if area is valid
 * @throws ValidationError if validation fails
 */
export const validateGardenArea = (area: number): boolean => {
    // Sanitize input
    const sanitizedArea = Number(sanitizeNumber(String(area)));

    // Check if area is a valid number
    if (isNaN(sanitizedArea)) {
        throw new ValidationError('Garden area must be a valid number');
    }

    // Validate against area limits
    if (!isValidGardenArea(sanitizedArea)) {
        throw new ValidationError(
            `Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} square feet`
        );
    }

    return true;
};

/**
 * Validates sunlight condition against allowed types
 * Implements requirement F-001-RQ-002 for sunlight condition validation
 * 
 * @param condition - Sunlight condition to validate
 * @returns true if condition is valid
 * @throws ValidationError if validation fails
 */
export const validateSunlightCondition = (condition: string): boolean => {
    // Normalize input
    const normalizedCondition = condition.trim().toUpperCase();

    // Validate against defined conditions
    if (!isSunlightCondition(normalizedCondition)) {
        throw new ValidationError(
            `Invalid sunlight condition. Must be one of: ${Object.values(SUNLIGHT_CONDITIONS).join(', ')}`
        );
    }

    return true;
};

/**
 * Validates garden zones configuration including area distribution and sunlight conditions
 * 
 * @param zones - Array of garden zones to validate
 * @param totalGardenArea - Total garden area for reference
 * @returns true if zones are valid
 * @throws ValidationError if validation fails
 */
export const validateGardenZones = (zones: IGardenZone[], totalGardenArea: number): boolean => {
    // Verify zones array exists and is not empty
    if (!Array.isArray(zones) || zones.length === 0) {
        throw new ValidationError('At least one garden zone must be defined');
    }

    // Calculate total zone area
    const totalZoneArea = zones.reduce((sum, zone) => sum + zone.area, 0);

    // Verify total zone area doesn't exceed garden area
    if (totalZoneArea > totalGardenArea) {
        throw new ValidationError(
            `Total zone area (${totalZoneArea}) cannot exceed garden area (${totalGardenArea})`
        );
    }

    // Validate individual zones
    for (const zone of zones) {
        // Check minimum zone size
        if (zone.area < MIN_ZONE_SIZE) {
            throw new ValidationError(
                `Zone area (${zone.area}) cannot be less than minimum size (${MIN_ZONE_SIZE})`
            );
        }

        // Validate sunlight condition
        validateSunlightCondition(zone.sunlightCondition);
    }

    return true;
};

/**
 * Validates complete garden configuration
 * 
 * @param garden - Garden configuration to validate
 * @returns true if garden configuration is valid
 * @throws ValidationError if validation fails
 */
export const validateGarden = (garden: IGarden): boolean => {
    // Validate garden area
    validateGardenArea(garden.area);

    // Validate zones
    validateGardenZones(garden.zones, garden.area);

    return true;
};