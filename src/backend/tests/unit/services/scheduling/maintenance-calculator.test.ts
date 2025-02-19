import { MaintenanceCalculator } from '../../../../src/services/scheduling/maintenance-calculator.service';
import { TaskType } from '../../../../src/interfaces/schedule.interface';
import { TASK_INTERVALS, TASK_PRIORITIES, SCHEDULE_LIMITS } from '../../../../src/constants/schedule.constants';
import { GROWTH_STAGES } from '../../../../src/constants/plant.constants';
import moment from 'moment'; // v2.29.0
import { jest } from '@jest/globals'; // v27.0.0

describe('MaintenanceCalculator', () => {
    let maintenanceCalculator: MaintenanceCalculator;
    let mockPlant: any;
    let mockEnvironmentalFactors: any;

    beforeEach(() => {
        // Mock the Plant model
        mockPlant = {
            findById: jest.fn(),
            calculateNextWateringDate: jest.fn(),
            calculateNextFertilizingDate: jest.fn(),
            soilConditions: {
                moisture: 0.5,
                pH: 6.5,
                nutrients: {
                    nitrogen: 0.6,
                    phosphorus: 0.5,
                    potassium: 0.7
                }
            },
            plantedDate: new Date('2023-01-01'),
            growthStage: GROWTH_STAGES.GROWING
        };

        // Mock environmental factors
        mockEnvironmentalFactors = {
            temperature: 25,
            humidity: 60,
            rainfall: 0,
            windSpeed: 5
        };

        maintenanceCalculator = new MaintenanceCalculator(mockPlant);

        // Reset all mocks before each test
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('calculateNextMaintenanceDate', () => {
        it('should calculate next watering date with environmental factors', async () => {
            const plantId = 'test-plant-1';
            const expectedDate = new Date('2023-01-04');
            mockPlant.findById.mockResolvedValue(mockPlant);
            mockPlant.calculateNextWateringDate.mockReturnValue(expectedDate);

            const result = await maintenanceCalculator.calculateNextMaintenanceDate(
                plantId,
                TaskType.WATERING,
                mockEnvironmentalFactors
            );

            expect(result).toEqual(expectedDate);
            expect(mockPlant.findById).toHaveBeenCalledWith(plantId);
            expect(mockPlant.calculateNextWateringDate).toHaveBeenCalledWith(
                mockEnvironmentalFactors,
                mockPlant.soilConditions
            );
        });

        it('should calculate next fertilizing date based on growth stage', async () => {
            const plantId = 'test-plant-1';
            const expectedDate = new Date('2023-01-15');
            mockPlant.findById.mockResolvedValue(mockPlant);
            mockPlant.calculateNextFertilizingDate.mockReturnValue(expectedDate);

            const result = await maintenanceCalculator.calculateNextMaintenanceDate(
                plantId,
                TaskType.FERTILIZING,
                mockEnvironmentalFactors
            );

            expect(result).toEqual(expectedDate);
            expect(mockPlant.calculateNextFertilizingDate).toHaveBeenCalledWith(
                mockPlant.soilConditions,
                mockPlant.growthStage
            );
        });

        it('should throw error for invalid plant ID', async () => {
            mockPlant.findById.mockResolvedValue(null);

            await expect(maintenanceCalculator.calculateNextMaintenanceDate(
                'invalid-id',
                TaskType.WATERING,
                mockEnvironmentalFactors
            )).rejects.toThrow('Invalid garden ID provided');
        });

        it('should adjust dates for adverse weather conditions', async () => {
            const plantId = 'test-plant-1';
            mockPlant.findById.mockResolvedValue(mockPlant);
            const adverseWeather = {
                ...mockEnvironmentalFactors,
                windSpeed: 25,
                rainfall: 15
            };

            const result = await maintenanceCalculator.calculateNextMaintenanceDate(
                plantId,
                TaskType.WATERING,
                adverseWeather
            );

            expect(moment(result).isAfter(moment().add(23, 'hours'))).toBeTruthy();
        });
    });

    describe('generateMaintenanceSchedule', () => {
        it('should generate schedule within performance requirements', async () => {
            const plantId = 'test-plant-1';
            const daysAhead = 7;
            mockPlant.findById.mockResolvedValue(mockPlant);

            const startTime = performance.now();
            const schedule = await maintenanceCalculator.generateMaintenanceSchedule(
                plantId,
                daysAhead,
                mockEnvironmentalFactors
            );
            const endTime = performance.now();
            const executionTime = endTime - startTime;

            expect(executionTime).toBeLessThan(2000); // Under 2 seconds as per requirements
            expect(Array.isArray(schedule)).toBeTruthy();
            expect(schedule.length).toBeGreaterThan(0);
        });

        it('should respect maximum schedule days limit', async () => {
            const plantId = 'test-plant-1';
            mockPlant.findById.mockResolvedValue(mockPlant);

            const schedule = await maintenanceCalculator.generateMaintenanceSchedule(
                plantId,
                100, // Exceeds MAX_SCHEDULE_DAYS
                mockEnvironmentalFactors
            );

            const lastTaskDate = moment(schedule[schedule.length - 1].dueDate);
            const maxAllowedDate = moment().add(SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS, 'days');
            
            expect(lastTaskDate.isSameOrBefore(maxAllowedDate)).toBeTruthy();
        });

        it('should properly cache and return cached schedules', async () => {
            const plantId = 'test-plant-1';
            mockPlant.findById.mockResolvedValue(mockPlant);

            // First call - should generate new schedule
            const firstSchedule = await maintenanceCalculator.generateMaintenanceSchedule(
                plantId,
                7,
                mockEnvironmentalFactors
            );

            // Second call - should return cached schedule
            const secondSchedule = await maintenanceCalculator.generateMaintenanceSchedule(
                plantId,
                7,
                mockEnvironmentalFactors
            );

            expect(mockPlant.findById).toHaveBeenCalledTimes(1);
            expect(firstSchedule).toEqual(secondSchedule);
        });

        it('should regenerate schedule when environmental factors change', async () => {
            const plantId = 'test-plant-1';
            mockPlant.findById.mockResolvedValue(mockPlant);

            const firstSchedule = await maintenanceCalculator.generateMaintenanceSchedule(
                plantId,
                7,
                mockEnvironmentalFactors
            );

            const newEnvironmentalFactors = {
                ...mockEnvironmentalFactors,
                temperature: 35
            };

            const secondSchedule = await maintenanceCalculator.generateMaintenanceSchedule(
                plantId,
                7,
                newEnvironmentalFactors
            );

            expect(firstSchedule).not.toEqual(secondSchedule);
            expect(mockPlant.findById).toHaveBeenCalledTimes(2);
        });
    });

    describe('calculateTaskPriority', () => {
        it('should calculate correct priority levels for different tasks', () => {
            const dueDate = new Date();
            const priorities = Object.values(TaskType).map(taskType => ({
                taskType,
                priority: maintenanceCalculator['calculateTaskPriority'](
                    taskType,
                    dueDate,
                    mockEnvironmentalFactors
                )
            }));

            priorities.forEach(({ taskType, priority }) => {
                expect(priority).toBeGreaterThanOrEqual(1);
                expect(priority).toBeLessThanOrEqual(3);
                expect(priority).toBeGreaterThanOrEqual(TASK_PRIORITIES[taskType]);
            });
        });

        it('should increase priority for urgent tasks', () => {
            const urgentDate = moment().add(1, 'hours').toDate();
            const normalDate = moment().add(5, 'days').toDate();

            const urgentPriority = maintenanceCalculator['calculateTaskPriority'](
                TaskType.WATERING,
                urgentDate,
                mockEnvironmentalFactors
            );

            const normalPriority = maintenanceCalculator['calculateTaskPriority'](
                TaskType.WATERING,
                normalDate,
                mockEnvironmentalFactors
            );

            expect(urgentPriority).toBeGreaterThan(normalPriority);
        });

        it('should adjust priority based on environmental conditions', () => {
            const dueDate = new Date();
            const highTempFactors = {
                ...mockEnvironmentalFactors,
                temperature: 35,
                rainfall: 0
            };

            const normalPriority = maintenanceCalculator['calculateTaskPriority'](
                TaskType.WATERING,
                dueDate,
                mockEnvironmentalFactors
            );

            const highTempPriority = maintenanceCalculator['calculateTaskPriority'](
                TaskType.WATERING,
                dueDate,
                highTempFactors
            );

            expect(highTempPriority).toBeGreaterThan(normalPriority);
        });
    });
});