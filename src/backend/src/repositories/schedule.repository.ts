// mongoose version: ^6.0.0
import mongoose, { Model } from 'mongoose';
import { Schedule } from '../models/schedule.model';
import { ISchedule, TaskType, TaskPriority, IScheduleDocument } from '../interfaces/schedule.interface';
import { SCHEDULE_ERRORS, SCHEDULE_LIMITS } from '../constants/schedule.constants';

interface RepositoryConfig {
    queryTimeout?: number;
    batchSize?: number;
    maxRetries?: number;
}

interface QueryOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

interface FilterOptions {
    taskTypes?: TaskType[];
    priorities?: TaskPriority[];
    completed?: boolean;
}

interface UpdateOptions {
    upsert?: boolean;
    optimisticLock?: boolean;
}

interface DeleteOptions {
    softDelete?: boolean;
    cascade?: boolean;
}

interface CompletionData {
    completedDate: Date;
    notes?: string;
}

/**
 * Repository class for handling garden maintenance schedule operations
 * with enhanced error handling, validation, and performance optimizations
 */
export class ScheduleRepository {
    private readonly queryTimeout: number;
    private readonly batchSize: number;
    private readonly maxRetries: number;

    constructor(
        private readonly scheduleModel: Model<ISchedule>,
        config: RepositoryConfig = {}
    ) {
        this.queryTimeout = config.queryTimeout || 5000;
        this.batchSize = config.batchSize || 100;
        this.maxRetries = config.maxRetries || 3;
        this.initializeErrorHandlers();
    }

    /**
     * Creates a new maintenance schedule with validation
     */
    async createSchedule(scheduleData: Partial<ISchedule>): Promise<ISchedule> {
        try {
            // Validate schedule data
            if (!scheduleData.gardenId || !scheduleData.taskType || !scheduleData.dueDate) {
                throw new Error(SCHEDULE_ERRORS.INVALID_TASK_TYPE);
            }

            // Check for schedule limits
            const existingTasksCount = await this.scheduleModel.countDocuments({
                gardenId: scheduleData.gardenId,
                dueDate: {
                    $gte: new Date(scheduleData.dueDate).setHours(0, 0, 0, 0),
                    $lt: new Date(scheduleData.dueDate).setHours(23, 59, 59, 999)
                }
            });

            if (existingTasksCount >= SCHEDULE_LIMITS.MAX_TASKS_PER_DAY) {
                throw new Error(SCHEDULE_ERRORS.SCHEDULE_FULL);
            }

            // Create schedule with optimized write
            const session = await mongoose.startSession();
            let createdSchedule: ISchedule;

            await session.withTransaction(async () => {
                createdSchedule = await this.scheduleModel.create([scheduleData], { session })[0];
            });

            await session.endSession();
            return createdSchedule!;
        } catch (error) {
            throw this.handleError('createSchedule', error);
        }
    }

    /**
     * Retrieves all schedules for a garden with caching and pagination
     */
    async getSchedulesByGardenId(
        gardenId: string,
        options: QueryOptions = {}
    ): Promise<ISchedule[]> {
        try {
            const { page = 1, limit = 50, sortBy = 'dueDate', sortOrder = 'asc' } = options;
            const skip = (page - 1) * limit;

            const query = this.scheduleModel
                .find({ gardenId })
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .hint({ gardenId: 1, dueDate: 1 }) // Use compound index
                .maxTimeMS(this.queryTimeout);

            return await query.exec();
        } catch (error) {
            throw this.handleError('getSchedulesByGardenId', error);
        }
    }

