/**
 * @fileoverview Centralized error constants for the Garden Planner application
 * Contains HTTP status codes, application error codes, user messages and retry configuration
 * @version 1.0.0
 */

/**
 * Standard HTTP status codes used across the application
 */
export const HTTP_STATUS_CODES = {
  // Success responses
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client error responses
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server error responses
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

export type HttpStatusCode = typeof HTTP_STATUS_CODES[keyof typeof HTTP_STATUS_CODES];

/**
 * Application-specific error codes for tracking and handling different types of errors
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'E001',
  GARDEN_ERROR: 'E002',
  SCHEDULE_ERROR: 'E003',
  NOTIFICATION_ERROR: 'E004',
  DATABASE_ERROR: 'E005',
  AUTHENTICATION_ERROR: 'E006',
  AUTHORIZATION_ERROR: 'E007',
  RATE_LIMIT_ERROR: 'E008',
  NETWORK_ERROR: 'E009',
  SYSTEM_ERROR: 'E010'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * User-friendly error messages for all error scenarios
 */
export const ERROR_MESSAGES = {
  INVALID_GARDEN_DIMENSIONS: 'Invalid garden dimensions. Please enter a value between 1 and 1000 square feet.',
  INCOMPATIBLE_PLANTS: 'The selected plants cannot be grown together. Please review companion planting guidelines.',
  INSUFFICIENT_SUNLIGHT_DATA: 'Please specify sunlight conditions for all garden zones before proceeding.',
  SCHEDULE_GENERATION_FAILED: 'Unable to create maintenance schedule. Please verify plant selections and try again.',
  NOTIFICATION_DELIVERY_FAILED: 'Could not send notifications. Please check your device settings and internet connection.',
  DATABASE_ERROR: 'Unable to save your changes. Please try again in a few minutes.',
  AUTHENTICATION_FAILED: 'Login failed. Please verify your credentials and try again.',
  AUTHORIZATION_FAILED: "You don't have permission to perform this action.",
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a few minutes before trying again.',
  NETWORK_ERROR: 'Connection lost. Please check your internet connection.',
  GENERIC_ERROR: 'An unexpected error occurred. Our team has been notified.'
} as const;

export type ErrorMessage = typeof ERROR_MESSAGES[keyof typeof ERROR_MESSAGES];

/**
 * Configuration parameters for error retry mechanism
 * MAX_ATTEMPTS: Maximum number of retry attempts
 * RETRY_INTERVAL: Base interval between retries in milliseconds
 * TIMEOUT: Maximum time to wait for an operation in milliseconds
 * BACKOFF_MULTIPLIER: Multiplier for exponential backoff
 * JITTER_MAX: Maximum random delay added to retry interval
 */
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  RETRY_INTERVAL: 5000,
  TIMEOUT: 30000,
  BACKOFF_MULTIPLIER: 1.5,
  JITTER_MAX: 1000
} as const;

export type RetryConfig = typeof RETRY_CONFIG[keyof typeof RETRY_CONFIG];

/**
 * Mapping of error codes to their corresponding HTTP status codes
 */
export const ERROR_TO_HTTP_STATUS: Record<ErrorCode, HttpStatusCode> = {
  [ERROR_CODES.VALIDATION_ERROR]: HTTP_STATUS_CODES.BAD_REQUEST,
  [ERROR_CODES.GARDEN_ERROR]: HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY,
  [ERROR_CODES.SCHEDULE_ERROR]: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
  [ERROR_CODES.NOTIFICATION_ERROR]: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
  [ERROR_CODES.DATABASE_ERROR]: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
  [ERROR_CODES.AUTHENTICATION_ERROR]: HTTP_STATUS_CODES.UNAUTHORIZED,
  [ERROR_CODES.AUTHORIZATION_ERROR]: HTTP_STATUS_CODES.FORBIDDEN,
  [ERROR_CODES.RATE_LIMIT_ERROR]: HTTP_STATUS_CODES.TOO_MANY_REQUESTS,
  [ERROR_CODES.NETWORK_ERROR]: HTTP_STATUS_CODES.BAD_GATEWAY,
  [ERROR_CODES.SYSTEM_ERROR]: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
} as const;

// Export all constants as named exports for better tree-shaking
export const ALL_STATUS_CODES: Record<string, number> = HTTP_STATUS_CODES;
export const ALL_ERROR_CODES: Record<string, string> = ERROR_CODES;
export const ALL_ERROR_MESSAGES: Record<string, string> = ERROR_MESSAGES;
export const ALL_RETRY_CONFIG: Record<string, number> = RETRY_CONFIG;