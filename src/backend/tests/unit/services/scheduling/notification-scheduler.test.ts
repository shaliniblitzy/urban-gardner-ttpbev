import { messaging } from 'firebase-admin'; // ^11.0.0
import { NotificationSchedulerService } from '../../../../src/services/scheduling/notification-scheduler.service';
import { NotificationType } from '../../../../src/interfaces/notification.interface';
import { notificationConfig } from '../../../../src/config/notification.config';

describe('NotificationSchedulerService', () => {
    let notificationSchedulerService: NotificationSchedulerService;
    let mockMessaging: jest.Mocked<messaging.Messaging>;

    beforeEach(() => {
        // Mock Firebase messaging
        mockMessaging = {
            send: jest.fn(),
            sendAll: jest.fn(),
        } as unknown as jest.Mocked<messaging.Messaging>;

        // Initialize service with mocked messaging
        notificationSchedulerService = new NotificationSchedulerService(mockMessaging);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('scheduleBatchNotifications', () => {
        const validNotifications = [
            {
                title: 'Water Plants',
                body: 'Time to water tomatoes in Zone 1',
                type: NotificationType.WATERING_SCHEDULE,
                data: { token: 'device-token-1' },
                priority: 'high' as const,
                gardenZone: 'Zone 1',
                plantType: 'Tomatoes',
                scheduledTime: new Date()
            },
            {
                title: 'Fertilizer Time',
                body: 'Apply fertilizer to lettuce in Zone 2',
                type: NotificationType.FERTILIZER_REMINDER,
                data: { token: 'device-token-2' },
                priority: 'high' as const,
                gardenZone: 'Zone 2',
                plantType: 'Lettuce',
                scheduledTime: new Date()
            }
        ];

        it('should successfully schedule batch notifications', async () => {
            const mockBatchResponse = {
                responses: [
                    { success: true, messageId: 'msg-1' },
                    { success: true, messageId: 'msg-2' }
                ]
            };

            mockMessaging.sendAll.mockResolvedValue(mockBatchResponse);

            const results = await notificationSchedulerService.scheduleBatchNotifications(
                validNotifications,
                new Date()
            );

            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[0].messageId).toBe('msg-1');
            expect(mockMessaging.sendAll).toHaveBeenCalledTimes(1);
            expect(results[0].deliveryTime).toBeLessThan(notificationConfig.deliverySettings.deliveryTimeout);
        });

        it('should handle batch size limits correctly', async () => {
            const largeBatch = Array(150).fill(validNotifications[0]);
            mockMessaging.sendAll.mockResolvedValue({ responses: [] });

            await notificationSchedulerService.scheduleBatchNotifications(largeBatch, new Date());

            // Should create multiple batches based on maxBatchSize
            const expectedBatches = Math.ceil(150 / notificationConfig.deliverySettings.maxBatchSize);
            expect(mockMessaging.sendAll).toHaveBeenCalledTimes(expectedBatches);
        });

        it('should filter out invalid notifications', async () => {
            const invalidNotifications = [
                ...validNotifications,
                { 
                    // Invalid notification missing required fields
                    title: 'Invalid',
                    type: NotificationType.MAINTENANCE_REMINDER
                } as any
            ];

            mockMessaging.sendAll.mockResolvedValue({ 
                responses: [
                    { success: true, messageId: 'msg-1' },
                    { success: true, messageId: 'msg-2' }
                ]
            });

            const results = await notificationSchedulerService.scheduleBatchNotifications(
                invalidNotifications,
                new Date()
            );

            expect(results).toHaveLength(2);
            expect(mockMessaging.sendAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('scheduleMaintenanceReminder', () => {
        const validReminder = {
            title: 'Maintenance Due',
            body: 'Check garden soil moisture',
            type: NotificationType.MAINTENANCE_REMINDER,
            data: { token: 'device-token-1' },
            priority: 'high' as const,
            gardenZone: 'Zone 1',
            plantType: 'General',
            scheduledTime: new Date()
        };

        it('should successfully schedule a maintenance reminder', async () => {
            mockMessaging.send.mockResolvedValue('message-id-1');

            const result = await notificationSchedulerService.scheduleMaintenanceReminder(validReminder);

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('message-id-1');
            expect(result.deliveryTime).toBeLessThan(notificationConfig.deliverySettings.deliveryTimeout);
            expect(mockMessaging.send).toHaveBeenCalledTimes(1);
        });

        it('should handle delivery failures with retry logic', async () => {
            const error = new Error('messaging/internal-error');
            mockMessaging.send
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce('message-id-retry');

            const result = await notificationSchedulerService.scheduleMaintenanceReminder(validReminder);

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('message-id-retry');
            expect(result.retryCount).toBeGreaterThan(0);
            expect(mockMessaging.send).toHaveBeenCalledTimes(2);
        });

        it('should respect retry policy limits', async () => {
            const error = new Error('messaging/internal-error');
            mockMessaging.send.mockRejectedValue(error);

            const result = await notificationSchedulerService.scheduleMaintenanceReminder(validReminder);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.retryCount).toBe(notificationConfig.retryPolicy.maxAttempts);
            expect(mockMessaging.send).toHaveBeenCalledTimes(notificationConfig.retryPolicy.maxAttempts + 1);
        });
    });

    describe('retryFailedNotification', () => {
        const failedNotification = {
            title: 'Failed Notification',
            body: 'Retry test',
            type: NotificationType.MAINTENANCE_REMINDER,
            data: { token: 'device-token-1' },
            priority: 'high' as const,
            gardenZone: 'Zone 1',
            plantType: 'General',
            scheduledTime: new Date()
        };

        it('should implement exponential backoff', async () => {
            const error = new Error('messaging/internal-error');
            mockMessaging.send.mockRejectedValue(error);

            const startTime = Date.now();
            await notificationSchedulerService.scheduleMaintenanceReminder(failedNotification);
            const totalTime = Date.now() - startTime;

            const expectedMinDelay = notificationConfig.retryPolicy.initialRetryDelay +
                (notificationConfig.retryPolicy.initialRetryDelay * notificationConfig.retryPolicy.backoffMultiplier);

            expect(totalTime).toBeGreaterThanOrEqual(expectedMinDelay);
        });

        it('should not retry non-retryable errors', async () => {
            const error = new Error('messaging/invalid-token');
            mockMessaging.send.mockRejectedValue(error);

            const result = await notificationSchedulerService.scheduleMaintenanceReminder(failedNotification);

            expect(result.success).toBe(false);
            expect(result.retryCount).toBe(0);
            expect(mockMessaging.send).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling', () => {
        it('should handle FCM service unavailability', async () => {
            const error = new Error('messaging/server-unavailable');
            mockMessaging.send.mockRejectedValue(error);

            const result = await notificationSchedulerService.scheduleMaintenanceReminder({
                title: 'Test',
                body: 'Test notification',
                type: NotificationType.MAINTENANCE_REMINDER,
                data: { token: 'device-token-1' },
                priority: 'high',
                gardenZone: 'Zone 1',
                plantType: 'General',
                scheduledTime: new Date()
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error.message).toContain('messaging/server-unavailable');
        });

        it('should handle invalid device tokens', async () => {
            const error = new Error('messaging/invalid-token');
            mockMessaging.send.mockRejectedValue(error);

            const result = await notificationSchedulerService.scheduleMaintenanceReminder({
                title: 'Test',
                body: 'Test notification',
                type: NotificationType.MAINTENANCE_REMINDER,
                data: { token: 'invalid-token' },
                priority: 'high',
                gardenZone: 'Zone 1',
                plantType: 'General',
                scheduledTime: new Date()
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error.message).toContain('messaging/invalid-token');
            expect(mockMessaging.send).toHaveBeenCalledTimes(1);
        });
    });
});