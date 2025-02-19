import { messaging } from 'firebase-admin'; // v11.0.0

/**
 * Enum defining supported notification types for garden maintenance
 */
export enum NotificationType {
    MAINTENANCE_REMINDER = 'MAINTENANCE_REMINDER',
    WATERING_SCHEDULE = 'WATERING_SCHEDULE',
    FERTILIZER_REMINDER = 'FERTILIZER_REMINDER',
    HARVEST_TIME = 'HARVEST_TIME',
    SYSTEM_ALERT = 'SYSTEM_ALERT'
}

/**
 * Configuration for notification delivery parameters
 * Optimized for garden maintenance schedules with sub-second delivery requirements
 */
export const deliverySettings = {
    /**
     * Maximum number of notifications that can be processed in a single batch
     * Optimized for efficient delivery while maintaining performance
     */
    maxBatchSize: 100,

    /**
     * Maximum number of concurrent notification batches
     * Prevents system overload while ensuring timely delivery
     */
    maxConcurrentBatches: 5,

    /**
     * Maximum time allowed for notification delivery in milliseconds
     * Set to 1000ms to meet sub-second delivery requirement
     */
    deliveryTimeout: 1000,

    /**
     * Maximum number of delivery attempts for a notification
     * Ensures reliable delivery while preventing infinite retries
     */
    maxRetries: 3
} as const;

/**
 * Configuration for notification retry behavior
 * Implements exponential backoff strategy for failed deliveries
 */
export const retryPolicy = {
    /**
     * Initial delay before first retry attempt in milliseconds
     */
    initialRetryDelay: 1000,

    /**
     * Maximum delay between retries in milliseconds
     * Caps the exponential backoff to prevent excessive delays
     */
    maxRetryDelay: 5000,

    /**
     * Multiplier for exponential backoff calculation
     * Each retry attempt will wait (previousDelay * backoffMultiplier)
     */
    backoffMultiplier: 2,

    /**
     * Maximum number of retry attempts before giving up
     * Prevents infinite retry loops while ensuring delivery attempts
     */
    maxAttempts: 3
} as const;

/**
 * Comprehensive notification configuration object
 * Exports all notification-related settings for the garden maintenance system
 */
export const notificationConfig = {
    notificationTypes: NotificationType,
    deliverySettings,
    retryPolicy,

    /**
     * FCM message configuration defaults
     * Ensures consistent message formatting across the application
     */
    fcmDefaults: {
        android: {
            priority: 'high',
            notification: {
                channelId: 'garden-maintenance'
            }
        } as messaging.AndroidConfig,
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        } as messaging.ApnsConfig,
        webpush: {
            headers: {
                Urgency: 'high'
            }
        } as messaging.WebpushConfig
    }
} as const;

export default notificationConfig;