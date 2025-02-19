import { Test, TestingModule } from '@nestjs/testing';
import { Cache } from 'cache-manager';
import moment from 'moment';
import { ScheduleService } from '../../src/services/schedule.service';
import { ScheduleRepository } from '../../src/repositories/schedule.repository';
import { MaintenanceCalculator } from '../../src/services/scheduling/maintenance-calculator.service';
import { NotificationSchedulerService } from '../../src/services/scheduling/notification-scheduler.service';
import { ISchedule, TaskType, TaskPriority } from '../../src/interfaces/schedule.interface';
import { SCHEDULE_ERRORS, SCHEDULE_LIMITS } from '../../src/constants/schedule.constants';

describe('ScheduleService', () => {
    let service: ScheduleService;
    let scheduleRepository: jest.Mocked<ScheduleRepository>;
    let maintenanceCalculator: jest.Mocked<MaintenanceCalculator>;
    let notificationScheduler: jest.Mocked<NotificationSchedulerService>;
    let cacheManager: jest.Mocked<Cache>;

    const mockEnvironmentalFactors = {
        temperature: 25,
        humidity: 60,
        rainfall: 0,
        windSpeed: 5
    };

    const mockSchedule: ISchedule = {
        id: 'test-schedule-1',
        gardenId: 'test-garden-1',
        plantId: 'test-plant-1',
        taskType: TaskType.WATERING,
        dueDate: new Date(),
        priority: TaskPriority.HIGH,
        completed: false,
        completedDate: null,
        environmentalFactors: mockEnvironmentalFactors,
        weather_dependent: true
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScheduleService,
                {
                    provide: ScheduleRepository,
                    useFactory: () => ({
                        createSchedule: jest.fn(),
                        getSchedulesByGardenId: jest.fn(),
                        getPendingTasks: jest.fn(),
                        markTaskCompleted: jest.fn(),
                        batchCreateSchedules: jest.fn()
                    })
                },
                {
                    provide: MaintenanceCalculator,
                    useFactory: () => ({
                        calculateNextMaintenanceDate: jest.fn(),
                        generateMaintenanceSchedule: jest.fn(),
                        adjustForEnvironmentalFactors: jest.fn()
                    })
                },
                {
                    provide: NotificationSchedulerService,
                    useFactory: () => ({
                        scheduleNotification: jest.fn(),
                        scheduleBatchNotifications: jest.fn()
                    })
                },
                {
                    provide: 'CACHE_MANAGER',
                    useFactory: () => ({
                        get: jest.fn(),
                        set: jest.fn(),
                        del: jest.fn()
                    })
                }
            ]
        }).compile();

        service = module.get<ScheduleService>(ScheduleService);
        scheduleRepository = module.get(ScheduleRepository);
        maintenanceCalculator = module.get(MaintenanceCalculator);
        notificationScheduler = module.get(NotificationSchedulerService);
        cacheManager = module.get('CACHE_MANAGER');
    });

    describe('createMaintenanceSchedule', () => {
        it('should create maintenance schedule with environmental factors', async () => {
            const gardenId = 'test-garden-1';
            const daysAhead = 7;
            const mockSchedules = [mockSchedule];

            maintenanceCalculator.generateMaintenanceSchedule.mockResolvedValue(mockSchedules);
            scheduleRepository.createSchedule.mockResolvedValue(mockSchedule);
            notificationScheduler.scheduleBatchNotifications.mockResolvedValue([]);
            cacheManager.get.mockResolvedValue(null);

            const result = await service.createMaintenanceSchedule(
                gardenId,
                daysAhead,
                mockEnvironmentalFactors
            );

            expect(result).toEqual(mockSchedules);
            expect(maintenanceCalculator.generateMaintenanceSchedule).toHaveBeenCalledWith(
                gardenId,
                daysAhead,
                mockEnvironmentalFactors
            );
            expect(cacheManager.set).toHaveBeenCalled();
        });

        it('should respect schedule limits', async () => {
            const gardenId = 'test-garden-1';
            const daysAhead = SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS + 10;

            await service.createMaintenanceSchedule(
                gardenId,
                daysAhead,
                mockEnvironmentalFactors
            );

            expect(maintenanceCalculator.generateMaintenanceSchedule).toHaveBeenCalledWith(
                gardenId,
                SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS,
                mockEnvironmentalFactors
            );
        });

        it('should use cached schedule when available', async () => {
            const gardenId = 'test-garden-1';
            const cachedSchedules = [mockSchedule];
            cacheManager.get.mockResolvedValue(cachedSchedules);

            const result = await service.createMaintenanceSchedule(
                gardenId,
                7,
                mockEnvironmentalFactors
            );

            expect(result).toEqual(cachedSchedules);
            expect(maintenanceCalculator.generateMaintenanceSchedule).not.toHaveBeenCalled();
        });
    });

    describe('getGardenSchedule', () => {
        it('should retrieve and sort garden schedules', async () => {
            const gardenId = 'test-garden-1';
            const mockSchedules = [
                { ...mockSchedule, dueDate: moment().add(2, 'days').toDate() },
                { ...mockSchedule, dueDate: moment().add(1, 'day').toDate() }
            ];

            scheduleRepository.getSchedulesByGardenId.mockResolvedValue(mockSchedules);
            cacheManager.get.mockResolvedValue(null);

            const result = await service.getGardenSchedule(gardenId);

            expect(result[0].dueDate).toBeBefore(result[1].dueDate);
            expect(cacheManager.set).toHaveBeenCalled();
        });
    });

    describe('markTaskCompleted', () => {
        it('should mark task completed and create next schedule with environmental factors', async () => {
            const scheduleId = 'test-schedule-1';
            const completedSchedule = { ...mockSchedule, completed: true, completedDate: new Date() };
            const nextDate = moment().add(1, 'day').toDate();
            const nextSchedule = { ...mockSchedule, id: 'test-schedule-2', dueDate: nextDate };

            scheduleRepository.markTaskCompleted.mockResolvedValue(completedSchedule);
            maintenanceCalculator.calculateNextMaintenanceDate.mockResolvedValue(nextDate);
            scheduleRepository.createSchedule.mockResolvedValue(nextSchedule);

            const result = await service.markTaskCompleted(scheduleId, mockEnvironmentalFactors);

            expect(result).toEqual(nextSchedule);
            expect(maintenanceCalculator.calculateNextMaintenanceDate).toHaveBeenCalledWith(
                completedSchedule.plantId,
                completedSchedule.taskType,
                mockEnvironmentalFactors
            );
            expect(cacheManager.del).toHaveBeenCalled();
        });
    });

    describe('Performance and Error Handling', () => {
        it('should handle batch creation efficiently', async () => {
            const gardenId = 'test-garden-1';
            const mockSchedules = Array(150).fill(mockSchedule);
            const startTime = Date.now();

            maintenanceCalculator.generateMaintenanceSchedule.mockResolvedValue(mockSchedules);
            scheduleRepository.createSchedule.mockResolvedValue(mockSchedule);

            await service.createMaintenanceSchedule(gardenId, 7, mockEnvironmentalFactors);

            const executionTime = Date.now() - startTime;
            expect(executionTime).toBeLessThan(3000); // 3 seconds max
        });

        it('should handle invalid garden ID', async () => {
            const invalidGardenId = '';

            await expect(
                service.createMaintenanceSchedule(invalidGardenId, 7, mockEnvironmentalFactors)
            ).rejects.toThrow(SCHEDULE_ERRORS.INVALID_GARDEN_ID);
        });
    });
});