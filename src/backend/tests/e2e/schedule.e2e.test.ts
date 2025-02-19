import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { performance, PerformanceObserver } from 'perf_hooks';
import { ISchedule, TaskType } from '../../src/interfaces/schedule.interface';
import { NotificationService } from '../../src/services/notification.service';

describe('Schedule Management E2E Tests', () => {
    let app: INestApplication;
    let notificationService: NotificationService;
    let testGardenId: string;
    let perfObserver: PerformanceObserver;

    // Performance measurement entries
    const performanceEntries: { name: string, duration: number }[] = [];

    beforeAll(async () => {
        // Initialize performance observer
        perfObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            performanceEntries.push(...entries.map(entry => ({
                name: entry.name,
                duration: entry.duration
            })));
        });
        perfObserver.observe({ entryTypes: ['measure'] });

        // Create test module
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [], // Add necessary modules
            providers: [
                {
                    provide: NotificationService,
                    useValue: {
                        sendNotification: jest.fn().mockImplementation(async () => ({
                            success: true,
                            messageId: 'test-message-id',
                            deliveryTime: 500,
                            timestamp: new Date()
                        }))
                    }
                }
            ]
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        notificationService = moduleFixture.get<NotificationService>(NotificationService);
        testGardenId = 'test-garden-' + Date.now();
    });

    afterAll(async () => {
        perfObserver.disconnect();
        await app.close();
    });

    describe('Schedule Creation and Performance', () => {
        it('should create a maintenance schedule within 2 seconds', async () => {
            // Start performance measurement
            performance.mark('schedule-creation-start');

            const scheduleData: Partial<ISchedule> = {
                gardenId: testGardenId,
                taskType: TaskType.WATERING,
                dueDate: new Date(Date.now() + 86400000), // Tomorrow
                notificationPreferences: {
                    enabled: true,
                    advanceNotice: 2, // 2 hours
                    reminderFrequency: 1 // Every hour
                }
            };

            const response = await request(app.getHttpServer())
                .post('/api/schedules')
                .send(scheduleData)
                .expect(201);

            // End performance measurement
            performance.mark('schedule-creation-end');
            performance.measure(
                'Schedule Creation Time',
                'schedule-creation-start',
                'schedule-creation-end'
            );

            // Verify response structure
            expect(response.body).toMatchObject({
                id: expect.any(String),
                gardenId: testGardenId,
                taskType: TaskType.WATERING,
                dueDate: expect.any(String)
            });

            // Verify performance requirement (< 2 seconds)
            const creationEntry = performanceEntries.find(e => e.name === 'Schedule Creation Time');
            expect(creationEntry?.duration).toBeLessThan(2000);
        });

        it('should handle bulk schedule creation efficiently', async () => {
            const bulkSchedules = Array(10).fill(null).map((_, index) => ({
                gardenId: testGardenId,
                taskType: TaskType.WATERING,
                dueDate: new Date(Date.now() + (86400000 * (index + 1))),
                notificationPreferences: {
                    enabled: true,
                    advanceNotice: 2,
                    reminderFrequency: 1
                }
            }));

            performance.mark('bulk-creation-start');

            const responses = await Promise.all(
                bulkSchedules.map(schedule => 
                    request(app.getHttpServer())
                        .post('/api/schedules')
                        .send(schedule)
                        .expect(201)
                )
            );

            performance.mark('bulk-creation-end');
            performance.measure(
                'Bulk Schedule Creation Time',
                'bulk-creation-start',
                'bulk-creation-end'
            );

            // Verify all schedules were created
            expect(responses).toHaveLength(10);
            responses.forEach(response => {
                expect(response.body.id).toBeDefined();
            });

            // Verify bulk operation performance
            const bulkEntry = performanceEntries.find(e => e.name === 'Bulk Schedule Creation Time');
            expect(bulkEntry?.duration / 10).toBeLessThan(2000); // Average time per schedule
        });
    });

    describe('Notification Delivery Performance', () => {
        it('should deliver notifications within 1 second', async () => {
            const scheduleId = 'test-schedule-' + Date.now();
            
            performance.mark('notification-start');

            const response = await request(app.getHttpServer())
                .post(`/api/schedules/${scheduleId}/notifications`)
                .send({
                    type: 'REMINDER',
                    message: 'Time to water your garden!'
                })
                .expect(200);

            performance.mark('notification-end');
            performance.measure(
                'Notification Delivery Time',
                'notification-start',
                'notification-end'
            );

            // Verify notification was sent
            expect(response.body.success).toBe(true);
            expect(response.body.messageId).toBeDefined();

            // Verify delivery time requirement (< 1 second)
            const notificationEntry = performanceEntries.find(e => e.name === 'Notification Delivery Time');
            expect(notificationEntry?.duration).toBeLessThan(1000);
        });

        it('should handle notification delivery failures gracefully', async () => {
            // Mock notification service to simulate failure
            jest.spyOn(notificationService, 'sendNotification')
                .mockRejectedValueOnce(new Error('Delivery failed'));

            const response = await request(app.getHttpServer())
                .post(`/api/schedules/test-schedule/notifications`)
                .send({
                    type: 'REMINDER',
                    message: 'Test notification'
                })
                .expect(500);

            expect(response.body.error).toBeDefined();
            expect(response.body.retryAvailable).toBe(true);
        });
    });

    describe('Calendar Integration', () => {
        it('should sync schedule with calendar efficiently', async () => {
            const scheduleId = 'test-schedule-' + Date.now();

            performance.mark('calendar-sync-start');

            const response = await request(app.getHttpServer())
                .post(`/api/schedules/${scheduleId}/calendar-sync`)
                .send({
                    calendarId: 'primary'
                })
                .expect(200);

            performance.mark('calendar-sync-end');
            performance.measure(
                'Calendar Sync Time',
                'calendar-sync-start',
                'calendar-sync-end'
            );

            // Verify calendar sync
            expect(response.body.synced).toBe(true);
            expect(response.body.calendarEventId).toBeDefined();

            // Verify sync performance
            const syncEntry = performanceEntries.find(e => e.name === 'Calendar Sync Time');
            expect(syncEntry?.duration).toBeLessThan(3000);
        });

        it('should update calendar events when schedule changes', async () => {
            const scheduleId = 'test-schedule-' + Date.now();

            // Create initial schedule with calendar event
            await request(app.getHttpServer())
                .post(`/api/schedules/${scheduleId}/calendar-sync`)
                .send({ calendarId: 'primary' })
                .expect(200);

            // Update schedule
            const updateResponse = await request(app.getHttpServer())
                .put(`/api/schedules/${scheduleId}`)
                .send({
                    dueDate: new Date(Date.now() + 172800000) // 2 days later
                })
                .expect(200);

            // Verify calendar event was updated
            expect(updateResponse.body.calendarEventUpdated).toBe(true);
            expect(updateResponse.body.lastSyncTime).toBeDefined();
        });
    });

    describe('Schedule Management Performance', () => {
        it('should retrieve schedules with pagination efficiently', async () => {
            performance.mark('retrieval-start');

            const response = await request(app.getHttpServer())
                .get(`/api/schedules`)
                .query({
                    gardenId: testGardenId,
                    page: 1,
                    limit: 20
                })
                .expect(200);

            performance.mark('retrieval-end');
            performance.measure(
                'Schedule Retrieval Time',
                'retrieval-start',
                'retrieval-end'
            );

            // Verify pagination
            expect(response.body.items).toBeDefined();
            expect(response.body.total).toBeDefined();
            expect(response.body.page).toBe(1);

            // Verify retrieval performance
            const retrievalEntry = performanceEntries.find(e => e.name === 'Schedule Retrieval Time');
            expect(retrievalEntry?.duration).toBeLessThan(1000);
        });

        it('should handle concurrent schedule updates', async () => {
            const scheduleId = 'test-schedule-' + Date.now();
            const updatePromises = Array(5).fill(null).map((_, index) => 
                request(app.getHttpServer())
                    .put(`/api/schedules/${scheduleId}`)
                    .send({
                        dueDate: new Date(Date.now() + (86400000 * (index + 1)))
                    })
            );

            performance.mark('concurrent-updates-start');
            const results = await Promise.all(updatePromises);
            performance.mark('concurrent-updates-end');
            performance.measure(
                'Concurrent Updates Time',
                'concurrent-updates-start',
                'concurrent-updates-end'
            );

            // Verify concurrent updates handled correctly
            results.forEach(result => {
                expect(result.status).toBe(200);
                expect(result.body.version).toBeDefined();
            });

            // Verify performance of concurrent operations
            const concurrentEntry = performanceEntries.find(e => e.name === 'Concurrent Updates Time');
            expect(concurrentEntry?.duration / 5).toBeLessThan(1000); // Average time per update
        });
    });
});