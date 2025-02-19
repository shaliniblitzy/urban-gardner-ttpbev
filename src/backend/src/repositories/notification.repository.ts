import { messaging } from 'firebase-admin'; // ^11.0.0
import { NotificationModel } from '../models/notification.model';
import { 
    INotificationPayload,
    NotificationType,
    INotificationResult,
    INotificationDeliverySettings
} from '../interfaces/notification.interface';
import { notificationConfig } from '../config/notification.config';

/**
 * Repository class for handling notification persistence and delivery operations
 * Implements zone-based optimizations for garden maintenance notifications
 */
export class NotificationRepository {
    private readonly notificationModel: NotificationModel;
    private readonly deliverySettings: INotificationDeliverySettings;
    private readonly zoneDeliveryMetrics: Map<string, {
        totalSent: number;
        successful: number;
        failed: number;
        averageDeliveryTime: number;
    }>;

    constructor(notificationModel: NotificationModel) {
        this.notificationModel = notificationModel;
        this.deliverySettings = notificationConfig.deliverySettings;
        this.zoneDeliveryMetrics = new Map();
    }

    /**
     * Creates and persists a new zone-specific notification
     * @param payload Enhanced notification payload with garden-specific data
     * @param zoneId Target garden zone identifier
     * @returns Promise resolving to notification ID
     */
    public async createZoneNotification(
        payload: INotificationPayload,
        zoneId: string
    ): Promise<string> {
        try {
            // Validate zone-specific payload
            this.validateZonePayload(payload, zoneId);

            // Apply zone-specific priority rules
            const enhancedPayload = this.applyZonePriorityRules(payload, zoneId);

            // Generate unique notification ID
            const notificationId = this.generateNotificationId(zoneId);

            // Store notification with zone context
            await this.persistNotification(notificationId, enhancedPayload);

            return notificationId;
        } catch (error) {
            throw new Error(`Failed to create zone notification: ${error.message}`);
        }
    }

    /**
     * Sends notifications to devices in a specific garden zone
     * @param notificationId Unique notification identifier
     * @param zoneId Target garden zone identifier
     * @returns Promise resolving to zone notification results
     */
    public async sendZoneNotification(
        notificationId: string,
        zoneId: string
    ): Promise<INotificationResult[]> {
        const startTime = Date.now();

        try {
            // Retrieve notification data
            const notification = await this.getNotification(notificationId);
            if (!notification) {
                throw new Error(`Notification ${notificationId} not found`);
            }

            // Get active devices in zone
            const zoneDevices = await this.getZoneDevices(zoneId);
            if (!zoneDevices.length) {
                throw new Error(`No active devices found in zone ${zoneId}`);
            }

            // Send notifications with zone-based batching
            const results = await this.notificationModel.sendBatchNotifications(
                notification,
                zoneDevices
            );

            // Update zone metrics
            this.updateZoneMetrics(zoneId, results, startTime);

            return results;
        } catch (error) {
            this.logZoneDeliveryError(zoneId, error);
            throw error;
        }
    }

    /**
     * Retrieves notification delivery statistics for a specific zone
     * @param zoneId Garden zone identifier
     * @returns Promise resolving to zone notification statistics
     */
    public async getZoneNotificationStatus(
        zoneId: string
    ): Promise<{
        metrics: {
            totalSent: number;
            successful: number;
            failed: number;
            averageDeliveryTime: number;
        };
        lastDelivery: Date | null;
    }> {
        const metrics = this.zoneDeliveryMetrics.get(zoneId) || {
            totalSent: 0,
            successful: 0,
            failed: 0,
            averageDeliveryTime: 0
        };

        const lastDelivery = await this.getLastZoneDelivery(zoneId);

        return {
            metrics,
            lastDelivery
        };
    }

    /**
     * Validates zone-specific notification payload
     * @param payload Notification payload
     * @param zoneId Zone identifier
     */
    private validateZonePayload(payload: INotificationPayload, zoneId: string): void {
        if (!payload.gardenZone || payload.gardenZone !== zoneId) {
            throw new Error('Invalid zone identifier in payload');
        }

        if (!Object.values(NotificationType).includes(payload.type)) {
            throw new Error('Invalid notification type');
        }

        if (!payload.scheduledTime || isNaN(payload.scheduledTime.getTime())) {
            throw new Error('Invalid scheduled time');
        }
    }

    /**
     * Applies zone-specific priority rules to notification payload
     * @param payload Original notification payload
     * @param zoneId Zone identifier
     * @returns Enhanced notification payload
     */
    private applyZonePriorityRules(
        payload: INotificationPayload,
        zoneId: string
    ): INotificationPayload {
        const enhancedPayload = { ...payload };

        // Apply priority based on notification type and zone
        if (payload.type === NotificationType.WATERING_SCHEDULE) {
            enhancedPayload.priority = 'high';
        }

        // Add zone-specific metadata
        enhancedPayload.data = {
            ...enhancedPayload.data,
            zoneId,
            deliveryPriority: enhancedPayload.priority
        };

        return enhancedPayload;
    }

    /**
     * Generates unique notification identifier with zone context
     * @param zoneId Zone identifier
     * @returns Unique notification ID
     */
    private generateNotificationId(zoneId: string): string {
        return `${zoneId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Updates delivery metrics for a specific zone
     * @param zoneId Zone identifier
     * @param results Delivery results
     * @param startTime Delivery start timestamp
     */
    private updateZoneMetrics(
        zoneId: string,
        results: INotificationResult[],
        startTime: number
    ): void {
        const currentMetrics = this.zoneDeliveryMetrics.get(zoneId) || {
            totalSent: 0,
            successful: 0,
            failed: 0,
            averageDeliveryTime: 0
        };

        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        const totalTime = Date.now() - startTime;

        const updatedMetrics = {
            totalSent: currentMetrics.totalSent + results.length,
            successful: currentMetrics.successful + successful,
            failed: currentMetrics.failed + failed,
            averageDeliveryTime: (
                (currentMetrics.averageDeliveryTime * currentMetrics.totalSent) +
                totalTime
            ) / (currentMetrics.totalSent + results.length)
        };

        this.zoneDeliveryMetrics.set(zoneId, updatedMetrics);
    }

    /**
     * Retrieves the timestamp of the last delivery in a zone
     * @param zoneId Zone identifier
     * @returns Promise resolving to last delivery timestamp
     */
    private async getLastZoneDelivery(zoneId: string): Promise<Date | null> {
        try {
            // Implementation would depend on your storage mechanism
            return new Date(); // Placeholder
        } catch (error) {
            console.error(`Failed to retrieve last zone delivery: ${error.message}`);
            return null;
        }
    }

    /**
     * Logs zone-specific delivery errors
     * @param zoneId Zone identifier
     * @param error Error object
     */
    private logZoneDeliveryError(zoneId: string, error: Error): void {
        console.error(`Zone ${zoneId} delivery error: ${error.message}`, {
            zoneId,
            timestamp: new Date(),
            error: error.stack
        });
    }
}

export default NotificationRepository;