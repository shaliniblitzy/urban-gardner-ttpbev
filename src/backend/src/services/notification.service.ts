import { messaging } from 'firebase-admin'; // ^11.0.0
import { NotificationRepository } from '../repositories/notification.repository';
import { 
    INotificationPayload,
    NotificationType,
    INotificationDeliverySettings,
    INotificationRetryPolicy,
    INotificationResult 
} from '../interfaces/notification.interface';
import { notificationConfig } from '../config/notification.config';

/**
 * Enhanced service class for managing garden maintenance notifications
 * Implements high-performance delivery, batching, and comprehensive status tracking
 */
export class NotificationService {
    private readonly repository: NotificationRepository;
    private readonly deliverySettings: INotificationDeliverySettings;
    private readonly retryPolicy: INotificationRetryPolicy;
    private readonly performanceMetrics: Map<string, {
        totalAttempts: number;
        successfulDeliveries: number;
        averageDeliveryTime: number;
        lastDeliveryTimestamp: Date;
    }>;

    constructor(notificationRepository: NotificationRepository) {
        this.repository = notificationRepository;
        this.deliverySettings = notificationConfig.deliverySettings;
        this.retryPolicy = notificationConfig.retryPolicy;
        this.performanceMetrics = new Map();
    }

    /**
     * Creates and schedules a garden maintenance notification
     * @param type Type of garden maintenance notification
     * @param title Notification title
     * @param body Notification content
     * @param zoneId Garden zone identifier
     * @param scheduledTime Scheduled delivery time
     * @returns Promise resolving to notification creation result
     */
    public async createNotification(
        type: NotificationType,
        title: string,
        body: string,
        zoneId: string,
        scheduledTime: Date
    ): Promise<INotificationResult> {
        const startTime = Date.now();

        try {
            // Validate notification parameters
            this.validateNotificationParams(type, title, body, zoneId, scheduledTime);

            // Create notification payload
            const payload: INotificationPayload = {
                title,
                body,
                type,
                priority: this.determineNotificationPriority(type),
                gardenZone: zoneId,
                plantType: '', // Will be populated based on zone data
                scheduledTime,
                data: {
                    zoneId,
                    type,
                    timestamp: scheduledTime.toISOString()
                }
            };

            // Create notification through repository
            const notificationId = await this.repository.createZoneNotification(payload, zoneId);

            const result: INotificationResult = {
                success: true,
                messageId: notificationId,
                retryCount: 0,
                deliveryTime: Date.now() - startTime,
                deviceToken: '', // Will be populated during delivery
                timestamp: new Date()
            };

            this.updatePerformanceMetrics(zoneId, result);
            return result;
        } catch (error) {
            throw new Error(`Failed to create notification: ${error.message}`);
        }
    }

    /**
     * Sends notifications to multiple devices in a garden zone with optimized batching
     * @param notificationIds Array of notification identifiers
     * @param zoneId Garden zone identifier
     * @returns Promise resolving to batch delivery results
     */
    public async sendBatchNotifications(
        notificationIds: string[],
        zoneId: string
    ): Promise<INotificationResult[]> {
        const startTime = Date.now();
        const results: INotificationResult[] = [];

        try {
            // Split notifications into optimal batch sizes
            const batches = this.createOptimalBatches(
                notificationIds,
                this.deliverySettings.maxBatchSize
            );

            // Process batches with concurrency control
            const batchPromises = batches.map(async (batch, index) => {
                // Implement rate limiting between batches
                if (index > 0) {
                    await this.sleep(this.calculateBatchDelay(index));
                }

                const batchResults = await this.repository.sendZoneNotification(
                    batch[0], // Using first notification ID for the batch
                    zoneId
                );

                results.push(...batchResults);
            });

            // Wait for all batches to complete
            await Promise.all(batchPromises);

            this.updateBatchPerformanceMetrics(zoneId, results, startTime);
            return results;
        } catch (error) {
            throw new Error(`Batch notification delivery failed: ${error.message}`);
        }
    }

    /**
     * Monitors and analyzes notification delivery performance
     * @param zoneId Garden zone identifier
     * @returns Promise resolving to performance metrics
     */
    public async monitorDeliveryPerformance(
        zoneId: string
    ): Promise<{
        metrics: {
            totalAttempts: number;
            successRate: number;
            averageDeliveryTime: number;
            lastDeliveryTimestamp: Date;
        };
        status: string;
    }> {
        const metrics = this.performanceMetrics.get(zoneId) || {
            totalAttempts: 0,
            successfulDeliveries: 0,
            averageDeliveryTime: 0,
            lastDeliveryTimestamp: new Date()
        };

        const successRate = metrics.totalAttempts > 0
            ? (metrics.successfulDeliveries / metrics.totalAttempts) * 100
            : 0;

        return {
            metrics: {
                totalAttempts: metrics.totalAttempts,
                successRate,
                averageDeliveryTime: metrics.averageDeliveryTime,
                lastDeliveryTimestamp: metrics.lastDeliveryTimestamp
            },
            status: this.determineServiceStatus(successRate)
        };
    }

