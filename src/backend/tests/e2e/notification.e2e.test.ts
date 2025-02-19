import { messaging } from 'firebase-admin'; // ^11.0.0
import { NotificationService } from '../../src/services/notification.service';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { NotificationType } from '../../src/interfaces/notification.interface';
import { notificationConfig } from '../../src/config/notification.config';
import { NotificationModel } from '../../src/models/notification.model';

describe('Notification System E2E Tests', () => {
    let notificationService: NotificationService;
    let notificationRepository: NotificationRepository;
    let notificationModel: NotificationModel;
    let testDeviceTokens: { [key: string]: string[] };
    let performanceMetrics: { [key: string]: number[] };

    beforeAll(async () => {
        // Initialize Firebase Admin SDK with test credentials
        const testConfig = {
            credential: messaging.credential.applicationDefault(),
            projectId: 'garden-app-test'
        };
        messaging.initializeApp(testConfig);

        // Initialize test components
        notificationModel = new NotificationModel();
        notificationRepository = new NotificationRepository(notificationModel);
        notificationService = new NotificationService(notificationRepository);

        // Setup test device tokens for different zones
        testDeviceTokens = {
            'zone-1': ['test-token-1-1', 'test-token-1-2'],
            'zone-2': ['test-token-2-1', 'test-token-2-2'],
            'zone-3': ['test-token-3-1', 'test-token-3-2']
        };

        // Initialize performance tracking
        performanceMetrics = {
            deliveryTimes: [],
            batchDeliveryTimes: [],
            zoneProcessingTimes: []
        };
    });

    afterAll(async () => {
        // Clean up test data
        await Promise.all(Object.keys(testDeviceTokens).map(async (zoneId) => {
            const notifications = await notificationRepository.getZoneNotificationStatus(zoneId);
            // Store final metrics
            performanceMetrics.zoneProcessingTimes.push(
                notifications.metrics.averageDeliveryTime
            );
        }));

        // Close Firebase connection
        await messaging.app().delete();
    });

    describe('Zone-based Notification Delivery', () => {
        test('should deliver notifications to specific garden zones', async () => {
            const testZones = Object.keys(testDeviceTokens);
            const results = await Promise.all(testZones.map(async (zoneId) => {
                const startTime = Date.now();

                const notification = await notificationService.createNotification(
                    NotificationType.WATERING_SCHEDULE,
                    'Water plants in Zone ' + zoneId,
                    'Time to water your plants!',
                    zoneId,
                    new Date(Date.now() + 1000) // Schedule 1 second in future
                );

                const deliveryResults = await notificationRepository.sendZoneNotification(
                    notification.messageId,
                    zoneId
                );

                performanceMetrics.deliveryTimes.push(Date.now() - startTime);

                return {
                    zoneId,
                    success: deliveryResults.every(result => result.success),
                    deliveryTime: Date.now() - startTime
                };
            }));

            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.deliveryTime).toBeLessThan(1000); // Sub-second delivery requirement
            });
        });

        test('should respect zone-specific quiet hours', async () => {
            const quietHoursZone = 'zone-1';
            const currentHour = new Date().getHours();
            const quietStart = parseInt(notificationConfig.deliverySettings.quietHours.start);
            const quietEnd = parseInt(notificationConfig.deliverySettings.quietHours.end);

            // Attempt to send notification during quiet hours
            const notificationDuringQuietHours = await notificationService.createNotification(
                NotificationType.MAINTENANCE_REMINDER,
                'Quiet Hours Test',
                'This should be queued',
                quietHoursZone,
                new Date(Date.now())
            );

            if (currentHour >= quietStart || currentHour < quietEnd) {
                // Should be queued, not delivered immediately
                const status = await notificationRepository.getZoneNotificationStatus(quietHoursZone);
                expect(status.metrics.totalSent).toBe(0);
            }
        });
    });

    describe('Notification Performance Testing', () => {
        test('should meet sub-second delivery requirement for batch notifications', async () => {
            const batchTestZone = 'zone-2';
            const batchSize = notificationConfig.deliverySettings.maxBatchSize;
            const notifications = Array(batchSize).fill(null).map((_, index) => ({
                type: NotificationType.FERTILIZER_REMINDER,
                title: `Batch Test ${index + 1}`,
                body: 'Testing batch delivery performance',
                zoneId: batchTestZone,
                scheduledTime: new Date(Date.now() + 1000)
            }));

            const startTime = Date.now();
            const batchResults = await notificationService.sendBatchNotifications(
                notifications.map(n => n.title),
                batchTestZone
            );

            const batchDeliveryTime = Date.now() - startTime;
            performanceMetrics.batchDeliveryTimes.push(batchDeliveryTime);

            expect(batchDeliveryTime).toBeLessThan(1000);
            expect(batchResults.every(result => result.success)).toBe(true);
        });

        test('should maintain performance under high load', async () => {
            const highLoadZone = 'zone-3';
            const concurrentBatches = notificationConfig.deliverySettings.maxConcurrentBatches;
            const startTime = Date.now();

            const loadTestPromises = Array(concurrentBatches).fill(null).map((_, index) =>
                notificationService.createNotification(
                    NotificationType.SYSTEM_ALERT,
                    `Load Test ${index + 1}`,
                    'Testing system performance under load',
                    highLoadZone,
                    new Date(Date.now() + 1000)
                )
            );

            const results = await Promise.all(loadTestPromises);
            const loadTestTime = Date.now() - startTime;

            expect(loadTestTime).toBeLessThan(concurrentBatches * 1000);
            expect(results.every(result => result.success)).toBe(true);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle network failures with retry policy', async () => {
            const failureTestZone = 'zone-1';
            // Simulate network failure
            jest.spyOn(messaging, 'send').mockRejectedValueOnce(new Error('Network error'));

            const notification = await notificationService.createNotification(
                NotificationType.MAINTENANCE_REMINDER,
                'Retry Test',
                'Testing retry mechanism',
                failureTestZone,
                new Date(Date.now() + 1000)
            );

            const result = await notificationRepository.sendZoneNotification(
                notification.messageId,
                failureTestZone
            );

            expect(result[0].retryCount).toBeGreaterThan(0);
            expect(result[0].success).toBe(true);
        });

        test('should validate notification parameters', async () => {
            await expect(
                notificationService.createNotification(
                    'INVALID_TYPE' as NotificationType,
                    'Invalid Test',
                    'Testing parameter validation',
                    'zone-1',
                    new Date()
                )
            ).rejects.toThrow('Invalid notification type');
        });
    });
});