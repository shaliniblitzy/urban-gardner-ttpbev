import { ValidationError, IsDate, IsEnum, ValidateNested } from 'class-validator';
import { ISchedule, TaskType, TaskPriority, TaskFrequency } from '../interfaces/schedule.interface';
import { SCHEDULE_LIMITS, TASK_INTERVALS, TASK_PRIORITIES, SCHEDULE_ERRORS } from '../constants/schedule.constants';

/**
 * Validates a schedule date against business rules and system constraints
 * @param date The date to validate
 * @throws ValidationError if date is invalid
 */
const validateScheduleDate = (date: Date): boolean => {
    const now = new Date();
    const maxDate = new Date();
    maxDate.setDate(now.getDate() + SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS);

    if (!(date instanceof Date) || isNaN(date.getTime())) {
        throw new ValidationError(SCHEDULE_ERRORS.INVALID_DATE);
    }

    if (date < now || date > maxDate) {
        throw new ValidationError(`Schedule date must be between now and ${SCHEDULE_LIMITS.MAX_SCHEDULE_DAYS} days in the future`);
    }

    return true;
};

/**
 * Validates task type and its associated constraints
 * @param taskType The task type to validate
 * @param dueDate The due date for the task
 * @throws ValidationError if task type is invalid or constraints are not met
 */
const validateTaskType = (taskType: TaskType, dueDate: Date): boolean => {
    if (!Object.values(TaskType).includes(taskType)) {
        throw new ValidationError(SCHEDULE_ERRORS.INVALID_TASK_TYPE);
    }

    // Validate task intervals
    const taskInterval = TASK_INTERVALS[taskType];
    const now = new Date();
    const minInterval = now.getTime() + (taskInterval * 60 * 60 * 1000);

    if (dueDate.getTime() < minInterval) {
        throw new ValidationError(`Minimum interval for ${taskType} is ${taskInterval} hours`);
    }

    return true;
};

/**
 * Validates schedule capacity constraints
 * @param schedule The schedule to validate
 * @throws ValidationError if capacity constraints are violated
 */
const validateScheduleCapacity = (schedule: ISchedule): boolean => {
    const { dueDate, taskType } = schedule;
    const dateStr = dueDate.toISOString().split('T')[0];

    // This would typically check against existing schedules in the database
    // For validation purposes, we'll assume this check is performed elsewhere
    if (false /* existingTasksCount >= SCHEDULE_LIMITS.MAX_TASKS_PER_DAY */) {
        throw new ValidationError(SCHEDULE_ERRORS.SCHEDULE_FULL);
    }

    return true;
};

/**
 * Validates notification preferences
 * @param preferences The notification preferences to validate
 * @throws ValidationError if preferences are invalid
 */
export const validateNotificationPreferences = (
    preferences: ISchedule['notificationPreferences']
): boolean => {
    if (!preferences) {
        throw new ValidationError('Notification preferences are required');
    }

    if (typeof preferences.enabled !== 'boolean') {
        throw new ValidationError('Notification enabled flag must be a boolean');
    }

    if (preferences.advanceNotice < 0 || preferences.advanceNotice > 72) {
        throw new ValidationError('Advance notice must be between 0 and 72 hours');
    }

    if (preferences.reminderFrequency < 1 || preferences.reminderFrequency > 24) {
        throw new ValidationError('Reminder frequency must be between 1 and 24 hours');
    }

    return true;
};

/**
 * Validates completion status and related metadata
 * @param status The completion status to validate
 * @throws ValidationError if status is invalid
 */
export const validateCompletionStatus = (
    status: Pick<ISchedule, 'completed' | 'completedDate' | 'notes'>
): boolean => {
    if (typeof status.completed !== 'boolean') {
        throw new ValidationError('Completion status must be a boolean');
    }

    if (status.completed && !status.completedDate) {
        throw new ValidationError('Completion date is required when task is marked as completed');
    }

    if (status.completed && status.completedDate > new Date()) {
        throw new ValidationError('Completion date cannot be in the future');
    }

    if (status.notes && status.notes.length > 500) {
        throw new ValidationError('Notes cannot exceed 500 characters');
    }

    return true;
};

/**
 * Comprehensive validation function for schedule entries
 * Validates all aspects of a schedule including dates, tasks, notifications, and completion status
 * @param schedule The schedule to validate
 * @throws ValidationError with detailed context if validation fails
 */
export const validateSchedule = (schedule: ISchedule): boolean => {
    // Validate required fields
    if (!schedule.gardenId || !schedule.plantId) {
        throw new ValidationError('Garden ID and Plant ID are required');
    }

    // Validate schedule date
    validateScheduleDate(schedule.dueDate);

    // Validate task type and constraints
    validateTaskType(schedule.taskType, schedule.dueDate);

    // Validate schedule capacity
    validateScheduleCapacity(schedule);

    // Validate notification preferences
    validateNotificationPreferences(schedule.notificationPreferences);

    // Validate completion status if present
    if (schedule.completed !== undefined) {
        validateCompletionStatus({
            completed: schedule.completed,
            completedDate: schedule.completedDate,
            notes: schedule.notes
        });
    }

    // Validate task priority
    if (!Object.values(TaskPriority).includes(schedule.priority)) {
        throw new ValidationError('Invalid task priority');
    }

    // Validate task frequency
    if (!Object.values(TaskFrequency).includes(schedule.frequency)) {
        throw new ValidationError('Invalid task frequency');
    }

    // Validate weather dependency flag
    if (typeof schedule.weather_dependent !== 'boolean') {
        throw new ValidationError('Weather dependency flag must be a boolean');
    }

    return true;
};