/**
 * @fileoverview Redux selectors for schedule state management with memoized computations
 * @version 1.0.0
 */

import { createSelector } from '@reduxjs/toolkit'; // ^1.9.0
import { RootState } from '../index';
import { Schedule } from '../../types/schedule.types';

/**
 * Base selector to access the schedule slice from root state
 * Provides type-safe access to schedule state
 */
export const selectScheduleState = (state: RootState) => state.schedule;

/**
 * Memoized selector to get all maintenance schedules
 * Provides cached access to the complete schedule array
 */
export const selectAllSchedules = createSelector(
    [selectScheduleState],
    (scheduleState) => scheduleState.schedules || []
);

/**
 * Memoized selector for upcoming maintenance schedules
 * Returns sorted array of incomplete future schedules
 */
export const selectUpcomingSchedules = createSelector(
    [selectAllSchedules],
    (schedules) => {
        const now = new Date();
        return schedules
            .filter(schedule => 
                !schedule.completed && 
                new Date(schedule.dueDate) >= now
            )
            .sort((a, b) => 
                new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            );
    }
);

/**
 * Memoized selector for completed maintenance schedules
 * Returns array of completed schedules
 */
export const selectCompletedSchedules = createSelector(
    [selectAllSchedules],
    (schedules) => schedules.filter(schedule => schedule.completed)
);

/**
 * Memoized selector for overdue maintenance schedules
 * Returns array of incomplete schedules past their due date
 */
export const selectOverdueSchedules = createSelector(
    [selectAllSchedules],
    (schedules) => {
        const now = new Date();
        return schedules
            .filter(schedule => 
                !schedule.completed && 
                new Date(schedule.dueDate) < now
            )
            .sort((a, b) => 
                new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
            );
    }
);

/**
 * Selector for schedule loading state
 * Returns current loading status
 */
export const selectScheduleLoading = createSelector(
    [selectScheduleState],
    (scheduleState) => scheduleState.loading
);

/**
 * Selector for schedule error state
 * Returns current error message if any
 */
export const selectScheduleError = createSelector(
    [selectScheduleState],
    (scheduleState) => scheduleState.error
);

/**
 * Selector for schedule notification preferences
 * Returns user's schedule preferences
 */
export const selectSchedulePreferences = createSelector(
    [selectScheduleState],
    (scheduleState) => scheduleState.preferences
);

/**
 * Memoized selector for schedules by task type
 * Returns filtered array of schedules matching the specified task type
 */
export const selectSchedulesByTaskType = createSelector(
    [selectAllSchedules, (_, taskType: string) => taskType],
    (schedules, taskType) => 
        schedules.filter(schedule => schedule.taskType === taskType)
);

/**
 * Memoized selector for high priority schedules
 * Returns array of schedules with priority 1 or 2
 */
export const selectHighPrioritySchedules = createSelector(
    [selectAllSchedules],
    (schedules) => 
        schedules.filter(schedule => schedule.priority <= 2)
            .sort((a, b) => a.priority - b.priority)
);

/**
 * Memoized selector for schedule statistics
 * Returns computed statistics about schedule completion and status
 */
export const selectScheduleStats = createSelector(
    [selectAllSchedules],
    (schedules) => {
        const total = schedules.length;
        const completed = schedules.filter(s => s.completed).length;
        const overdue = schedules.filter(s => 
            !s.completed && new Date(s.dueDate) < new Date()
        ).length;

        return {
            total,
            completed,
            overdue,
            completionRate: total > 0 ? (completed / total) * 100 : 0,
            overdueRate: total > 0 ? (overdue / total) * 100 : 0
        };
    }
);

/**
 * Memoized selector for last sync timestamp
 * Returns the timestamp of the last schedule synchronization
 */
export const selectLastSyncTimestamp = createSelector(
    [selectScheduleState],
    (scheduleState) => scheduleState.lastSync
);