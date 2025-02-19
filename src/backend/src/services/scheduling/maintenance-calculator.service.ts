import { Injectable } from '@nestjs/common';
import moment from 'moment';
import { ISchedule, TaskType } from '../../interfaces/schedule.interface';
import { Plant } from '../../models/plant.model';
import { TASK_INTERVALS, TASK_PRIORITIES, SCHEDULE_LIMITS, SCHEDULE_ERRORS } from '../../constants/schedule.constants';
import { GROWTH_STAGES } from '../../constants/plant.constants';

/**
 * Service responsible for calculating and generating maintenance schedules
 * with environmental factor considerations and performance optimizations
 * @version 1.0.0
 */
@Injectable()
export class MaintenanceCalculator {
    private readonly scheduleCache: Map<string, { 
        schedules: ISchedule[],
        timestamp: number,
        environmentalHash: string
    }>;
    private readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds

    constructor(private readonly plantModel: Plant) {
        this.scheduleCache = new Map();
        this.initializeCacheCleanup();
    }

    /**
     * Calculates the next maintenance date with environmental factor considerations
     * @param plantId Unique identifier of the plant
     * @param taskType Type of maintenance task
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<Date> Next optimized maintenance date
     */
    async calculateNextMaintenanceDate(
        plantId: string,
        taskType: TaskType,
        environmentalFactors: {
            temperature: number;
            humidity: number;
            rainfall: number;
            windSpeed: number;
        }
    ): Promise<Date> {
        const plant = await this.plantModel.findById(plantId);
        if (!plant) {
            throw new Error(SCHEDULE_ERRORS.INVALID_GARDEN_ID);
        }

        let nextDate: Date;
        const soilConditions = plant.soilConditions;

        switch (taskType) {
            case TaskType.WATERING:
                nextDate = plant.calculateNextWateringDate(environmentalFactors, soilConditions);
                break;
            case TaskType.FERTILIZING:
                nextDate = plant.calculateNextFertilizingDate(soilConditions, plant.growthStage);
                break;
            default:
                nextDate = this.calculateDefaultTaskDate(taskType, plant.plantedDate, environmentalFactors);
        }

        return this.adjustDateForEnvironmentalFactors(nextDate, environmentalFactors, taskType);
    }

    /**
     * Generates an optimized maintenance schedule with environmental considerations
     * @param plantId Unique identifier of the plant
     * @param daysAhead Number of days to schedule ahead
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<ISchedule[]> Optimized schedule array
     */
    async generateMaintenanceSchedule(
        plantId: string,
        daysAhead: number,
        environmentalFactors: {
            temperature: number;
            humidity: number;
            rainfall: number;
            windSpeed: number;
        }
    ): Promise<ISchedule[]> {
        if (daysAhead > SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS) {
            daysAhead = SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS;
        }

        const cacheKey = `${plantId}-${daysAhead}`;
        const environmentalHash = this.generateEnvironmentalHash(environmentalFactors);
        
        // Check cache for valid schedule
        const cachedSchedule = this.scheduleCache.get(cacheKey);
        if (this.isValidCache(cachedSchedule, environmentalHash)) {
            return cachedSchedule.schedules;
        }

        const plant = await this.plantModel.findById(plantId);
        if (!plant) {
            throw new Error(SCHEDULE_ERRORS.INVALID_GARDEN_ID);
        }

        const schedules: ISchedule[] = [];
        const taskTypes = Object.values(TaskType);

        // Generate schedules for each task type in parallel
        const schedulePromises = taskTypes.map(async taskType => {
            let currentDate = moment().startOf('day');
            const endDate = moment().add(daysAhead, 'days');

            while (currentDate.isBefore(endDate)) {
                const nextDate = await this.calculateNextMaintenanceDate(
                    plantId,
                    taskType,
                    environmentalFactors
                );

                if (moment(nextDate).isBefore(endDate)) {
                    schedules.push({
                        id: `${plantId}-${taskType}-${nextDate.getTime()}`,
                        gardenId: plantId,
                        plantId: plantId,
                        taskType: taskType,
                        dueDate: nextDate,
                        priority: this.calculateTaskPriority(taskType, nextDate, environmentalFactors),
                        completed: false,
                        completedDate: null,
                        environmentalFactors: environmentalFactors,
                        weather_dependent: this.isWeatherDependentTask(taskType)
                    } as ISchedule);

                    currentDate = moment(nextDate).add(TASK_INTERVALS[taskType], 'hours');
                } else {
                    break;
                }
            }
        });

        await Promise.all(schedulePromises);

        // Sort schedules by date and priority
        const sortedSchedules = this.sortAndOptimizeSchedules(schedules);

        // Cache the generated schedule
        this.scheduleCache.set(cacheKey, {
            schedules: sortedSchedules,
            timestamp: Date.now(),
            environmentalHash
        });

        return sortedSchedules;
    }

