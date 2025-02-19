import Joi from 'joi'; // @version 17.9.0
import { NotificationType } from '../interfaces/notification.interface';
import { ERROR_CODES } from '../constants/error.constants';
import { VALIDATION_OPTIONS } from '../config/validation.config';

// Cache validation schemas for performance optimization
const notificationPayloadSchema = Joi.object({
    title: Joi.string()
        .min(5)
        .max(100)
        .pattern(/^[^<>]*$/) // No HTML/scripts
        .required()
        .messages({
            'string.min': 'Title must be at least 5 characters',
            'string.max': 'Title cannot exceed 100 characters',
            'string.pattern.base': 'Title cannot contain HTML or scripts'
        }),

    body: Joi.string()
        .min(10)
        .max(500)
        .pattern(/^[^<>]*$/) // No HTML/scripts
        .required()
        .messages({
            'string.min': 'Body must be at least 10 characters',
            'string.max': 'Body cannot exceed 500 characters',
            'string.pattern.base': 'Body cannot contain HTML or scripts'
        }),

    type: Joi.string()
        .valid(...Object.values(NotificationType))
        .required()
        .messages({
            'any.only': `Type must be one of: ${Object.values(NotificationType).join(', ')}`
        }),

    priority: Joi.string()
        .valid('high', 'normal')
        .required()
        .messages({
            'any.only': 'Priority must be either "high" or "normal"'
        }),

    scheduledTime: Joi.date()
        .iso()
        .min('now')
        .required()
        .messages({
            'date.base': 'Invalid date format',
            'date.min': 'Scheduled time must be in the future'
        }),

    data: Joi.object()
        .pattern(
            Joi.string(),
            Joi.string().max(1000)
        )
        .max(10)
        .optional()
        .messages({
            'object.max': 'Maximum 10 data key-value pairs allowed',
            'string.max': 'Data values cannot exceed 1000 characters'
        }),

    gardenZone: Joi.string()
        .required()
        .messages({
            'any.required': 'Garden zone is required'
        }),

    plantType: Joi.string()
        .required()
        .messages({
            'any.required': 'Plant type is required'
        })
}).options(VALIDATION_OPTIONS);

const deliverySettingsSchema = Joi.object({
    maxBatchSize: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .required()
        .messages({
            'number.base': 'Max batch size must be a number',
            'number.min': 'Max batch size must be at least 1',
            'number.max': 'Max batch size cannot exceed 100'
        }),

    maxConcurrentBatches: Joi.number()
        .integer()
        .min(1)
        .max(10)
        .required()
        .messages({
            'number.base': 'Max concurrent batches must be a number',
            'number.min': 'Max concurrent batches must be at least 1',
            'number.max': 'Max concurrent batches cannot exceed 10'
        }),

    deliveryTimeout: Joi.number()
        .integer()
        .min(100)
        .max(30000)
        .required()
        .messages({
            'number.base': 'Delivery timeout must be a number',
            'number.min': 'Delivery timeout must be at least 100ms',
            'number.max': 'Delivery timeout cannot exceed 30000ms'
        }),

    maxRetries: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .required()
        .messages({
            'number.base': 'Max retries must be a number',
            'number.min': 'Max retries must be at least 1',
            'number.max': 'Max retries cannot exceed 5'
        }),

    timeZone: Joi.string()
        .pattern(/^[A-Za-z_/]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid timezone format'
        }),

    quietHours: Joi.object({
        start: Joi.string()
            .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
            .required(),
        end: Joi.string()
            .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
            .required()
    }).required()
        .messages({
            'string.pattern.base': 'Time must be in 24-hour format (HH:MM)'
        })
}).options(VALIDATION_OPTIONS);

const retryPolicySchema = Joi.object({
    initialRetryDelay: Joi.number()
        .integer()
        .min(100)
        .max(5000)
        .required()
        .messages({
            'number.base': 'Initial retry delay must be a number',
            'number.min': 'Initial retry delay must be at least 100ms',
            'number.max': 'Initial retry delay cannot exceed 5000ms'
        }),

    maxRetryDelay: Joi.number()
        .integer()
        .min(1000)
        .max(30000)
        .required()
        .messages({
            'number.base': 'Max retry delay must be a number',
            'number.min': 'Max retry delay must be at least 1000ms',
            'number.max': 'Max retry delay cannot exceed 30000ms'
        }),

    backoffMultiplier: Joi.number()
        .min(1)
        .max(3)
        .required()
        .messages({
            'number.base': 'Backoff multiplier must be a number',
            'number.min': 'Backoff multiplier must be at least 1',
            'number.max': 'Backoff multiplier cannot exceed 3'
        }),

    maxAttempts: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .required()
        .messages({
            'number.base': 'Max attempts must be a number',
            'number.min': 'Max attempts must be at least 1',
            'number.max': 'Max attempts cannot exceed 5'
        }),

    retryableErrors: Joi.array()
        .items(Joi.string())
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one retryable error must be specified'
        })
}).options(VALIDATION_OPTIONS);

export const notificationValidator = {
    /**
     * Validates notification payload structure and content
     * @param payload The notification payload to validate
     * @returns Validation result with sanitized payload or error details
     */
    validateNotificationPayload: async (payload: any) => {
        try {
            const validatedPayload = await notificationPayloadSchema.validateAsync(payload);
            return {
                success: true,
                data: validatedPayload
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR,
                    message: error.message
                }
            };
        }
    },

    /**
     * Validates notification delivery configuration settings
     * @param settings The delivery settings to validate
     * @returns Validation result with configuration status
     */
    validateDeliverySettings: async (settings: any) => {
        try {
            const validatedSettings = await deliverySettingsSchema.validateAsync(settings);
            return {
                success: true,
                data: validatedSettings
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR,
                    message: error.message
                }
            };
        }
    },

    /**
     * Validates notification retry policy configuration
     * @param policy The retry policy to validate
     * @returns Validation result with retry configuration status
     */
    validateRetryPolicy: async (policy: any) => {
        try {
            const validatedPolicy = await retryPolicySchema.validateAsync(policy);
            return {
                success: true,
                data: validatedPolicy
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR,
                    message: error.message
                }
            };
        }
    }
};