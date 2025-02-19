import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { NotificationService } from '../services/notification.service';
import { 
    INotificationPayload,
    NotificationType
} from '../interfaces/notification.interface';

/**
 * Controller handling notification-related HTTP endpoints for the garden maintenance system
 * Implements zone-based handling and performance optimization
 */
export class NotificationController {
    private readonly notificationService: NotificationService;
    private readonly performanceThreshold = 1000; // 1 second delivery requirement

    constructor(notificationService: NotificationService) {
        this.notificationService = notificationService;
    }

    /**
     * Creates a maintenance reminder notification with zone validation
     * @param req Express request object containing notification details
     * @param res Express response object
     */
    public createMaintenanceNotification = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();

        try {
            const { title, body, zoneId, scheduledTime } = req.body;

            // Validate request payload
            if (!title || !body || !zoneId || !scheduledTime) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required notification parameters'
                });
                return;
            }

            const payload: INotificationPayload = {
                title,
                body,
                type: NotificationType.MAINTENANCE_REMINDER,
                priority: 'normal',
                gardenZone: zoneId,
                plantType: req.body.plantType || '',
                scheduledTime: new Date(scheduledTime),
                data: {
                    zoneId,
                    type: NotificationType.MAINTENANCE_REMINDER,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.notificationService.createNotification(
                NotificationType.MAINTENANCE_REMINDER,
                title,
                body,
                zoneId,
                new Date(scheduledTime)
            );

            const processingTime = Date.now() - startTime;
            
            res.status(201).json({
                success: true,
                notificationId: result.messageId,
                processingTime,
                performanceStatus: this.getPerformanceStatus(processingTime)
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Failed to create maintenance notification: ${(error as Error).message}`
            });
        }
    };

    /**
     * Creates a watering schedule notification with optimized delivery
     * @param req Express request object containing watering schedule details
     * @param res Express response object
     */
    public createWateringNotification = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();

        try {
            const { title, body, zoneId, scheduledTime, wateringDuration } = req.body;

            // Validate watering-specific parameters
            if (!wateringDuration) {
                res.status(400).json({
                    success: false,
                    error: 'Watering duration is required'
                });
                return;
            }

            const payload: INotificationPayload = {
                title,
                body,
                type: NotificationType.WATERING_SCHEDULE,
                priority: 'high', // High priority for watering schedules
                gardenZone: zoneId,
                plantType: req.body.plantType || '',
                scheduledTime: new Date(scheduledTime),
                data: {
                    zoneId,
                    type: NotificationType.WATERING_SCHEDULE,
                    duration: wateringDuration.toString(),
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.notificationService.createNotification(
                NotificationType.WATERING_SCHEDULE,
                title,
                body,
                zoneId,
                new Date(scheduledTime)
            );

            const processingTime = Date.now() - startTime;

            res.status(201).json({
                success: true,
                notificationId: result.messageId,
                processingTime,
                performanceStatus: this.getPerformanceStatus(processingTime)
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Failed to create watering notification: ${(error as Error).message}`
            });
        }
    };

    /**
     * Sends batch notifications to multiple devices with zone-based optimization
     * @param req Express request object containing batch notification details
     * @param res Express response object
     */
    public sendBatchNotifications = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const startTime = Date.now();

        try {
            const { notificationIds, zoneId } = req.body;

            if (!Array.isArray(notificationIds) || !zoneId) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid batch notification parameters'
                });
                return;
            }

            const results = await this.notificationService.sendBatchNotifications(
                notificationIds,
                zoneId
            );

            const processingTime = Date.now() - startTime;
            const successRate = (results.filter(r => r.success).length / results.length) * 100;

            res.status(200).json({
                success: true,
                totalProcessed: results.length,
                successfulDeliveries: results.filter(r => r.success).length,
                failedDeliveries: results.filter(r => !r.success).length,
                processingTime,
                successRate,
                performanceStatus: this.getPerformanceStatus(processingTime)
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Batch notification delivery failed: ${(error as Error).message}`
            });
        }
    };

    /**
     * Retrieves notification delivery performance metrics for a zone
     * @param req Express request object containing zone identifier
     * @param res Express response object
     */
    public getZonePerformanceMetrics = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const { zoneId } = req.params;

            if (!zoneId) {
                res.status(400).json({
                    success: false,
                    error: 'Zone identifier is required'
                });
                return;
            }

            const metrics = await this.notificationService.monitorDeliveryPerformance(zoneId);

            res.status(200).json({
                success: true,
                metrics
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Failed to retrieve zone metrics: ${(error as Error).message}`
            });
        }
    };

    /**
     * Determines performance status based on processing time
     * @param processingTime Time taken to process notification in milliseconds
     * @returns Performance status indicator
     */
    private getPerformanceStatus(processingTime: number): string {
        if (processingTime <= this.performanceThreshold * 0.5) return 'EXCELLENT';
        if (processingTime <= this.performanceThreshold * 0.75) return 'GOOD';
        if (processingTime <= this.performanceThreshold) return 'ACCEPTABLE';
        return 'DEGRADED';
    }
}

export default NotificationController;