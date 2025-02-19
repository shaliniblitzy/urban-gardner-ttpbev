import { Injectable } from '@nestjs/common';
import { Cache } from '@nestjs/common';
import moment from 'moment';
import { ISchedule } from '../../interfaces/schedule.interface';
import { MaintenanceCalculator } from './maintenance-calculator.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { Schedule } from '../../models/schedule.model';
import { SCHEDULE_LIMITS, SCHEDULE_ERRORS } from '../../constants/schedule.constants';

/**
 * Service responsible for generating and managing garden maintenance schedules
 * Implements optimized scheduling with environmental factor consideration
 * @version 1.0.0
 */
@Injectable()
export class ScheduleGeneratorService {
    private readonly CACHE_TTL_SECONDS = 3600; // 1 hour cache duration
    private readonly BATCH_SIZE = 100; // Maximum batch size for schedule processing

    constructor(
        private readonly maintenanceCalculator: MaintenanceCalculator,
        private readonly notificationScheduler: NotificationSchedulerService,
        private readonly scheduleModel: Schedule,
        private readonly cacheManager: Cache
    ) {}

    /**
     * Generates an optimized maintenance schedule for a garden
     * @param gardenId Unique identifier of the garden
     * @param daysAhead Number of days to schedule ahead
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<ISchedule[]> Generated maintenance schedule
     */
    async generateSchedule(
        gardenId: string,
        daysAhead: number,
        environmentalFactors: {
            temperature: number;
            humidity: number;
            rainfall: number;
            windSpeed: number;
        }
    ): Promise<ISchedule[]> {
        // Check cache for existing schedule
        const cacheKey = `schedule_${gardenId}_${daysAhead}`;
        const cachedSchedule = await this.cacheManager.get<ISchedule[]>(cacheKey);
        
        if (cachedSchedule) {
            return cachedSchedule;
        }

        // Validate input parameters
        if (daysAhead > SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS) {
            daysAhead = SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS;
        }

        try {
            // Generate maintenance schedules with environmental factors
            const schedules = await this.maintenanceCalculator.generateMaintenanceSchedule(
                gardenId,
                daysAhead,
                environmentalFactors
            );

            // Process schedules in batches for optimal performance
            const scheduleBatches = this.createBatches(schedules);
            const processedSchedules: ISchedule[] = [];

            for (const batch of scheduleBatches) {
                // Calculate priorities with environmental consideration
                const prioritizedBatch = batch.map(schedule => ({
                    ...schedule,
                    priority: this.maintenanceCalculator.calculateTaskPriority(
                        schedule.taskType,
                        schedule.dueDate,
                        environmentalFactors
                    )
                }));

                // Batch save to database
                await this.scheduleModel.batchUpsert(prioritizedBatch);

                // Schedule notifications in batches
                await this.notificationScheduler.scheduleBatchNotifications(
                    this.createNotificationPayloads(prioritizedBatch),
                    moment().toDate()
                );

                processedSchedules.push(...prioritizedBatch);
            }

            // Cache the generated schedule
            await this.cacheManager.set(
                cacheKey,
                processedSchedules,
                this.CACHE_TTL_SECONDS
            );

            return processedSchedules;
        } catch (error) {
            throw new Error(`Schedule generation failed: ${error.message}`);
        }
    }

