/**
 * Garden Planner Input Validation Constants
 * Version: 1.0.0
 * 
 * Defines comprehensive validation rules, constraints and error messages
 * for garden planning input validation including:
 * - Garden dimensions
 * - Sunlight conditions
 * - Plant requirements
 */

export const GARDEN_VALIDATION = {
  VERSION: '1.0.0',

  AREA: {
    MIN_AREA: 1,
    MAX_AREA: 1000,
    UNIT: 'sq ft',
    REGEX: {
      NUMERIC_ONLY: '^[0-9]+(.[0-9]{1,2})?$',
      NO_SPECIAL_CHARS: '^[0-9.]+$'
    },
    ERROR_MESSAGES: {
      REQUIRED: 'Garden area is required for layout optimization',
      INVALID_NUMBER: 'Please enter a valid number for garden area',
      OUT_OF_RANGE: 'Garden area must be between {min} and {max} sq ft',
      SPECIAL_CHARS: 'Garden area cannot contain special characters',
      INVALID_FORMAT: 'Garden area must be a number with up to 2 decimal places'
    }
  },

  SUNLIGHT: {
    MIN_ZONES: 1,
    MAX_ZONES: 10,
    CONDITIONS: [
      'FULL_SUN',
      'PARTIAL_SHADE', 
      'FULL_SHADE'
    ] as const,
    HOURS: {
      FULL_SUN: {
        MIN: 6,
        MAX: 12
      },
      PARTIAL_SHADE: {
        MIN: 3,
        MAX: 6
      },
      FULL_SHADE: {
        MIN: 0,
        MAX: 3
      }
    },
    ERROR_MESSAGES: {
      REQUIRED: 'Sunlight condition is required for each garden zone',
      INVALID_CONDITION: 'Please select a valid sunlight condition: {conditions}',
      MIN_ZONES: 'At least {min} garden zone must be defined',
      MAX_ZONES: 'Maximum {max} garden zones allowed',
      INVALID_HOURS: 'Sunlight hours must be between {min} and {max} for {condition}'
    }
  },

  PLANTS: {
    MIN_QUANTITY: 1,
    MAX_QUANTITY_PER_ZONE: 100,
    MAX_TYPES_PER_ZONE: 5,
    SUPPORTED_TYPES: [
      'TOMATOES',
      'LETTUCE',
      'CARROTS'
    ] as const,
    SPACING_REQUIREMENTS: {
      TOMATOES: {
        MIN_SPACING: 24,
        UNIT: 'inches'
      },
      LETTUCE: {
        MIN_SPACING: 6,
        UNIT: 'inches'
      },
      CARROTS: {
        MIN_SPACING: 3,
        UNIT: 'inches'
      }
    },
    ERROR_MESSAGES: {
      REQUIRED: 'Plant quantity is required for garden planning',
      INVALID_QUANTITY: 'Please enter a valid quantity greater than {min}',
      UNSUPPORTED_TYPE: 'Please select a supported plant type: {types}',
      MAX_QUANTITY: 'Maximum {max} plants allowed per zone',
      MAX_TYPES: 'Maximum {max} different plant types allowed per zone',
      INVALID_SPACING: 'Minimum spacing of {spacing} {unit} required for {plant}'
    }
  },

  VALIDATION_RULES: {
    AREA: {
      REQUIRED: true,
      NUMERIC: true,
      DECIMAL_PLACES: 2,
      NO_SPECIAL_CHARS: true,
      RANGE_CHECK: true
    },
    SUNLIGHT: {
      REQUIRED: true,
      CONDITION_CHECK: true,
      ZONE_COUNT_CHECK: true,
      HOURS_CHECK: true
    },
    PLANTS: {
      REQUIRED: true,
      QUANTITY_CHECK: true,
      TYPE_CHECK: true,
      SPACING_CHECK: true,
      ZONE_LIMIT_CHECK: true
    }
  }
} as const;

// Type definitions for strongly-typed validation
export type SunlightCondition = typeof GARDEN_VALIDATION.SUNLIGHT.CONDITIONS[number];
export type PlantType = typeof GARDEN_VALIDATION.PLANTS.SUPPORTED_TYPES[number];

// Validation rule types
export type AreaValidationRules = typeof GARDEN_VALIDATION.VALIDATION_RULES.AREA;
export type SunlightValidationRules = typeof GARDEN_VALIDATION.VALIDATION_RULES.SUNLIGHT;
export type PlantValidationRules = typeof GARDEN_VALIDATION.VALIDATION_RULES.PLANTS;