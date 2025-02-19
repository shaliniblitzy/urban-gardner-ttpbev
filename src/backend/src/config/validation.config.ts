/**
 * Validation Configuration
 * Centralizes validation rules and configuration for the garden planner application
 * @version 1.0.0
 */

import Joi from 'joi'; // @version 17.9.0
import { gardenSchema } from '../validators/garden.validator';
import { validatePlantType } from '../validators/plant.validator';
import { validateScheduleInput } from '../validators/schedule.validator';

/**
 * Global validation options with enhanced error messaging and performance optimizations
 */
export const VALIDATION_OPTIONS = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
    cache: true,
    timeout: 5000,
    messages: {
        garden: {
            area: 'Garden area must be between 1 and 1000 square feet',
            zones: 'At least one garden zone must be defined',
            sunlight: 'Valid sunlight condition required for each zone'
        },
        schedule: {
            timing: 'Valid schedule timing required within system limits',
            notifications: 'Valid notification preferences required',
            completion: 'Valid completion status and date required'
        },
        plant: {
            spacing: 'Valid plant spacing required per plant type',
            companions: 'Compatible plant combinations required',
            sunlight: 'Sufficient sunlight conditions required per plant type'
        }
    }
} as const;

/**
 * Validation schema cache for performance optimization
 */
const schemaCache: Map<string, Joi.ObjectSchema> = new Map();

/**
 * Validation metrics for monitoring and optimization
 */
const validationMetrics = {
    totalValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    cacheHits: 0
};

/**
 * Configures global validation settings with enhanced error messaging
 * and performance optimizations
 * @param options Custom validation options to merge with defaults
 */
export function configureValidation(options: Partial<typeof VALIDATION_OPTIONS>): void {
    const mergedOptions = {
        ...VALIDATION_OPTIONS,
        ...options
    };

    // Configure validation caching
    if (mergedOptions.cache) {
        schemaCache.clear();
    }

    // Initialize validation metrics
    validationMetrics.totalValidations = 0;
    validationMetrics.failedValidations = 0;
    validationMetrics.averageValidationTime = 0;
    validationMetrics.cacheHits = 0;
}

/**
 * Retrieves optimized validation rules for specified entity type with caching
 * @param entityType Type of entity to validate (garden, plant, schedule)
 * @returns Cached validation schema for the entity
 */
export function getValidationRules(entityType: string): Joi.ObjectSchema {
    const startTime = Date.now();

    // Check cache first
    if (schemaCache.has(entityType)) {
        validationMetrics.cacheHits++;
        return schemaCache.get(entityType)!;
    }

    let schema: Joi.ObjectSchema;

    switch (entityType) {
        case 'garden':
            schema = gardenSchema;
            break;

        case 'plant':
            schema = Joi.object({
                type: Joi.string().custom((value, helpers) => {
                    try {
                        validatePlantType(value);
                        return value;
                    } catch (error) {
                        return helpers.error('plant.type.invalid');
                    }
                }),
                spacing: Joi.number().min(1).required(),
                sunlightNeeds: Joi.string().required(),
                companions: Joi.array().items(Joi.string())
            });
            break;

        case 'schedule':
            schema = Joi.object({
                gardenId: Joi.string().required(),
                plantId: Joi.string().required(),
                taskType: Joi.string().required(),
                dueDate: Joi.date().required(),
                notificationPreferences: Joi.object({
                    enabled: Joi.boolean().required(),
                    advanceNotice: Joi.number().min(0).max(72),
                    reminderFrequency: Joi.number().min(1).max(24)
                }).required()
            });
            break;

        default:
            throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Cache the schema
    if (VALIDATION_OPTIONS.cache) {
        schemaCache.set(entityType, schema);
    }

    // Update metrics
    validationMetrics.totalValidations++;
    validationMetrics.averageValidationTime = 
        (validationMetrics.averageValidationTime * (validationMetrics.totalValidations - 1) + 
        (Date.now() - startTime)) / validationMetrics.totalValidations;

    return schema;
}

/**
 * Exports validation configuration and utilities
 */
export const validationConfig = {
    configureValidation,
    getValidationRules,
    metrics: validationMetrics
};

export { VALIDATION_OPTIONS };