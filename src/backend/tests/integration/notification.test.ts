import { messaging } from 'firebase-admin';
import { NotificationService } from '../../src/services/notification.service';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { NotificationModel } from '../../src/models/notification.model';
import { 
    NotificationType,
    INotificationPayload,
    INotificationResult 
} from '../../src/interfaces/notification.interface';
import { notificationConfig } from '../../src/config/notification.config';

describe('Notification System Integration Tests', () => {
    let notificationService: NotificationService;
    let notificationRepository: NotificationRepository;
    let notificationModel: NotificationModel;
    let testZoneId: string;
    let testDeviceToken: string;

    beforeAll(async () => {
        // Initialize Firebase Admin SDK with test credentials
        const testConfig = {
            credential: messaging.credential.applicationDefault(),
            projectId: 'garden-app-test'
        };
        messaging().app.delete().then(() => messaging.initializeApp(testConfig));

        // Initialize test components
        notificationModel = new NotificationModel();
        notificationRepository = new NotificationRepository(notificationModel);
        notificationService = new NotificationService(notificationRepository);

        // Set up test data
        testZoneId = 'test-zone-1';
        testDeviceToken = 'test-device-token-1';
    });

    beforeEach(() => {
        jest.setTimeout(10000); // Extended timeout for integration tests
    });

    afterAll(async () => {
        await messaging().app.delete();
    });

    describe('Zone-Based Notification Tests', () => {
        test('should create and deliver zone-specific notification', async () => {
            // Arrange
            const payload: INotificationPayload = {
                title: 'Water Plants',
                body: 'Time to water plants in Zone 1',
                type: NotificationType.WATERING_SCHEDULE,
                priority: 'high',
                gardenZone: testZoneId,
                plantType: 'Tomatoes',
                scheduledTime: new Date(Date.now() + 1000 * 60), // 1 minute from now
                data: {
                    zoneId: testZoneId,
                    action: 'WATER_PLANTS'
                }
            };

            // Act
            const result = await notificationService.createNotification(
                payload.type,
                payload.title,
                payload.body,
                testZoneId,
                payload.scheduledTime
            );

            // Assert
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.deliveryTime).toBeLessThan(1000); // Sub-second delivery
            expect(result.retryCount).toBe(0);
        });

        test('should handle batch notifications for multiple devices in zone', async () => {
            // Arrange
            const testDeviceTokens = [
                'test-device-1',
                'test-device-2',
                'test-device-3'
            ];
            const notificationIds = ['notification-1', 'notification-2'];

            // Act
            const results = await notificationService.sendBatchNotifications(
                notificationIds,
                testZoneId
            );

            // Assert
            expect(results).toHaveLength(testDeviceTokens.length);
            expect(results.every(r => r.success)).toBe(true);
            expect(Math.max(...results.map(r => r.deliveryTime))).toBeLessThan(1000);
        });
    });

    describe('Maintenance Schedule Notification Tests', () => {
        test('should deliver maintenance schedule notifications with correct priority', async () => {
            // Arrange
            const maintenancePayload: INotificationPayload = {
                title: 'Fertilizer Application',
                body: 'Apply organic fertilizer to tomato plants',
                type: NotificationType.FERTILIZER_REMINDER,
                priority: 'normal',
                gardenZone: testZoneId,
                plantType: 'Tomatoes',
                scheduledTime: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes from now
                data: {
                    zoneId: testZoneId,
                    action: 'APPLY_FERTILIZER'
                }
            };

            // Act
            const result = await notificationService.createNotification(
                maintenancePayload.type,
                maintenancePayload.title,
                maintenancePayload.body,
                testZoneId,
                maintenancePayload.scheduledTime
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.messageId).toBeDefined();
        });

        test('should respect quiet hours for notification delivery', async () => {
            // Arrange
            const quietHoursTime = new Date();
            quietHoursTime.setHours(23, 0, 0); // Set to quiet hours (11 PM)

            const payload: INotificationPayload = {
                title: 'Test Quiet Hours',
                body: 'This should not deliver during quiet hours',
                type: NotificationType.MAINTENANCE_REMINDER,
                priority: 'normal',
                gardenZone: testZoneId,
                plantType: 'General',
                scheduledTime: quietHoursTime,
                data: { test: 'quiet_hours' }
            };

            // Act & Assert
            await expect(
                notificationService.createNotification(
                    payload.type,
                    payload.title,
                    payload.body,
                    testZoneId,
                    payload.scheduledTime
                )
            ).rejects.toThrow('Notification scheduled during quiet hours');
        });
    });

    describe('Error Handling and Retry Logic', () => {
        test('should retry failed notifications with exponential backoff', async () => {
            // Arrange
            const invalidToken = 'invalid-device-token';
            const startTime = Date.now();

            // Act
            const result = await notificationModel.sendNotification({
                title: 'Retry Test',
                body: 'Testing retry mechanism',
                type: NotificationType.SYSTEM_ALERT,
                priority: 'high',
                gardenZone: testZoneId,
                plantType: 'System',
                scheduledTime: new Date(),
                data: { test: 'retry' }
            }, invalidToken);

            // Assert
            expect(result.success).toBe(false);
            expect(result.retryCount).toBeGreaterThan(0);
            expect(result.retryCount).toBeLessThanOrEqual(notificationConfig.retryPolicy.maxAttempts);
            expect(Date.now() - startTime).toBeGreaterThan(
                notificationConfig.retryPolicy.initialRetryDelay
            );
        });

        test('should handle concurrent notification requests', async () => {
            // Arrange
            const concurrentRequests = 5;
            const notifications: Promise<INotificationResult>[] = [];

            // Act
            for (let i = 0; i < concurrentRequests; i++) {
                notifications.push(
                    notificationService.createNotification(
                        NotificationType.MAINTENANCE_REMINDER,
                        `Test ${i}`,
                        `Concurrent test ${i}`,
                        testZoneId,
                        new Date()
                    )
                );
            }

            const results = await Promise.all(notifications);

            // Assert
            expect(results).toHaveLength(concurrentRequests);
            expect(results.every(r => r.success)).toBe(true);
        });
    });

    describe('Performance Monitoring', () => {
        test('should track notification delivery metrics', async () => {
            // Arrange & Act
            const result = await notificationService.createNotification(
                NotificationType.WATERING_SCHEDULE,
                'Performance Test',
                'Testing metrics tracking',
                testZoneId,
                new Date()
            );

            const metrics = await notificationRepository.getZoneNotificationStatus(testZoneId);

            // Assert
            expect(metrics).toBeDefined();
            expect(metrics.metrics.totalSent).toBeGreaterThan(0);
            expect(metrics.metrics.averageDeliveryTime).toBeLessThan(1000);
            expect(metrics.lastDelivery).toBeInstanceOf(Date);
        });
    });
});