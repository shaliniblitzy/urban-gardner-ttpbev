/**
 * Garden Validator
 * @packageVersion 5.0
 * 
 * Implements comprehensive validation logic for garden-related data including
 * dimensions, zones, sunlight conditions, and optimization parameters.
 */

import { 
    ValidationError,
    IsNumber,
    IsString,
    IsArray,
    Min,
    Max,
    ValidateNested
} from 'class-validator'; // @version 0.14.0

import { 
    IGarden,
    IGardenZone
} from '../interfaces/garden.interface';

import {
    GARDEN_AREA_LIMITS,
    SUNLIGHT_CONDITIONS,
    MIN_ZONE_SIZE,
    isSunlightCondition,
    isValidGardenArea
} from '../constants/garden.constants';

/**
 * Main validation function for garden input data
 * Validates all garden properties according to technical specifications
 * @param garden The garden configuration to validate
 * @returns Promise<boolean> True if valid, throws ValidationError if invalid
 */
export async function validateGardenInput(garden: IGarden): Promise<boolean> {
    if (!garden) {
        throw new ValidationError('Garden configuration is required');
    }

    // Validate garden area
    await validateGardenArea(garden.area);

    // Validate garden zones
    await validateGardenZones(garden.zones);

    // Verify total zone areas match garden area
    const totalZoneArea = garden.zones.reduce((sum, zone) => sum + zone.area, 0);
    if (Math.abs(totalZoneArea - garden.area) > 0.01) { // Allow small rounding differences
        throw new ValidationError(
            `Total zone area (${totalZoneArea}) must match garden area (${garden.area})`
        );
    }

    return true;
}

/**
 * Validates garden area against defined limits
 * Implements F-001-RQ-001 requirements
 * @param area Garden area in square feet
 * @returns boolean True if valid, throws ValidationError if invalid
 */
export function validateGardenArea(area: number): boolean {
    if (!Number.isFinite(area)) {
        throw new ValidationError('Garden area must be a valid number');
    }

    if (!isValidGardenArea(area)) {
        throw new ValidationError(
            `Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} square feet`
        );
    }

    // Check for special characters in string representation
    if (!/^\d+(\.\d+)?$/.test(area.toString())) {
        throw new ValidationError('Garden area must contain only numeric characters');
    }

    return true;
}

/**
 * Validates sunlight condition against allowed types
 * Implements F-001-RQ-002 requirements
 * @param condition Sunlight condition to validate
 * @returns boolean True if valid, throws ValidationError if invalid
 */
export function validateSunlightCondition(condition: string): boolean {
    if (!condition || typeof condition !== 'string') {
        throw new ValidationError('Sunlight condition must be a non-empty string');
    }

    if (!isSunlightCondition(condition)) {
        throw new ValidationError(
            `Invalid sunlight condition. Must be one of: ${Object.values(SUNLIGHT_CONDITIONS).join(', ')}`
        );
    }

    return true;
}

/**
 * Validates garden zones configuration
 * Implements zone-related requirements from F-001
 * @param zones Array of garden zones to validate
 * @returns boolean True if valid, throws ValidationError if invalid
 */
export function validateGardenZones(zones: IGardenZone[]): boolean {
    if (!Array.isArray(zones)) {
        throw new ValidationError('Garden zones must be an array');
    }

    if (zones.length === 0) {
        throw new ValidationError('At least one garden zone is required');
    }

    // Validate each zone
    zones.forEach((zone, index) => {
        // Validate zone area
        if (!Number.isFinite(zone.area) || zone.area < MIN_ZONE_SIZE) {
            throw new ValidationError(
                `Zone ${index + 1} area must be a number >= ${MIN_ZONE_SIZE} square feet`
            );
        }

        // Validate sunlight condition
        validateSunlightCondition(zone.sunlightCondition);

        // Validate zone position if provided
        if (zone.position) {
            if (!Number.isFinite(zone.position.x) || !Number.isFinite(zone.position.y)) {
                throw new ValidationError(
                    `Zone ${index + 1} position must have valid x and y coordinates`
                );
            }
        }
    });

    // Check for zone overlaps
    for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
            if (checkZoneOverlap(zones[i], zones[j])) {
                throw new ValidationError(
                    `Zone ${i + 1} overlaps with zone ${j + 1}`
                );
            }
        }
    }

    return true;
}

/**
 * Helper function to check if two zones overlap
 * @param zone1 First zone to check
 * @param zone2 Second zone to check
 * @returns boolean True if zones overlap
 */
function checkZoneOverlap(zone1: IGardenZone, zone2: IGardenZone): boolean {
    if (!zone1.position || !zone2.position) {
        return false; // Cannot check overlap without positions
    }

    // Simple rectangular overlap check
    const z1 = zone1.position;
    const z2 = zone2.position;
    
    // Assuming each zone has width and height derived from area
    const z1Width = Math.sqrt(zone1.area);
    const z2Width = Math.sqrt(zone2.area);

    return !(
        z1.x + z1Width < z2.x ||
        z2.x + z2Width < z1.x ||
        z1.y + z1Width < z2.y ||
        z2.y + z2Width < z1.y
    );
}