    /**
     * Calculates priority level with environmental and temporal factors
     * @param taskType Type of maintenance task
     * @param dueDate Due date of the task
     * @param environmentalFactors Current environmental conditions
     * @returns number Calculated priority level
     */
    private calculateTaskPriority(
        taskType: TaskType,
        dueDate: Date,
        environmentalFactors: {
            temperature: number;
            humidity: number;
            rainfall: number;
            windSpeed: number;
        }
    ): number {
        let priority = TASK_PRIORITIES[taskType];

        // Adjust priority based on environmental factors
        if (taskType === TaskType.WATERING) {
            if (environmentalFactors.temperature > 30) {
                priority += 1;
            }
            if (environmentalFactors.rainfall < 5) {
                priority += 1;
            }
        }

        // Adjust priority based on temporal urgency
        const daysUntilDue = moment(dueDate).diff(moment(), 'days');
        if (daysUntilDue <= 1) {
            priority += 1;
        }

        // Ensure priority stays within bounds
        return Math.max(1, Math.min(priority, 3));
    }

    private calculateDefaultTaskDate(taskType: TaskType, plantedDate: Date, environmentalFactors: any): Date {
        const baseInterval = TASK_INTERVALS[taskType];
        let adjustedInterval = baseInterval;

        // Adjust interval based on environmental factors
        if (environmentalFactors.temperature > 30 || environmentalFactors.humidity > 80) {
            adjustedInterval *= 0.8; // More frequent maintenance in challenging conditions
        }

        return moment(plantedDate).add(adjustedInterval, 'hours').toDate();
    }

    private adjustDateForEnvironmentalFactors(
        date: Date,
        environmentalFactors: any,
        taskType: TaskType
    ): Date {
        const adjustedDate = moment(date);

        // Avoid scheduling during adverse weather conditions
        if (this.isWeatherDependentTask(taskType)) {
            if (environmentalFactors.windSpeed > 20 || environmentalFactors.rainfall > 10) {
                adjustedDate.add(24, 'hours'); // Delay by 24 hours
            }
        }

        return adjustedDate.toDate();
    }

    private sortAndOptimizeSchedules(schedules: ISchedule[]): ISchedule[] {
        return schedules.sort((a, b) => {
            const dateComparison = a.dueDate.getTime() - b.dueDate.getTime();
            if (dateComparison === 0) {
                return b.priority - a.priority;
            }
            return dateComparison;
        });
    }

    private isWeatherDependentTask(taskType: TaskType): boolean {
        return [
            TaskType.WATERING,
            TaskType.FERTILIZING,
            TaskType.PRUNING
        ].includes(taskType);
    }

    private generateEnvironmentalHash(factors: any): string {
        return `${factors.temperature}-${factors.humidity}-${factors.rainfall}-${factors.windSpeed}`;
    }

    private isValidCache(
        cachedData: {
            schedules: ISchedule[],
            timestamp: number,
            environmentalHash: string
        } | undefined,
        currentEnvironmentalHash: string
    ): boolean {
        if (!cachedData) return false;
        
        const isExpired = Date.now() - cachedData.timestamp > this.CACHE_DURATION;
        const environmentalChanged = cachedData.environmentalHash !== currentEnvironmentalHash;
        
        return !isExpired && !environmentalChanged;
    }

    private initializeCacheCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.scheduleCache.entries()) {
                if (now - value.timestamp > this.CACHE_DURATION) {
                    this.scheduleCache.delete(key);
                }
            }
        }, this.CACHE_DURATION);
    }
}