import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import moment from 'moment';
import { ScheduleService } from '../../src/services/schedule.service';
import { ScheduleRepository } from '../../src/repositories/schedule.repository';
import { NotificationService } from '../../src/services/notification.service';
import { TaskType, TaskPriority, TaskFrequency } from '../../interfaces/schedule.interface';
import { SCHEDULE_ERRORS, SCHEDULE_LIMITS } from '../../constants/schedule.constants';

describe('Garden Maintenance Schedule Integration Tests', () => {
    let scheduleService: ScheduleService;
    let scheduleRepository: ScheduleRepository;
    let notificationService: NotificationService;
    let testGardenId: string;

    // Mock environmental factors for testing
    const testEnvironmentalFactors = {
        temperature: 25,
        humidity: 60,
        rainfall: 0,
        windSpeed: 5
    };

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/garden-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Initialize services with mocked notification service
        scheduleRepository = new ScheduleRepository(mongoose.model('Schedule'));
        notificationService = new NotificationService(jest.fn());
        scheduleService = new ScheduleService(
            scheduleRepository,
            notificationService
        );

        // Mock notification service methods
        jest.spyOn(notificationService, 'sendScheduleNotification').mockResolvedValue({
            success: true,
            messageId: 'test-message-id',
            retryCount: 0,
            deliveryTime: 100,
            deviceToken: 'test-token',
            timestamp: new Date()
        });
    });

    beforeEach(async () => {
        // Clear test data and create fresh garden
        await scheduleRepository.deleteMany({});
        testGardenId = new mongoose.Types.ObjectId().toString();

        // Reset performance monitoring
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('Schedule Creation Tests', () => {
        it('should create maintenance schedule with environmental factors within performance limits', async () => {
            const startTime = Date.now();

            const schedules = await scheduleService.createMaintenanceSchedule(
                testGardenId,
                7, // 7 days ahead
                testEnvironmentalFactors
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Verify performance requirements
            expect(executionTime).toBeLessThan(2000); // Less than 2 seconds
            expect(schedules.length).toBeGreaterThan(0);
            expect(schedules[0]).toHaveProperty('environmentalFactors');
        });

        it('should adjust schedule based on environmental conditions', async () => {
            const highTempFactors = {
                ...testEnvironmentalFactors,
                temperature: 35,
                humidity: 80
            };

            const schedules = await scheduleService.createMaintenanceSchedule(
                testGardenId,
                7,
                highTempFactors
            );

            // Verify environmental adjustments
            const wateringTasks = schedules.filter(s => s.taskType === TaskType.WATERING);
            expect(wateringTasks[0].priority).toBe(TaskPriority.HIGH);
            expect(wateringTasks.length).toBeGreaterThan(0);
        });

        it('should enforce schedule limits and validate input', async () => {
            await expect(
                scheduleService.createMaintenanceSchedule(
                    testGardenId,
                    SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS + 1,
                    testEnvironmentalFactors
                )
            ).resolves.toHaveLength(SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS);

            await expect(
                scheduleService.createMaintenanceSchedule(
                    '',
                    7,
                    testEnvironmentalFactors
                )
            ).rejects.toThrow(SCHEDULE_ERRORS.INVALID_GARDEN_ID);
        });
    });

    describe('Schedule Retrieval Tests', () => {
        it('should retrieve schedules with pagination and sorting', async () => {
            // Create test schedules
            await scheduleService.createMaintenanceSchedule(
                testGardenId,
                7,
                testEnvironmentalFactors
            );

            const result = await scheduleService.getGardenSchedule(testGardenId);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result).toBeSorted((a, b) => 
                moment(a.dueDate).diff(moment(b.dueDate))
            );
        });

        it('should handle cache operations efficiently', async () => {
            // Create initial schedules
            await scheduleService.createMaintenanceSchedule(
                testGardenId,
                7,
                testEnvironmentalFactors
            );

            const startTime = Date.now();
            
            // First retrieval (uncached)
            await scheduleService.getGardenSchedule(testGardenId);
            
            // Second retrieval (should be cached)
            const cachedResult = await scheduleService.getGardenSchedule(testGardenId);
            
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(1000); // Sub-second requirement
            expect(cachedResult).toBeDefined();
        });
    });

    describe('Task Completion Tests', () => {
        it('should mark tasks completed and generate next schedule', async () => {
            // Create initial schedule
            const schedules = await scheduleService.createMaintenanceSchedule(
                testGardenId,
                7,
                testEnvironmentalFactors
            );

            const testSchedule = schedules[0];
            const startTime = Date.now();

            const result = await scheduleService.markTaskCompleted(
                testSchedule.id,
                testEnvironmentalFactors
            );

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Sub-second requirement
            expect(result).toHaveProperty('completed', false); // New schedule
            expect(result.dueDate).toBeInstanceOf(Date);
            expect(result.dueDate).toBeGreaterThan(testSchedule.dueDate);
        });

        it('should handle environmental factor updates during completion', async () => {
            const schedules = await scheduleService.createMaintenanceSchedule(
                testGardenId,
                7,
                testEnvironmentalFactors
            );

            const updatedFactors = {
                ...testEnvironmentalFactors,
                rainfall: 15, // Heavy rain
                windSpeed: 25 // High wind
            };

            const result = await scheduleService.markTaskCompleted(
                schedules[0].id,
                updatedFactors
            );

            expect(result.dueDate).toBeGreaterThan(schedules[0].dueDate);
            expect(result).toHaveProperty('environmentalFactors', updatedFactors);
        });
    });

    describe('Performance Tests', () => {
        it('should handle concurrent schedule operations', async () => {
            const concurrentOperations = 5;
            const startTime = Date.now();

            const operations = Array(concurrentOperations).fill(null).map(() =>
                scheduleService.createMaintenanceSchedule(
                    testGardenId,
                    7,
                    testEnvironmentalFactors
                )
            );

            const results = await Promise.all(operations);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for all operations
            results.forEach(schedules => {
                expect(schedules.length).toBeGreaterThan(0);
            });
        });

        it('should maintain performance under load', async () => {
            const iterations = 10;
            const timings: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                await scheduleService.createMaintenanceSchedule(
                    testGardenId,
                    7,
                    testEnvironmentalFactors
                );
                timings.push(Date.now() - startTime);
            }

            const averageTime = timings.reduce((a, b) => a + b) / iterations;
            expect(averageTime).toBeLessThan(2000); // Average under 2 seconds
        });
    });
});