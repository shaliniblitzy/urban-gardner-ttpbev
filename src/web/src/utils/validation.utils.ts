/**
 * Garden Planner Validation Utilities
 * Version: 1.0.0
 * 
 * Provides comprehensive validation functions for garden-related inputs including:
 * - Garden dimensions
 * - Sunlight conditions
 * - Plant requirements
 */

import { GARDEN_VALIDATION, SunlightCondition, PlantType } from '../constants/validation';
import { Garden, GardenZone, GardenInput } from '../types/garden.types';
import { Plant, PlantHealth } from '../types/plant.types';
import { Zone } from '../types/zone.types';

/**
 * Interface for validation result containing validation status and error messages
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Cache for validation results to optimize performance
 */
const validationCache = new Map<string, ValidationResult>();

/**
 * Validates garden area input against defined constraints
 * @param area - Garden area input value
 * @returns ValidationResult with validation status and error messages
 */
export function validateGardenArea(area: number | string): ValidationResult {
  const cacheKey = `area_${area}`;
  if (validationCache.has(cacheKey)) {
    return validationCache.get(cacheKey)!;
  }

  const errors: string[] = [];
  
  // Check if area is defined
  if (area === undefined || area === null) {
    errors.push(GARDEN_VALIDATION.AREA.ERROR_MESSAGES.REQUIRED);
    return { isValid: false, errors };
  }

  // Convert to number and validate
  const numericArea = Number(area);
  if (isNaN(numericArea)) {
    errors.push(GARDEN_VALIDATION.AREA.ERROR_MESSAGES.INVALID_NUMBER);
    return { isValid: false, errors };
  }

  // Validate range
  if (numericArea < GARDEN_VALIDATION.AREA.MIN_AREA || 
      numericArea > GARDEN_VALIDATION.AREA.MAX_AREA) {
    errors.push(GARDEN_VALIDATION.AREA.ERROR_MESSAGES.OUT_OF_RANGE
      .replace('{min}', String(GARDEN_VALIDATION.AREA.MIN_AREA))
      .replace('{max}', String(GARDEN_VALIDATION.AREA.MAX_AREA)));
  }

  // Validate format and special characters
  const areaString = String(area);
  if (!new RegExp(GARDEN_VALIDATION.AREA.REGEX.NO_SPECIAL_CHARS).test(areaString)) {
    errors.push(GARDEN_VALIDATION.AREA.ERROR_MESSAGES.SPECIAL_CHARS);
  }
  if (!new RegExp(GARDEN_VALIDATION.AREA.REGEX.NUMERIC_ONLY).test(areaString)) {
    errors.push(GARDEN_VALIDATION.AREA.ERROR_MESSAGES.INVALID_FORMAT);
  }

  const result = { isValid: errors.length === 0, errors };
  validationCache.set(cacheKey, result);
  return result;
}

/**
 * Validates sunlight conditions for garden zones
 * @param zones - Array of garden zones to validate
 * @returns ValidationResult with validation status and error messages
 */
