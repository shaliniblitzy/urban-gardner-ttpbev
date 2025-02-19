import { Injectable } from '@nestjs/common'; // ^8.0.0
import { messaging } from 'firebase-admin'; // ^11.0.0
import moment from 'moment'; // ^2.29.0
import { INotificationPayload, NotificationType, INotificationResult, INotificationRetryPolicy } from '../../interfaces/notification.interface';
import { notificationConfig } from '../../config/notification.config';

/**
 * Service responsible for scheduling and managing push notifications for garden maintenance tasks
 * Implements enterprise-grade notification delivery with batching, retry, and rate limiting
 */
@Injectable()
export class NotificationSchedulerService {
    private readonly messaging: messaging.Messaging;
    private readonly maxBatchSize: number;
    private readonly retryPolicy: INotificationRetryPolicy;
    private readonly deliveryTimeout: number;
    private readonly notificationQueue: INotificationPayload[] = [];
    private isProcessingQueue = false;

    constructor(messagingService: messaging.Messaging) {
        this.messaging = messagingService;
        this.maxBatchSize = notificationConfig.deliverySettings.maxBatchSize;
        this.retryPolicy = notificationConfig.retryPolicy;
        this.deliveryTimeout = notificationConfig.deliverySettings.deliveryTimeout;
    }

    /**
     * Schedules a batch of maintenance notifications with optimized delivery timing
     * @param notifications Array of notification payloads to be scheduled
     * @param scheduledTime Target delivery time for the notifications
     * @returns Promise resolving to batch processing results
     */
    public async scheduleBatchNotifications(
        notifications: INotificationPayload[],
        scheduledTime: Date
    ): Promise<INotificationResult[]> {
        try {
            // Validate and sanitize notifications
            const validNotifications = this.validateNotifications(notifications);
            
            // Group notifications into optimized batches
            const batches = this.createBatches(validNotifications);
            
            const results: INotificationResult[] = [];
            
            for (const batch of batches) {
                const batchResults = await this.processBatch(batch, scheduledTime);
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            throw new Error(`Batch notification scheduling failed: ${error.message}`);
        }
    }

    /**
     * Schedules a single maintenance reminder with retry capability
     * @param notification Notification payload for the maintenance reminder
     * @returns Promise resolving to notification delivery result
     */
    public async scheduleMaintenanceReminder(
        notification: INotificationPayload
    ): Promise<INotificationResult> {
        const startTime = Date.now();
        
        try {
            const message = this.createFcmMessage(notification);
            const result = await this.messaging.send(message);
            
            return {
                success: true,
                messageId: result,
                retryCount: 0,
                deliveryTime: Date.now() - startTime,
                deviceToken: message.token,
                timestamp: new Date()
            };
        } catch (error) {
            return this.handleDeliveryError(notification, error, startTime);
        }
    }

    /**
     * Implements retry logic for failed notification deliveries
     * @param notification Failed notification payload
     * @param error Original delivery error
     * @param retryCount Current retry attempt number
     * @returns Promise resolving to retry attempt result
     */
    private async retryFailedNotification(
        notification: INotificationPayload,
        error: Error,
        retryCount: number = 0
    ): Promise<INotificationResult> {
        if (retryCount >= this.retryPolicy.maxAttempts) {
            return {
                success: false,
                error,
                retryCount,
                deliveryTime: 0,
                deviceToken: notification.data?.token,
                timestamp: new Date()
            };
        }

        const delay = Math.min(
            this.retryPolicy.initialRetryDelay * Math.pow(this.retryPolicy.backoffMultiplier, retryCount),
            this.retryPolicy.maxRetryDelay
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.scheduleMaintenanceReminder(notification);
    }

    /**
     * Creates optimized batches of notifications for processing
     * @param notifications Array of notifications to be batched
     * @returns Array of notification batches
     */
    private createBatches(notifications: INotificationPayload[]): INotificationPayload[][] {
        const batches: INotificationPayload[][] = [];
        
        for (let i = 0; i < notifications.length; i += this.maxBatchSize) {
            batches.push(notifications.slice(i, i + this.maxBatchSize));
        }
        
        return batches;
    }

    /**
     * Processes a batch of notifications with delivery tracking
     * @param batch Array of notifications in the current batch
     * @param scheduledTime Target delivery time for the batch
     * @returns Promise resolving to batch processing results
     */
    private async processBatch(
        batch: INotificationPayload[],
        scheduledTime: Date
    ): Promise<INotificationResult[]> {
        const results: INotificationResult[] = [];
        const startTime = Date.now();

        const messages = batch.map(notification => this.createFcmMessage(notification));
        
        try {
            const batchResponse = await this.messaging.sendAll(messages);
            
            batchResponse.responses.forEach((response, index) => {
                results.push({
                    success: response.success,
                    messageId: response.messageId,
                    error: response.error,
                    retryCount: 0,
                    deliveryTime: Date.now() - startTime,
                    deviceToken: messages[index].token,
                    timestamp: new Date()
                });
            });
        } catch (error) {
            batch.forEach(notification => {
                results.push({
                    success: false,
                    error,
                    retryCount: 0,
                    deliveryTime: Date.now() - startTime,
                    deviceToken: notification.data?.token,
                    timestamp: new Date()
                });
            });
        }

        return results;
    }

    /**
     * Creates FCM-compatible message from notification payload
     * @param notification Notification payload to be converted
     * @returns FCM message object
     */
    private createFcmMessage(notification: INotificationPayload): messaging.Message {
        return {
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: {
                type: notification.type,
                gardenZone: notification.gardenZone,
                plantType: notification.plantType,
                ...notification.data
            },
            android: notificationConfig.fcmDefaults.android,
            apns: notificationConfig.fcmDefaults.apns,
            webpush: notificationConfig.fcmDefaults.webpush,
            token: notification.data?.token
        };
    }

    /**
     * Handles notification delivery errors with retry logic
     * @param notification Failed notification payload
     * @param error Delivery error
     * @param startTime Delivery attempt start time
     * @returns Promise resolving to error handling result
     */
    private async handleDeliveryError(
        notification: INotificationPayload,
        error: Error,
        startTime: number
    ): Promise<INotificationResult> {
        if (this.isRetryableError(error)) {
            return this.retryFailedNotification(notification, error);
        }

        return {
            success: false,
            error,
            retryCount: 0,
            deliveryTime: Date.now() - startTime,
            deviceToken: notification.data?.token,
            timestamp: new Date()
        };
    }

    /**
     * Validates notification payloads for required fields
     * @param notifications Array of notifications to validate
     * @returns Array of validated notification payloads
     */
    private validateNotifications(notifications: INotificationPayload[]): INotificationPayload[] {
        return notifications.filter(notification => {
            return notification.title &&
                   notification.body &&
                   notification.type &&
                   notification.data?.token &&
                   Object.values(NotificationType).includes(notification.type);
        });
    }

    /**
     * Determines if an error is retryable based on error type
     * @param error Error to evaluate
     * @returns Boolean indicating if retry should be attempted
     */
    private isRetryableError(error: Error): boolean {
        const retryableErrors = [
            'messaging/invalid-argument',
            'messaging/internal-error',
            'messaging/server-unavailable',
            'messaging/timeout'
        ];

        return retryableErrors.some(errorCode => 
            error.message.includes(errorCode)
        );
    }
}