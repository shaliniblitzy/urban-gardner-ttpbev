import { messaging } from 'firebase-admin'; // ^11.0.0
import { 
    INotificationPayload, 
    NotificationType,
    INotificationDeliverySettings,
    INotificationRetryPolicy,
    INotificationResult 
} from '../interfaces/notification.interface';
import { notificationConfig } from '../config/notification.config';

/**
 * Enhanced notification model for garden maintenance system
 * Implements Firebase Cloud Messaging with zone-based optimization
 */
export class NotificationModel {
    private messaging: messaging.Messaging;
    private deliverySettings: INotificationDeliverySettings;
    private retryPolicy: INotificationRetryPolicy;
    private zoneMetrics: Map<string, { sent: number; failed: number }>;

    constructor() {
        this.messaging = messaging();
        this.deliverySettings = notificationConfig.deliverySettings;
        this.retryPolicy = notificationConfig.retryPolicy;
        this.zoneMetrics = new Map();
    }

    /**
     * Sends a single garden maintenance notification
     * @param payload Enhanced notification payload with garden-specific data
     * @param deviceToken Target device token
     * @returns Promise resolving to notification delivery result
     */
    public async sendNotification(
        payload: INotificationPayload,
        deviceToken: string
    ): Promise<INotificationResult> {
        const startTime = Date.now();

        try {
            // Validate notification timing against quiet hours
            if (this.isInQuietHours(payload.scheduledTime)) {
                throw new Error('Notification scheduled during quiet hours');
            }

            // Format FCM message with garden-specific enhancements
            const message = this.formatMessage(payload, deviceToken);

            // Attempt delivery with retry logic
            const response = await this.attemptDelivery(message, 0);

            // Update zone metrics
            this.updateZoneMetrics(payload.gardenZone, true);

            return {
                success: true,
                messageId: response.messageId,
                retryCount: 0,
                deliveryTime: Date.now() - startTime,
                deviceToken,
                timestamp: new Date()
            };
        } catch (error) {
            this.updateZoneMetrics(payload.gardenZone, false);
            return {
                success: false,
                messageId: '',
                error: error as Error,
                retryCount: 0,
                deliveryTime: Date.now() - startTime,
                deviceToken,
                timestamp: new Date()
            };
        }
    }

    /**
     * Sends notifications to multiple devices with zone-based batching
     * @param payload Notification payload
     * @param deviceTokens Array of device tokens
     * @returns Promise resolving to array of delivery results
     */
    public async sendBatchNotifications(
        payload: INotificationPayload,
        deviceTokens: string[]
    ): Promise<INotificationResult[]> {
        const results: INotificationResult[] = [];
        const batches = this.createBatches(deviceTokens, this.deliverySettings.maxBatchSize);

        const batchPromises = batches.map(async (batch) => {
            const batchResults = await Promise.all(
                batch.map((token) => this.sendNotification(payload, token))
            );
            results.push(...batchResults);
        });

        await Promise.all(batchPromises);
        return results;
    }

    /**
     * Implements retry logic with exponential backoff for failed deliveries
     * @param message FCM message
     * @param attemptCount Current retry attempt count
     * @returns Promise resolving to messaging response
     */
    private async attemptDelivery(
        message: messaging.Message,
        attemptCount: number
    ): Promise<messaging.MessagingDevicesResponse> {
        try {
            return await this.messaging.send(message, true);
        } catch (error) {
            if (
                attemptCount < this.retryPolicy.maxAttempts &&
                this.shouldRetry(error as Error)
            ) {
                const delay = this.calculateRetryDelay(attemptCount);
                await this.sleep(delay);
                return this.attemptDelivery(message, attemptCount + 1);
            }
            throw error;
        }
    }

    /**
     * Formats notification message for FCM with garden-specific enhancements
     * @param payload Notification payload
     * @param token Device token
     * @returns Formatted FCM message
     */
    private formatMessage(
        payload: INotificationPayload,
        token: string
    ): messaging.Message {
        return {
            token,
            notification: {
                title: payload.title,
                body: payload.body
            },
            data: {
                type: payload.type,
                gardenZone: payload.gardenZone,
                plantType: payload.plantType,
                scheduledTime: payload.scheduledTime.toISOString(),
                ...payload.data
            },
            android: notificationConfig.fcmDefaults.android,
            apns: notificationConfig.fcmDefaults.apns,
            webpush: notificationConfig.fcmDefaults.webpush
        };
    }

    /**
     * Checks if given time falls within quiet hours
     * @param time Time to check
     * @returns Boolean indicating if time is in quiet hours
     */
    private isInQuietHours(time: Date): boolean {
        const hour = time.getHours();
        const quietStart = parseInt(this.deliverySettings.quietHours.start.split(':')[0]);
        const quietEnd = parseInt(this.deliverySettings.quietHours.end.split(':')[0]);
        return hour >= quietStart || hour < quietEnd;
    }

    /**
     * Calculates retry delay using exponential backoff
     * @param attemptCount Current retry attempt count
     * @returns Delay in milliseconds
     */
    private calculateRetryDelay(attemptCount: number): number {
        const delay = this.retryPolicy.initialRetryDelay *
            Math.pow(this.retryPolicy.backoffMultiplier, attemptCount);
        return Math.min(delay, this.retryPolicy.maxRetryDelay);
    }

    /**
     * Updates delivery metrics for specific garden zone
     * @param zoneId Garden zone identifier
     * @param success Delivery success status
     */
    private updateZoneMetrics(zoneId: string, success: boolean): void {
        const metrics = this.zoneMetrics.get(zoneId) || { sent: 0, failed: 0 };
        if (success) {
            metrics.sent++;
        } else {
            metrics.failed++;
        }
        this.zoneMetrics.set(zoneId, metrics);
    }

    /**
     * Retrieves notification delivery statistics for garden zones
     * @returns Map of zone metrics
     */
    public getZoneStatistics(): Map<string, { sent: number; failed: number }> {
        return new Map(this.zoneMetrics);
    }

    /**
     * Creates optimized batches of device tokens
     * @param tokens Array of device tokens
     * @param batchSize Maximum batch size
     * @returns Array of token batches
     */
    private createBatches(tokens: string[], batchSize: number): string[][] {
        const batches: string[][] = [];
        for (let i = 0; i < tokens.length; i += batchSize) {
            batches.push(tokens.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Determines if a delivery error should trigger a retry attempt
     * @param error Delivery error
     * @returns Boolean indicating if retry should be attempted
     */
    private shouldRetry(error: Error): boolean {
        const retryableErrors = [
            'messaging/invalid-argument',
            'messaging/internal-error',
            'messaging/server-unavailable'
        ];
        return retryableErrors.includes((error as any).code);
    }

    /**
     * Utility method for implementing delay
     * @param ms Milliseconds to sleep
     * @returns Promise that resolves after specified delay
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default NotificationModel;