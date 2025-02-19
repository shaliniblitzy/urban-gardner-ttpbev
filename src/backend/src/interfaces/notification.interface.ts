import { messaging } from 'firebase-admin'; // ^11.0.0

/**
 * Enum defining the types of notifications supported by the garden maintenance system
 */
export enum NotificationType {
    MAINTENANCE_REMINDER = 'MAINTENANCE_REMINDER',
    WATERING_SCHEDULE = 'WATERING_SCHEDULE',
    FERTILIZER_REMINDER = 'FERTILIZER_REMINDER',
    HARVEST_TIME = 'HARVEST_TIME',
    SYSTEM_ALERT = 'SYSTEM_ALERT'
}

/**
 * Interface defining the structure of notification payloads
 * Compliant with Firebase Cloud Messaging payload structure
 */
export interface INotificationPayload {
    title: string;
    body: string;
    type: NotificationType;
    data: Record<string, string>;
    priority: 'high' | 'normal';
    gardenZone: string;
    plantType: string;
    scheduledTime: Date;
}

/**
 * Interface for configuring notification delivery settings
 * Optimized for garden maintenance scheduling requirements
 */
export interface INotificationDeliverySettings {
    /** Maximum number of notifications to send in a single batch */
    maxBatchSize: number;
    /** Maximum number of concurrent batch operations */
    maxConcurrentBatches: number;
    /** Timeout in milliseconds for notification delivery */
    deliveryTimeout: number;
    /** Maximum number of retry attempts for failed deliveries */
    maxRetries: number;
    /** User's timezone for notification scheduling */
    timeZone: string;
    /** Quiet hours during which notifications should not be sent */
    quietHours: {
        start: string; // 24-hour format, e.g., "22:00"
        end: string;   // 24-hour format, e.g., "07:00"
    };
}

/**
 * Interface defining retry behavior for failed notification deliveries
 * Implements exponential backoff strategy
 */
export interface INotificationRetryPolicy {
    /** Initial delay in milliseconds before first retry */
    initialRetryDelay: number;
    /** Maximum delay in milliseconds between retries */
    maxRetryDelay: number;
    /** Multiplier for exponential backoff calculation */
    backoffMultiplier: number;
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Array of error codes that should trigger a retry */
    retryableErrors: string[];
    /** Custom function to determine if a retry should be attempted */
    retryCondition: (error: Error) => boolean;
}

/**
 * Interface for notification delivery results and tracking
 * Provides detailed delivery status and performance metrics
 */
export interface INotificationResult {
    /** Indicates if the notification was delivered successfully */
    success: boolean;
    /** Unique identifier for the delivered message */
    messageId: string;
    /** Error object if delivery failed */
    error?: Error;
    /** Number of retry attempts made */
    retryCount: number;
    /** Delivery time in milliseconds */
    deliveryTime: number;
    /** Target device token */
    deviceToken: string;
    /** Timestamp of the delivery attempt */
    timestamp: Date;
}