    /**
     * Validates notification parameters
     * @param type Notification type
     * @param title Notification title
     * @param body Notification body
     * @param zoneId Zone identifier
     * @param scheduledTime Scheduled time
     */
    private validateNotificationParams(
        type: NotificationType,
        title: string,
        body: string,
        zoneId: string,
        scheduledTime: Date
    ): void {
        if (!Object.values(NotificationType).includes(type)) {
            throw new Error('Invalid notification type');
        }

        if (!title || title.length < 1 || title.length > 100) {
            throw new Error('Invalid title length');
        }

        if (!body || body.length < 1 || body.length > 500) {
            throw new Error('Invalid body length');
        }

        if (!zoneId || !/^[A-Za-z0-9_-]+$/.test(zoneId)) {
            throw new Error('Invalid zone identifier');
        }

        if (scheduledTime < new Date()) {
            throw new Error('Scheduled time must be in the future');
        }
    }

    /**
     * Determines notification priority based on type
     * @param type Notification type
     * @returns Priority level
     */
    private determineNotificationPriority(
        type: NotificationType
    ): 'high' | 'normal' {
        const highPriorityTypes = [
            NotificationType.WATERING_SCHEDULE,
            NotificationType.SYSTEM_ALERT
        ];
        return highPriorityTypes.includes(type) ? 'high' : 'normal';
    }

    /**
     * Creates optimal batches for notification delivery
     * @param items Items to batch
     * @param batchSize Maximum batch size
     * @returns Array of batched items
     */
    private createOptimalBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Updates performance metrics for a zone
     * @param zoneId Zone identifier
     * @param result Delivery result
     */
    private updatePerformanceMetrics(
        zoneId: string,
        result: INotificationResult
    ): void {
        const currentMetrics = this.performanceMetrics.get(zoneId) || {
            totalAttempts: 0,
            successfulDeliveries: 0,
            averageDeliveryTime: 0,
            lastDeliveryTimestamp: new Date()
        };

        currentMetrics.totalAttempts++;
        if (result.success) {
            currentMetrics.successfulDeliveries++;
        }

        currentMetrics.averageDeliveryTime = (
            (currentMetrics.averageDeliveryTime * (currentMetrics.totalAttempts - 1) +
            result.deliveryTime) / currentMetrics.totalAttempts
        );
        currentMetrics.lastDeliveryTimestamp = result.timestamp;

        this.performanceMetrics.set(zoneId, currentMetrics);
    }

    /**
     * Updates batch performance metrics
     * @param zoneId Zone identifier
     * @param results Batch results
     * @param startTime Batch start time
     */
    private updateBatchPerformanceMetrics(
        zoneId: string,
        results: INotificationResult[],
        startTime: number
    ): void {
        const totalTime = Date.now() - startTime;
        const successfulDeliveries = results.filter(r => r.success).length;

        const metrics = this.performanceMetrics.get(zoneId) || {
            totalAttempts: 0,
            successfulDeliveries: 0,
            averageDeliveryTime: 0,
            lastDeliveryTimestamp: new Date()
        };

        metrics.totalAttempts += results.length;
        metrics.successfulDeliveries += successfulDeliveries;
        metrics.averageDeliveryTime = (
            (metrics.averageDeliveryTime * (metrics.totalAttempts - results.length) +
            totalTime) / metrics.totalAttempts
        );
        metrics.lastDeliveryTimestamp = new Date();

        this.performanceMetrics.set(zoneId, metrics);
    }

    /**
     * Determines service status based on success rate
     * @param successRate Delivery success rate
     * @returns Service status
     */
    private determineServiceStatus(successRate: number): string {
        if (successRate >= 99) return 'EXCELLENT';
        if (successRate >= 95) return 'GOOD';
        if (successRate >= 90) return 'FAIR';
        return 'DEGRADED';
    }

    /**
     * Calculates delay between batch processing
     * @param batchIndex Batch index
     * @returns Delay in milliseconds
     */
    private calculateBatchDelay(batchIndex: number): number {
        return Math.min(
            this.retryPolicy.initialRetryDelay * Math.pow(this.retryPolicy.backoffMultiplier, batchIndex),
            this.retryPolicy.maxRetryDelay
        );
    }

    /**
     * Utility method for implementing delays
     * @param ms Milliseconds to sleep
     * @returns Promise that resolves after specified delay
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default NotificationService;