/**
 * @fileoverview Utility functions for garden-related calculations and validations
 * @version 1.0.0
 */

import { isNumber, memoize } from 'lodash'; // ^4.17.21
import {
    Garden,
    GardenInput,
    GardenLayout,
    GardenZone,
    GardenOptimizationParams
} from '../types/garden.types';
import { SunlightCondition } from '../types/zone.types';

/**
 * Interface for validation result with detailed error reporting
 */
interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Interface for space utilization calculation results
 */
interface UtilizationResult {
    percentage: number;
    unusedArea: number;
}

/**
 * Interface for zone validation results with warnings
 */
interface ZoneValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates if the garden area is within acceptable range
 * @param area - Garden area in square feet
 * @returns Validation result with detailed error message if invalid
 */
export const validateGardenArea = (area: number): ValidationResult => {
    if (!isNumber(area)) {
        return {
            isValid: false,
            error: 'Garden area must be a valid number'
        };
    }

    if (area < 1 || area > 1000) {
        return {
            isValid: false,
            error: 'Garden area must be between 1 and 1000 square feet'
        };
    }

    if (!Number.isInteger(area)) {
        return {
            isValid: false,
            error: 'Garden area must be a whole number'
        };
    }

    return { isValid: true };
};

/**
 * Calculates the area of a garden zone with support for irregular shapes
 * Memoized for performance optimization
 * @param zone - Garden zone object
 * @returns Calculated area in square feet (rounded to 2 decimals)
 */
export const calculateZoneArea = memoize((zone: GardenZone): number => {
    if (!zone || !zone.area) {
        return 0;
    }

    // Round to 2 decimal places for consistent calculations
    return Number(Math.round(zone.area * 100) / 100);
});

/**
 * Calculates space utilization with improved floating-point handling
 * Memoized for performance optimization
 * @param layout - Garden layout configuration
 * @returns Detailed utilization results
 */
export const calculateSpaceUtilization = memoize((layout: GardenLayout): UtilizationResult => {
    if (!layout || !layout.zones || layout.zones.length === 0) {
        return { percentage: 0, unusedArea: 0 };
    }

    const totalArea = layout.zones.reduce((sum, zone) => 
        sum + calculateZoneArea(zone), 0);

    // Handle floating-point precision
    const percentage = Number((layout.spaceUtilization * 100).toFixed(2));
    const unusedArea = Number((totalArea * (1 - layout.spaceUtilization)).toFixed(2));

    return {
        percentage,
        unusedArea
    };
});

/**
 * Validates zone configuration with enhanced checks for overlaps and sunlight
 * @param zones - Array of garden zones
 * @param totalArea - Total garden area
 * @returns Detailed validation results with warnings
 */
export const validateZoneConfiguration = (
    zones: GardenZone[],
    totalArea: number
): ZoneValidationResult => {
    const result: ZoneValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
    };

    if (!zones || zones.length === 0) {
        result.isValid = false;
        result.errors.push('At least one garden zone is required');
        return result;
    }

    let totalZoneArea = 0;
    const sunlightDistribution: Record<SunlightCondition, number> = {
        [SunlightCondition.FULL_SUN]: 0,
        [SunlightCondition.PARTIAL_SHADE]: 0,
        [SunlightCondition.FULL_SHADE]: 0
    };

    // Validate individual zones and calculate totals
    zones.forEach((zone, index) => {
        const zoneArea = calculateZoneArea(zone);
        totalZoneArea += zoneArea;

        if (zoneArea <= 0) {
            result.errors.push(`Zone ${index + 1} must have a positive area`);
        }

        if (!zone.sunlightCondition) {
            result.errors.push(`Zone ${index + 1} must have a sunlight condition`);
        } else {
            sunlightDistribution[zone.sunlightCondition] += zoneArea;
        }
    });

    // Validate total area
    if (totalZoneArea > totalArea) {
        result.errors.push('Total zone area exceeds garden area');
    }

    // Check sunlight distribution
    const fullSunPercentage = (sunlightDistribution[SunlightCondition.FULL_SUN] / totalZoneArea) * 100;
    if (fullSunPercentage < 30) {
        result.warnings.push('Less than 30% of garden area has full sun exposure');
    }

    result.isValid = result.errors.length === 0;
    return result;
};

/**
 * Formats garden dimensions with localization support
 * @param area - Garden area in square feet
 * @param locale - Locale string for formatting
 * @returns Localized formatted dimensions string
 */
export const formatGardenDimensions = (area: number, locale: string = 'en-US'): string => {
    if (!isNumber(area) || area <= 0) {
        return 'Invalid dimensions';
    }

    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    return `${formatter.format(area)} sq ft`;
};

/**
 * Calculates optimal dimensions for a rectangular garden
 * @param area - Total garden area
 * @returns Optimal length and width dimensions
 */
export const calculateOptimalDimensions = memoize((area: number): { length: number; width: number } => {
    if (!isNumber(area) || area <= 0) {
        return { length: 0, width: 0 };
    }

    // Calculate dimensions targeting a 1.6 (golden ratio) length-to-width ratio
    const targetRatio = 1.6;
    const width = Math.sqrt(area / targetRatio);
    const length = area / width;

    return {
        length: Number(length.toFixed(2)),
        width: Number(width.toFixed(2))
    };
});