export function validateSunlightConditions(zones: GardenZone[]): ValidationResult {
  const errors: string[] = [];

  // Check if zones are defined
  if (!zones || zones.length === 0) {
    errors.push(GARDEN_VALIDATION.SUNLIGHT.ERROR_MESSAGES.MIN_ZONES
      .replace('{min}', String(GARDEN_VALIDATION.SUNLIGHT.MIN_ZONES)));
    return { isValid: false, errors };
  }

  // Validate zone count
  if (zones.length > GARDEN_VALIDATION.SUNLIGHT.MAX_ZONES) {
    errors.push(GARDEN_VALIDATION.SUNLIGHT.ERROR_MESSAGES.MAX_ZONES
      .replace('{max}', String(GARDEN_VALIDATION.SUNLIGHT.MAX_ZONES)));
  }

  // Validate each zone's sunlight condition
  zones.forEach((zone, index) => {
    if (!GARDEN_VALIDATION.SUNLIGHT.CONDITIONS.includes(zone.sunlightCondition)) {
      errors.push(`Zone ${index + 1}: ${GARDEN_VALIDATION.SUNLIGHT.ERROR_MESSAGES.INVALID_CONDITION
        .replace('{conditions}', GARDEN_VALIDATION.SUNLIGHT.CONDITIONS.join(', '))}`);
    }

    // Validate sunlight hours for the condition
    const hours = GARDEN_VALIDATION.SUNLIGHT.HOURS[zone.sunlightCondition];
    if (hours) {
      errors.push(`Zone ${index + 1}: ${GARDEN_VALIDATION.SUNLIGHT.ERROR_MESSAGES.INVALID_HOURS
        .replace('{min}', String(hours.MIN))
        .replace('{max}', String(hours.MAX))
        .replace('{condition}', zone.sunlightCondition)}`);
    }
  });

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates plant requirements and quantities
 * @param plantInput - Plant input data to validate
 * @returns ValidationResult with validation status and error messages
 */
export function validatePlantRequirements(plantInput: {
  type: PlantType;
  quantity: number;
  zoneId: string;
}): ValidationResult {
  const errors: string[] = [];

  // Validate plant type
  if (!GARDEN_VALIDATION.PLANTS.SUPPORTED_TYPES.includes(plantInput.type)) {
    errors.push(GARDEN_VALIDATION.PLANTS.ERROR_MESSAGES.UNSUPPORTED_TYPE
      .replace('{types}', GARDEN_VALIDATION.PLANTS.SUPPORTED_TYPES.join(', ')));
  }

  // Validate quantity
  if (!Number.isInteger(plantInput.quantity) || 
      plantInput.quantity < GARDEN_VALIDATION.PLANTS.MIN_QUANTITY) {
    errors.push(GARDEN_VALIDATION.PLANTS.ERROR_MESSAGES.INVALID_QUANTITY
      .replace('{min}', String(GARDEN_VALIDATION.PLANTS.MIN_QUANTITY)));
  }

  if (plantInput.quantity > GARDEN_VALIDATION.PLANTS.MAX_QUANTITY_PER_ZONE) {
    errors.push(GARDEN_VALIDATION.PLANTS.ERROR_MESSAGES.MAX_QUANTITY
      .replace('{max}', String(GARDEN_VALIDATION.PLANTS.MAX_QUANTITY_PER_ZONE)));
  }

  // Validate spacing requirements
  const spacingReq = GARDEN_VALIDATION.PLANTS.SPACING_REQUIREMENTS[plantInput.type];
  if (spacingReq) {
    errors.push(GARDEN_VALIDATION.PLANTS.ERROR_MESSAGES.INVALID_SPACING
      .replace('{spacing}', String(spacingReq.MIN_SPACING))
      .replace('{unit}', spacingReq.UNIT)
      .replace('{plant}', plantInput.type));
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates complete garden input including area, zones, and plants
 * @param gardenInput - Complete garden input data to validate
 * @returns ValidationResult with validation status and error messages
 */
export function validateGardenInput(gardenInput: GardenInput): ValidationResult {
  const errors: string[] = [];

  // Validate garden area
  const areaValidation = validateGardenArea(gardenInput.area);
  if (!areaValidation.isValid) {
    errors.push(...areaValidation.errors);
  }

  // Validate zones and sunlight conditions
  const sunlightValidation = validateSunlightConditions(gardenInput.zones);
  if (!sunlightValidation.isValid) {
    errors.push(...sunlightValidation.errors);
  }

  // Validate plants in each zone
  gardenInput.zones.forEach((zone, zoneIndex) => {
    if (zone.plants.length > GARDEN_VALIDATION.PLANTS.MAX_TYPES_PER_ZONE) {
      errors.push(`Zone ${zoneIndex + 1}: ${GARDEN_VALIDATION.PLANTS.ERROR_MESSAGES.MAX_TYPES
        .replace('{max}', String(GARDEN_VALIDATION.PLANTS.MAX_TYPES_PER_ZONE))}`);
    }

    zone.plants.forEach(plant => {
      const plantValidation = validatePlantRequirements({
        type: plant.type,
        quantity: 1, // Assuming 1 plant per entry
        zoneId: String(zoneIndex)
      });
      if (!plantValidation.isValid) {
        errors.push(...plantValidation.errors.map(error => `Zone ${zoneIndex + 1}: ${error}`));
      }
    });
  });

  return { isValid: errors.length === 0, errors };
}

/**
 * Clears the validation cache
 * Should be called when validation rules are updated
 */
export function clearValidationCache(): void {
  validationCache.clear();
}