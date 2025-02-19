import { Injectable } from '@nestjs/common'; // ^8.0.0
import moment from 'moment'; // ^2.29.0
import { Cache } from 'cache-manager'; // ^3.4.0

import { ScheduleRepository } from '../repositories/schedule.repository';
import { MaintenanceCalculator } from './scheduling/maintenance-calculator.service';
import { NotificationSchedulerService } from './scheduling/notification-scheduler.service';
import { ISchedule, TaskType } from '../interfaces/schedule.interface';
import { SCHEDULE_ERRORS, SCHEDULE_LIMITS } from '../constants/schedule.constants';

interface EnvironmentalFactors {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
}

/**
 * Enhanced service for managing garden maintenance schedules
 * Implements caching, batch processing, and environmental factor considerations
 */
@Injectable()
export class ScheduleService {
    private readonly CACHE_TTL = 3600; // 1 hour in seconds
    private readonly CACHE_PREFIX = 'schedule:';

    constructor(
        private readonly scheduleRepository: ScheduleRepository,
        private readonly maintenanceCalculator: MaintenanceCalculator,
        private readonly notificationScheduler: NotificationSchedulerService,
        private readonly cacheManager: Cache
    ) {}

    /**
     * Creates a new maintenance schedule with environmental factor consideration
     * @param gardenId Unique identifier for the garden
     * @param daysAhead Number of days to schedule ahead
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<ISchedule[]> Array of created maintenance schedules
     */
    async createMaintenanceSchedule(
        gardenId: string,
        daysAhead: number,
        environmentalFactors: EnvironmentalFactors
    ): Promise<ISchedule[]> {
        try {
            // Validate input parameters
            if (!gardenId) {
                throw new Error(SCHEDULE_ERRORS.INVALID_GARDEN_ID);
            }

            if (daysAhead > SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS) {
                daysAhead = SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS;
            }

            // Check cache for existing schedule
            const cacheKey = `${this.CACHE_PREFIX}${gardenId}`;
            const cachedSchedule = await this.cacheManager.get<ISchedule[]>(cacheKey);

            if (cachedSchedule) {
                return cachedSchedule;
            }

            // Generate maintenance schedule with environmental factors
            const schedules = await this.maintenanceCalculator.generateMaintenanceSchedule(
                gardenId,
                daysAhead,
                environmentalFactors
            );

            // Batch create schedules in repository
            const createdSchedules = await this.batchCreateSchedules(schedules);

            // Schedule notifications for all maintenance tasks
            await this.scheduleNotifications(createdSchedules);

            // Cache the new schedule
            await this.cacheManager.set(cacheKey, createdSchedules, { ttl: this.CACHE_TTL });

            return createdSchedules;
        } catch (error) {
            console.error('Error creating maintenance schedule:', error);
            throw error;
        }
    }

    /**
     * Retrieves maintenance schedule with caching
     * @param gardenId Unique identifier for the garden
     * @returns Promise<ISchedule[]> Array of maintenance schedules
     */
    async getGardenSchedule(gardenId: string): Promise<ISchedule[]> {
        try {
            const cacheKey = `${this.CACHE_PREFIX}${gardenId}`;
            const cachedSchedule = await this.cacheManager.get<ISchedule[]>(cacheKey);

            if (cachedSchedule) {
                return this.sortSchedules(cachedSchedule);
            }

            const schedules = await this.scheduleRepository.getSchedulesByGardenId(gardenId);
            const sortedSchedules = this.sortSchedules(schedules);

            await this.cacheManager.set(cacheKey, sortedSchedules, { ttl: this.CACHE_TTL });

            return sortedSchedules;
        } catch (error) {
            console.error('Error retrieving garden schedule:', error);
            throw error;
        }
    }

    /**
     * Marks task completed and handles next schedule with environmental adjustments
     * @param scheduleId Unique identifier for the schedule
     * @param currentFactors Current environmental conditions
     * @returns Promise<ISchedule> Updated schedule
     */
    async markTaskCompleted(
        scheduleId: string,
        currentFactors: EnvironmentalFactors
    ): Promise<ISchedule> {
        try {
            const completedSchedule = await this.scheduleRepository.markTaskCompleted(scheduleId, {
                completedDate: new Date(),
                notes: `Completed with environmental factors: ${JSON.stringify(currentFactors)}`
            });

            // Calculate next maintenance date with environmental factors
            const nextDate = await this.maintenanceCalculator.calculateNextMaintenanceDate(
                completedSchedule.plantId,
                completedSchedule.taskType as TaskType,
                currentFactors
            );

            // Create next schedule
            const nextSchedule = await this.scheduleRepository.createSchedule({
                ...completedSchedule,
                id: undefined,
                completed: false,
                completedDate: null,
                dueDate: nextDate,
                environmentalFactors: currentFactors
            });

            // Schedule notification for next task
            await this.notificationScheduler.scheduleMaintenanceReminder({
                title: 'Maintenance Reminder',
                body: `Time for ${completedSchedule.taskType} in your garden`,
                type: 'MAINTENANCE_REMINDER',
                data: {
                    scheduleId: nextSchedule.id,
                    token: completedSchedule.gardenId // Using gardenId as device token for example
                },
                priority: 'high',
                gardenZone: completedSchedule.gardenId,
                plantType: completedSchedule.plantId,
                scheduledTime: nextDate
            });

            // Invalidate cache
            await this.cacheManager.del(`${this.CACHE_PREFIX}${completedSchedule.gardenId}`);

            return nextSchedule;
        } catch (error) {
            console.error('Error marking task completed:', error);
            throw error;
        }
    }

    /**
     * Creates schedules in batches for better performance
     * @param schedules Array of schedules to create
     * @returns Promise<ISchedule[]> Created schedules
     */
    private async batchCreateSchedules(schedules: Partial<ISchedule>[]): Promise<ISchedule[]> {
        const batchSize = 100;
        const createdSchedules: ISchedule[] = [];

        for (let i = 0; i < schedules.length; i += batchSize) {
            const batch = schedules.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(schedule => this.scheduleRepository.createSchedule(schedule))
            );
            createdSchedules.push(...batchResults);
        }

        return createdSchedules;
    }

    /**
     * Schedules notifications for maintenance tasks in batches
     * @param schedules Array of schedules requiring notifications
     */
    private async scheduleNotifications(schedules: ISchedule[]): Promise<void> {
        const notifications = schedules.map(schedule => ({
            title: 'Maintenance Reminder',
            body: `Time for ${schedule.taskType} in your garden`,
            type: 'MAINTENANCE_REMINDER',
            data: {
                scheduleId: schedule.id,
                token: schedule.gardenId // Using gardenId as device token for example
            },
            priority: 'high',
            gardenZone: schedule.gardenId,
            plantType: schedule.plantId,
            scheduledTime: schedule.dueDate
        }));

        await this.notificationScheduler.scheduleBatchNotifications(notifications, new Date());
    }

    /**
     * Sorts schedules by due date and priority
     * @param schedules Array of schedules to sort
     * @returns ISchedule[] Sorted schedules
     */
    private sortSchedules(schedules: ISchedule[]): ISchedule[] {
        return schedules.sort((a, b) => {
            const dateComparison = moment(a.dueDate).diff(moment(b.dueDate));
            if (dateComparison === 0) {
                return b.priority - a.priority;
            }
            return dateComparison;
        });
    }
}