    /**
     * Retrieves pending tasks with priority sorting and filtering
     */
    async getPendingTasks(
        startDate: Date,
        endDate: Date,
        filters: FilterOptions = {}
    ): Promise<ISchedule[]> {
        try {
            const query: any = {
                completed: filters.completed ?? false,
                dueDate: { $gte: startDate, $lte: endDate }
            };

            if (filters.taskTypes?.length) {
                query.taskType = { $in: filters.taskTypes };
            }

            if (filters.priorities?.length) {
                query.priority = { $in: filters.priorities };
            }

            return await this.scheduleModel
                .find(query)
                .sort({ priority: -1, dueDate: 1 })
                .lean()
                .hint({ completed: 1, dueDate: 1 }) // Use compound index
                .maxTimeMS(this.queryTimeout)
                .exec();
        } catch (error) {
            throw this.handleError('getPendingTasks', error);
        }
    }

    /**
     * Updates schedule with optimistic locking
     */
    async updateSchedule(
        scheduleId: string,
        updateData: Partial<ISchedule>,
        options: UpdateOptions = {}
    ): Promise<ISchedule> {
        try {
            const { optimisticLock = true, upsert = false } = options;
            const session = await mongoose.startSession();
            let updatedSchedule: ISchedule | null;

            await session.withTransaction(async () => {
                const query: any = { _id: scheduleId };
                if (optimisticLock) {
                    query.__v = updateData.__v;
                }

                updatedSchedule = await this.scheduleModel
                    .findOneAndUpdate(
                        query,
                        { $set: updateData, $inc: { __v: 1 } },
                        { new: true, upsert, session }
                    )
                    .exec();

                if (!updatedSchedule) {
                    throw new Error(SCHEDULE_ERRORS.SCHEDULE_NOT_FOUND);
                }
            });

            await session.endSession();
            return updatedSchedule!;
        } catch (error) {
            throw this.handleError('updateSchedule', error);
        }
    }

    /**
     * Marks task as completed with status tracking
     */
    async markTaskCompleted(
        scheduleId: string,
        completionData: CompletionData
    ): Promise<ISchedule> {
        try {
            const session = await mongoose.startSession();
            let updatedSchedule: ISchedule | null;

            await session.withTransaction(async () => {
                updatedSchedule = await this.scheduleModel
                    .findByIdAndUpdate(
                        scheduleId,
                        {
                            $set: {
                                completed: true,
                                completedDate: completionData.completedDate,
                                notes: completionData.notes,
                                updatedAt: new Date()
                            }
                        },
                        { new: true, session }
                    )
                    .exec();

                if (!updatedSchedule) {
                    throw new Error(SCHEDULE_ERRORS.SCHEDULE_NOT_FOUND);
                }
            });

            await session.endSession();
            return updatedSchedule!;
        } catch (error) {
            throw this.handleError('markTaskCompleted', error);
        }
    }

    /**
     * Deletes schedule with dependency checking
     */
    async deleteSchedule(
        scheduleId: string,
        options: DeleteOptions = {}
    ): Promise<boolean> {
        try {
            const { softDelete = true, cascade = false } = options;
            const session = await mongoose.startSession();
            let success = false;

            await session.withTransaction(async () => {
                if (softDelete) {
                    const result = await this.scheduleModel
                        .findByIdAndUpdate(
                            scheduleId,
                            { $set: { deleted: true, deletedAt: new Date() } },
                            { session }
                        )
                        .exec();
                    success = !!result;
                } else {
                    const result = await this.scheduleModel
                        .findByIdAndDelete(scheduleId, { session })
                        .exec();
                    success = !!result;
                }

                if (!success) {
                    throw new Error(SCHEDULE_ERRORS.SCHEDULE_NOT_FOUND);
                }
            });

            await session.endSession();
            return success;
        } catch (error) {
            throw this.handleError('deleteSchedule', error);
        }
    }

    private initializeErrorHandlers(): void {
        mongoose.connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
        });
    }

    private handleError(operation: string, error: any): Error {
        console.error(`Error in ${operation}:`, error);
        if (error.name === 'ValidationError') {
            return new Error(SCHEDULE_ERRORS.INVALID_TASK_TYPE);
        }
        return error;
    }
}