    /**
     * Updates an existing maintenance schedule with new parameters
     * @param scheduleId Unique identifier of the schedule
     * @param updatedSchedule Updated schedule data
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<ISchedule> Updated schedule
     */
    async updateSchedule(
        scheduleId: string,
        updatedSchedule: Partial<ISchedule>,
        environmentalFactors: {
            temperature: number;
            humidity: number;
            rainfall: number;
            windSpeed: number;
        }
    ): Promise<ISchedule> {
        try {
            // Validate schedule existence
            const existingSchedule = await this.scheduleModel.findById(scheduleId);
            if (!existingSchedule) {
                throw new Error(SCHEDULE_ERRORS.INVALID_SCHEDULE_ID);
            }

            // Calculate environmental impact
            const environmentalImpact = this.maintenanceCalculator.calculateEnvironmentalImpact(
                updatedSchedule.taskType,
                environmentalFactors
            );

            // Update schedule with new data and environmental considerations
            const schedule = await this.scheduleModel.findByIdAndUpdate(
                scheduleId,
                {
                    ...updatedSchedule,
                    environmentalFactors,
                    priority: this.maintenanceCalculator.calculateTaskPriority(
                        updatedSchedule.taskType,
                        updatedSchedule.dueDate,
                        environmentalFactors
                    )
                },
                { new: true }
            );

            // Update notifications with retry mechanism
            await this.notificationScheduler.scheduleMaintenanceReminder({
                title: `Updated: ${schedule.taskType} Task`,
                body: `Task rescheduled for ${moment(schedule.dueDate).format('MMMM Do YYYY, h:mm a')}`,
                type: 'MAINTENANCE_REMINDER',
                data: {
                    scheduleId: schedule.id,
                    gardenId: schedule.gardenId
                },
                priority: 'high',
                gardenZone: schedule.gardenZone,
                plantType: schedule.plantType,
                scheduledTime: schedule.dueDate
            });

            // Invalidate related cache
            await this.invalidateScheduleCache(schedule.gardenId);

            return schedule;
        } catch (error) {
            throw new Error(`Schedule update failed: ${error.message}`);
        }
    }

    /**
     * Retrieves the maintenance schedule for a specific garden
     * @param gardenId Unique identifier of the garden
     * @param filter Optional filter criteria
     * @returns Promise<ISchedule[]> Filtered garden schedule
     */
    async getScheduleForGarden(
        gardenId: string,
        filter?: {
            startDate?: Date;
            endDate?: Date;
            taskTypes?: string[];
            completed?: boolean;
        }
    ): Promise<ISchedule[]> {
        const cacheKey = `garden_schedule_${gardenId}_${JSON.stringify(filter)}`;
        const cachedSchedule = await this.cacheManager.get<ISchedule[]>(cacheKey);

        if (cachedSchedule) {
            return cachedSchedule;
        }

        try {
            const query: any = { gardenId };

            // Apply filters if provided
            if (filter) {
                if (filter.startDate || filter.endDate) {
                    query.dueDate = {};
                    if (filter.startDate) query.dueDate.$gte = filter.startDate;
                    if (filter.endDate) query.dueDate.$lte = filter.endDate;
                }
                if (filter.taskTypes) query.taskType = { $in: filter.taskTypes };
                if (filter.completed !== undefined) query.completed = filter.completed;
            }

            const schedules = await this.scheduleModel
                .find(query)
                .sort({ dueDate: 1, priority: -1 })
                .lean()
                .exec();

            await this.cacheManager.set(
                cacheKey,
                schedules,
                this.CACHE_TTL_SECONDS
            );

            return schedules;
        } catch (error) {
            throw new Error(`Failed to retrieve garden schedule: ${error.message}`);
        }
    }

    /**
     * Creates batches of schedules for efficient processing
     * @param schedules Array of schedules to batch
     * @returns Array of schedule batches
     */
    private createBatches(schedules: ISchedule[]): ISchedule[][] {
        const batches: ISchedule[][] = [];
        for (let i = 0; i < schedules.length; i += this.BATCH_SIZE) {
            batches.push(schedules.slice(i, i + this.BATCH_SIZE));
        }
        return batches;
    }

    /**
     * Creates notification payloads from schedules
     * @param schedules Array of schedules requiring notifications
     * @returns Array of notification payloads
     */
    private createNotificationPayloads(schedules: ISchedule[]): any[] {
        return schedules.map(schedule => ({
            title: `${schedule.taskType} Required`,
            body: `Maintenance task scheduled for ${moment(schedule.dueDate).format('MMMM Do YYYY, h:mm a')}`,
            type: 'MAINTENANCE_REMINDER',
            data: {
                scheduleId: schedule.id,
                gardenId: schedule.gardenId
            },
            priority: schedule.priority === 3 ? 'high' : 'normal',
            gardenZone: schedule.gardenZone,
            plantType: schedule.plantType,
            scheduledTime: schedule.dueDate
        }));
    }

    /**
     * Invalidates cache entries related to a garden's schedule
     * @param gardenId Unique identifier of the garden
     */
    private async invalidateScheduleCache(gardenId: string): Promise<void> {
        const cacheKeys = [
            `schedule_${gardenId}_*`,
            `garden_schedule_${gardenId}_*`
        ];
        
        await Promise.all(
            cacheKeys.map(key => this.cacheManager.del(key))
        );
    }
}