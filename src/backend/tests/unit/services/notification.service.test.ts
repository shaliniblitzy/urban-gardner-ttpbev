import { jest } from '@jest/globals';
import { NotificationService } from '../../src/services/notification.service';
import { NotificationRepository } from '../../src/repositories/notification.repository';
import { 
    NotificationType,
    INotificationPayload,
    INotificationDeliverySettings
} from '../../src/interfaces/notification.interface';

describe('NotificationService', () => {
    let notificationService: NotificationService;
    let mockNotificationRepository: jest.Mocked<NotificationRepository>;
    let mockDeliverySettings: INotificationDeliverySettings;

    beforeEach(() => {
        // Mock repository
        mockNotificationRepository = {
            createNotification: jest.fn(),
            sendNotification: jest.fn(),
            sendBatchNotifications: jest.fn(),
            getNotificationStatus: jest.fn(),
            createZoneNotification: jest.fn(),
            sendZoneNotification: jest.fn()
        } as jest.Mocked<NotificationRepository>;

        // Mock delivery settings
        mockDeliverySettings = {
            maxBatchSize: 100,
            maxConcurrentBatches: 5,
            deliveryTimeout: 1000,
            maxRetries: 3,
            timeZone: 'UTC',
            quietHours: {
                start: '22:00',
                end: '07:00'
            }
        };

        notificationService = new NotificationService(mockNotificationRepository);
    });

    describe('createMaintenanceNotification', () => {
        const validPayload = {
            title: 'Maintenance Required',
            body: 'Time to check your garden',
            type: NotificationType.MAINTENANCE_REMINDER,
            zoneId: 'zone-1',
            scheduledTime: new Date()
        };

        it('should create a maintenance notification successfully', async () => {
            const expectedNotificationId = 'test-notification-id';
            mockNotificationRepository.createZoneNotification.mockResolvedValue(expectedNotificationId);

            const result = await notificationService.createNotification(
                validPayload.type,
                validPayload.title,
                validPayload.body,
                validPayload.zoneId,
                validPayload.scheduledTime
            );

            expect(result.success).toBe(true);
            expect(result.messageId).toBe(expectedNotificationId);
            expect(mockNotificationRepository.createZoneNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.MAINTENANCE_REMINDER,
                    title: validPayload.title,
                    body: validPayload.body,
                    gardenZone: validPayload.zoneId
                }),
                validPayload.zoneId
            );
        });

        it('should validate notification parameters', async () => {
            const invalidPayload = {
                ...validPayload,
                title: '' // Invalid title
            };

            await expect(
                notificationService.createNotification(
                    invalidPayload.type,
                    invalidPayload.title,
                    invalidPayload.body,
                    invalidPayload.zoneId,
                    invalidPayload.scheduledTime
                )
            ).rejects.toThrow('Invalid title length');
        });
    });

    describe('sendBatchNotifications', () => {
        const mockNotifications = [
            'notification-1',
            'notification-2',
            'notification-3'
        ];

        it('should send batch notifications with optimal performance', async () => {
            const startTime = Date.now();
            const mockResults = mockNotifications.map(id => ({
                success: true,
                messageId: id,
                retryCount: 0,
                deliveryTime: 100,
                deviceToken: 'device-token',
                timestamp: new Date()
            }));

            mockNotificationRepository.sendZoneNotification.mockResolvedValue(mockResults);

            const results = await notificationService.sendBatchNotifications(
                mockNotifications,
                'zone-1'
            );

            const deliveryTime = Date.now() - startTime;
            expect(deliveryTime).toBeLessThan(1000); // Sub-second delivery requirement
            expect(results).toHaveLength(mockNotifications.length);
            expect(results.every(r => r.success)).toBe(true);
        });

        it('should handle batch delivery failures with retry mechanism', async () => {
            mockNotificationRepository.sendZoneNotification
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValueOnce(mockNotifications.map(id => ({
                    success: true,
                    messageId: id,
                    retryCount: 1,
                    deliveryTime: 100,
                    deviceToken: 'device-token',
                    timestamp: new Date()
                })));

            const results = await notificationService.sendBatchNotifications(
                mockNotifications,
                'zone-1'
            );

            expect(mockNotificationRepository.sendZoneNotification).toHaveBeenCalledTimes(2);
            expect(results.every(r => r.success)).toBe(true);
            expect(results[0].retryCount).toBe(1);
        });
    });

    describe('sendZoneNotification', () => {
        const mockZoneId = 'zone-1';
        const mockNotificationId = 'notification-1';

        it('should deliver zone-specific notifications successfully', async () => {
            const mockResult = {
                success: true,
                messageId: mockNotificationId,
                retryCount: 0,
                deliveryTime: 100,
                deviceToken: 'device-token',
                timestamp: new Date()
            };

            mockNotificationRepository.sendZoneNotification.mockResolvedValue([mockResult]);

            const result = await notificationService.sendZoneNotification(
                mockNotificationId,
                mockZoneId
            );

            expect(result[0].success).toBe(true);
            expect(result[0].messageId).toBe(mockNotificationId);
            expect(mockNotificationRepository.sendZoneNotification).toHaveBeenCalledWith(
                mockNotificationId,
                mockZoneId
            );
        });

        it('should respect quiet hours for zone notifications', async () => {
            const quietHourTime = new Date();
            quietHourTime.setHours(23, 0, 0); // During quiet hours

            await expect(
                notificationService.sendZoneNotification(
                    mockNotificationId,
                    mockZoneId,
                    quietHourTime
                )
            ).rejects.toThrow('Notification scheduled during quiet hours');
        });
    });

    describe('monitorDeliveryPerformance', () => {
        const mockZoneId = 'zone-1';

        it('should track notification delivery performance metrics', async () => {
            const mockMetrics = {
                totalAttempts: 10,
                successRate: 95,
                averageDeliveryTime: 150,
                lastDeliveryTimestamp: new Date()
            };

            mockNotificationRepository.getNotificationStatus.mockResolvedValue({
                metrics: mockMetrics,
                lastDelivery: new Date()
            });

            const performance = await notificationService.monitorDeliveryPerformance(mockZoneId);

            expect(performance.metrics).toMatchObject({
                totalAttempts: mockMetrics.totalAttempts,
                successRate: mockMetrics.successRate,
                averageDeliveryTime: mockMetrics.averageDeliveryTime
            });
            expect(performance.status).toBe('GOOD');
        });

        it('should identify degraded performance', async () => {
            const mockMetrics = {
                totalAttempts: 10,
                successRate: 85,
                averageDeliveryTime: 800,
                lastDeliveryTimestamp: new Date()
            };

            mockNotificationRepository.getNotificationStatus.mockResolvedValue({
                metrics: mockMetrics,
                lastDelivery: new Date()
            });

            const performance = await notificationService.monitorDeliveryPerformance(mockZoneId);

            expect(performance.status).toBe('DEGRADED');
        });
    });

    describe('validateQuietHours', () => {
        it('should correctly validate notification timing', () => {
            const activeTime = new Date();
            activeTime.setHours(14, 0, 0); // During active hours

            const quietTime = new Date();
            quietTime.setHours(23, 0, 0); // During quiet hours

            expect(() => notificationService.validateQuietHours(activeTime)).not.toThrow();
            expect(() => notificationService.validateQuietHours(quietTime)).toThrow();
        });
    });

    describe('handleRetry', () => {
        it('should implement exponential backoff for retries', async () => {
            const mockError = new Error('Temporary failure');
            const startTime = Date.now();

            mockNotificationRepository.sendNotification
                .mockRejectedValueOnce(mockError)
                .mockRejectedValueOnce(mockError)
                .mockResolvedValueOnce({ success: true, messageId: 'test-id' });

            await notificationService.handleRetry(
                async () => mockNotificationRepository.sendNotification('test-payload', 'test-token'),
                'test-operation'
            );

            const totalTime = Date.now() - startTime;
            expect(totalTime).toBeGreaterThan(3000); // Account for exponential backoff
            expect(mockNotificationRepository.sendNotification).toHaveBeenCalledTimes(3);
        });
    });
});