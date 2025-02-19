import { Test, TestingModule } from '@nestjs/testing';
import { Cache } from '@nestjs/common';
import { ScheduleGeneratorService } from '../../../src/services/scheduling/schedule-generator.service';
import { MaintenanceCalculator } from '../../../src/services/scheduling/maintenance-calculator.service';
import { NotificationSchedulerService } from '../../../src/services/scheduling/notification-scheduler.service';
import { Schedule } from '../../../src/models/schedule.model';
import { ISchedule, TaskType, TaskPriority } from '../../../src/interfaces/schedule.interface';
import { SCHEDULE_ERRORS, SCHEDULE_LIMITS } from '../../../src/constants/schedule.constants';
import moment from 'moment'; // ^2.29.0
import now from 'performance-now'; // ^2.1.0

describe('ScheduleGeneratorService', () => {
    let service: ScheduleGeneratorService;
    let maintenanceCalculator: jest.Mocked<MaintenanceCalculator>;
    let notificationScheduler: jest.Mocked<NotificationSchedulerService>;
    let scheduleModel: jest.Mocked<typeof Schedule>;
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
        completed: false,
        completedDate: null,
        priority: TaskPriority.HIGH,
        notificationPreferences: {
            enabled: true,
            advanceNotice: 24,
            reminderFrequency: 12
        },
        notificationHistory: [],
        notes: '',
        weather_dependent: true
    };

    beforeEach(async () => {
        // Create mock implementations
        maintenanceCalculator = {
            generateMaintenanceSchedule: jest.fn(),
            calculateTaskPriority: jest.fn(),
            adjustForEnvironmentalFactors: jest.fn()
        } as any;

        notificationScheduler = {
            scheduleBatchNotifications: jest.fn(),
            scheduleMaintenanceReminder: jest.fn(),
            cancelNotification: jest.fn()
        } as any;

        scheduleModel = {
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            batchUpsert: jest.fn()
        } as any;

        cacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn()
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScheduleGeneratorService,
                {
                    provide: MaintenanceCalculator,
                    useValue: maintenanceCalculator
                },
                {
                    provide: NotificationSchedulerService,
                    useValue: notificationScheduler
                },
                {
                    provide: Schedule,
                    useValue: scheduleModel
                },
                {
                    provide: Cache,
                    useValue: cacheManager
                }
            ]
        }).compile();

        service = module.get<ScheduleGeneratorService>(ScheduleGeneratorService);
    });

    describe('Schedule Generation', () => {
        it('should generate schedules within performance requirements', async () => {
            const startTime = now();
            maintenanceCalculator.generateMaintenanceSchedule.mockResolvedValue([mockSchedule]);
            notificationScheduler.scheduleBatchNotifications.mockResolvedValue([{ success: true }]);
            scheduleModel.batchUpsert.mockResolvedValue([mockSchedule]);

            await service.generateSchedule('test-garden-1', 7, mockEnvironmentalFactors);
            
            const executionTime = now() - startTime;
            expect(executionTime).toBeLessThan(2000); // Under 2 second requirement
        });

        it('should respect maximum schedule days limit', async () => {
            await service.generateSchedule('test-garden-1', SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS + 10, mockEnvironmentalFactors);
            
            expect(maintenanceCalculator.generateMaintenanceSchedule).toHaveBeenCalledWith(
                'test-garden-1',
                SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS,
                mockEnvironmentalFactors
            );
        });

        it('should utilize cache for repeated requests', async () => {
            const cachedSchedules = [mockSchedule];
            cacheManager.get.mockResolvedValue(cachedSchedules);

            const result = await service.generateSchedule('test-garden-1', 7, mockEnvironmentalFactors);
            
            expect(result).toEqual(cachedSchedules);
            expect(maintenanceCalculator.generateMaintenanceSchedule).not.toHaveBeenCalled();
        });

        it('should handle environmental factors correctly', async () => {
            const highTempFactors = { ...mockEnvironmentalFactors, temperature: 35 };
            maintenanceCalculator.generateMaintenanceSchedule.mockResolvedValue([mockSchedule]);

            await service.generateSchedule('test-garden-1', 7, highTempFactors);
            
            expect(maintenanceCalculator.generateMaintenanceSchedule).toHaveBeenCalledWith(
                'test-garden-1',
                7,
                highTempFactors
            );
        });
    });

    describe('Schedule Updates', () => {
        it('should update schedule with new environmental factors', async () => {
            scheduleModel.findById.mockResolvedValue(mockSchedule);
            scheduleModel.findByIdAndUpdate.mockResolvedValue({ ...mockSchedule, priority: TaskPriority.HIGH });

            const result = await service.updateSchedule(
                'test-schedule-1',
                { taskType: TaskType.WATERING },
                mockEnvironmentalFactors
            );

            expect(result.priority).toBe(TaskPriority.HIGH);
            expect(notificationScheduler.scheduleMaintenanceReminder).toHaveBeenCalled();
        });

        it('should handle invalid schedule updates', async () => {
            scheduleModel.findById.mockResolvedValue(null);

            await expect(
                service.updateSchedule('invalid-id', { taskType: TaskType.WATERING }, mockEnvironmentalFactors)
            ).rejects.toThrow(SCHEDULE_ERRORS.INVALID_SCHEDULE_ID);
        });

        it('should invalidate cache after updates', async () => {
            scheduleModel.findById.mockResolvedValue(mockSchedule);
            scheduleModel.findByIdAndUpdate.mockResolvedValue(mockSchedule);

            await service.updateSchedule('test-schedule-1', { taskType: TaskType.WATERING }, mockEnvironmentalFactors);
            
            expect(cacheManager.del).toHaveBeenCalled();
        });
    });

    describe('Schedule Retrieval', () => {
        it('should retrieve filtered schedules', async () => {
            const filter = {
                startDate: new Date(),
                endDate: moment().add(7, 'days').toDate(),
                taskTypes: [TaskType.WATERING],
                completed: false
            };

            scheduleModel.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockSchedule])
            });

            const result = await service.getScheduleForGarden('test-garden-1', filter);
            
            expect(result).toHaveLength(1);
            expect(result[0].taskType).toBe(TaskType.WATERING);
        });

        it('should use cache for repeated retrievals', async () => {
            const cachedSchedules = [mockSchedule];
            cacheManager.get.mockResolvedValue(cachedSchedules);

            const result = await service.getScheduleForGarden('test-garden-1');
            
            expect(result).toEqual(cachedSchedules);
            expect(scheduleModel.find).not.toHaveBeenCalled();
        });

        it('should handle retrieval errors gracefully', async () => {
            scheduleModel.find.mockImplementation(() => {
                throw new Error('Database error');
            });

            await expect(
                service.getScheduleForGarden('test-garden-1')
            ).rejects.toThrow('Failed to retrieve garden schedule');
        });
    });

    describe('Batch Operations', () => {
        it('should process schedules in batches', async () => {
            const batchSchedules = Array(150).fill(mockSchedule);
            maintenanceCalculator.generateMaintenanceSchedule.mockResolvedValue(batchSchedules);

            await service.generateSchedule('test-garden-1', 7, mockEnvironmentalFactors);
            
            expect(scheduleModel.batchUpsert).toHaveBeenCalledTimes(2); // 150 items = 2 batches of 100
        });

        it('should handle batch notification scheduling', async () => {
            const batchSchedules = Array(50).fill(mockSchedule);
            maintenanceCalculator.generateMaintenanceSchedule.mockResolvedValue(batchSchedules);

            await service.generateSchedule('test-garden-1', 7, mockEnvironmentalFactors);
            
            expect(notificationScheduler.scheduleBatchNotifications).toHaveBeenCalledTimes(1);
        });

        it('should maintain performance with large batches', async () => {
            const startTime = now();
            const batchSchedules = Array(500).fill(mockSchedule);
            maintenanceCalculator.generateMaintenanceSchedule.mockResolvedValue(batchSchedules);

            await service.generateSchedule('test-garden-1', 7, mockEnvironmentalFactors);
            
            const executionTime = now() - startTime;
            expect(executionTime).toBeLessThan(5000); // Under 5 seconds for large batch
        });
    });
});