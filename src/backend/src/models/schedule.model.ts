// mongoose version: ^6.0.0
import mongoose, { Schema, Model } from 'mongoose';
import { ISchedule, TaskType, TaskFrequency, TaskPriority, IScheduleDocument } from '../interfaces/schedule.interface';
import { SCHEDULE_LIMITS, TASK_PRIORITIES, SCHEDULE_DEFAULTS, TASK_INTERVALS, SCHEDULE_ERRORS } from '../constants/schedule.constants';

/**
 * Interface for schedule instance methods
 */
interface ScheduleMethods {
    updateNotificationPreferences(preferences: NotificationPreferences): Promise<void>;
    markAsCompleted(details: CompletionDetails): Promise<void>;
    rescheduleTask(newDate: Date): Promise<void>;
}

/**
 * Interface for schedule model statics
 */
interface ScheduleModel extends Model<ISchedule, {}, ScheduleMethods> {
    findByGardenId(gardenId: string): Promise<IScheduleDocument[]>;
    findPendingTasks(date: Date): Promise<IScheduleDocument[]>;
    createSchedule(scheduleData: Partial<ISchedule>): Promise<IScheduleDocument>;
}

/**
 * Mongoose schema for garden maintenance schedules with performance optimizations
 */
const scheduleSchema = new Schema<ISchedule, ScheduleModel, ScheduleMethods>({
    gardenId: {
        type: String,
        required: true,
        index: true // Optimized querying by garden
    },
    plantId: {
        type: String,
        required: true,
        index: true // Optimized plant-specific queries
    },
    taskType: {
        type: String,
        enum: Object.values(TaskType),
        required: true,
        validate: {
            validator: validateTaskType,
            message: SCHEDULE_ERRORS.INVALID_TASK_TYPE
        }
    },
    frequency: {
        type: String,
        enum: Object.values(TaskFrequency),
        required: true
    },
    dueDate: {
        type: Date,
        required: true,
        index: true // Optimized date-based queries
    },
    completed: {
        type: Boolean,
        default: false,
        index: true // Optimized completion status queries
    },
    completedDate: {
        type: Date,
        default: null
    },
    priority: {
        type: Number,
        enum: Object.values(TaskPriority),
        required: true
    },
    notificationPreferences: {
        enabled: {
            type: Boolean,
            default: SCHEDULE_DEFAULTS.NOTIFICATION_ENABLED
        },
        advanceNotice: {
            type: Number,
            default: 24, // 24 hours
            min: 1,
            max: 72
        },
        reminderFrequency: {
            type: Number,
            default: SCHEDULE_DEFAULTS.DEFAULT_REMINDER_INTERVAL,
            min: 1,
            max: 24
        }
    },
    notificationHistory: [{
        sentAt: {
            type: Date,
            required: true
        },
        acknowledged: {
            type: Boolean,
            default: false
        }
    }],
    notes: {
        type: String,
        maxlength: 1000
    },
    weather_dependent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    collection: 'schedules',
    // Performance optimizations
    minimize: true,
    strict: true,
    useNestedStrict: true
});

/**
 * Compound indexes for optimized querying
 */
scheduleSchema.index({ gardenId: 1, dueDate: 1 }); // Optimize garden schedule queries
scheduleSchema.index({ completed: 1, dueDate: 1 }); // Optimize pending task queries
scheduleSchema.index({ 'notificationPreferences.enabled': 1, dueDate: 1 }); // Optimize notification queries

/**
 * Validates task type and its configuration
 */
function validateTaskType(taskType: TaskType): boolean {
    return Object.values(TaskType).includes(taskType) && 
           TASK_PRIORITIES.hasOwnProperty(taskType) &&
           TASK_INTERVALS.hasOwnProperty(taskType);
}

/**
 * Calculates the next schedule date based on task frequency and history
 */
function calculateNextSchedule(taskType: TaskType, lastSchedule: Date): Date {
    const interval = TASK_INTERVALS[taskType];
    const nextDate = new Date(lastSchedule);
    nextDate.setHours(nextDate.getHours() + interval);
    return nextDate;
}

/**
 * Instance methods
 */
scheduleSchema.methods.updateNotificationPreferences = async function(
    preferences: NotificationPreferences
): Promise<void> {
    this.notificationPreferences = {
        ...this.notificationPreferences,
        ...preferences
    };
    await this.save();
};

scheduleSchema.methods.markAsCompleted = async function(
    details: CompletionDetails
): Promise<void> {
    this.completed = true;
    this.completedDate = new Date();
    if (details.notes) {
        this.notes = details.notes;
    }
    await this.save();
};

scheduleSchema.methods.rescheduleTask = async function(
    newDate: Date
): Promise<void> {
    if (newDate <= new Date()) {
        throw new Error(SCHEDULE_ERRORS.INVALID_DATE);
    }
    this.dueDate = newDate;
    await this.save();
};

/**
 * Static methods
 */
scheduleSchema.statics.findByGardenId = async function(
    gardenId: string
): Promise<IScheduleDocument[]> {
    return this.find({ gardenId })
               .sort({ dueDate: 1 })
               .lean()
               .exec();
};

scheduleSchema.statics.findPendingTasks = async function(
    date: Date = new Date()
): Promise<IScheduleDocument[]> {
    return this.find({
        completed: false,
        dueDate: { $lte: date }
    })
    .sort({ priority: -1, dueDate: 1 })
    .lean()
    .exec();
};

scheduleSchema.statics.createSchedule = async function(
    scheduleData: Partial<ISchedule>
): Promise<IScheduleDocument> {
    const existingTasksCount = await this.countDocuments({
        gardenId: scheduleData.gardenId,
        dueDate: {
            $gte: new Date(scheduleData.dueDate).setHours(0, 0, 0, 0),
            $lt: new Date(scheduleData.dueDate).setHours(23, 59, 59, 999)
        }
    });

    if (existingTasksCount >= SCHEDULE_LIMITS.MAX_TASKS_PER_DAY) {
        throw new Error(SCHEDULE_ERRORS.SCHEDULE_FULL);
    }

    return this.create(scheduleData);
};

// Pre-save middleware for validation and data normalization
scheduleSchema.pre('save', function(next) {
    if (this.isNew) {
        this.priority = TASK_PRIORITIES[this.taskType] || TaskPriority.LOW;
    }
    next();
});

// Create and export the Schedule model
export const Schedule = mongoose.model<ISchedule, ScheduleModel>('Schedule', scheduleSchema);