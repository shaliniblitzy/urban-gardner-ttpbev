/**
 * @fileoverview Redux store types for garden maintenance schedule management
 * Defines types and interfaces for schedule state, actions, and action types
 * @version 1.0.0
 */

import { Schedule, SchedulePreferences } from '../../types/schedule.types';

/**
 * Interface defining the structure of schedule state in Redux store
 * Represents the complete state tree for schedule management
 */
export interface ScheduleState {
    /** Array of maintenance schedules */
    schedules: Schedule[];
    /** Loading state indicator */
    loading: boolean;
    /** Error message if any */
    error: string | null;
    /** User preferences for notifications and timing */
    preferences: SchedulePreferences;
    /** Timestamp of last synchronization */
    lastSync: Date;
}

/**
 * Enumeration of all possible schedule-related action types
 * Used for type safety in action creators and reducers
 */
export enum ScheduleActionTypes {
    FETCH_SCHEDULES = '@schedule/FETCH_SCHEDULES',
    CREATE_SCHEDULE = '@schedule/CREATE_SCHEDULE',
    UPDATE_SCHEDULE = '@schedule/UPDATE_SCHEDULE',
    DELETE_SCHEDULE = '@schedule/DELETE_SCHEDULE',
    SET_SCHEDULE_LOADING = '@schedule/SET_SCHEDULE_LOADING',
    SET_SCHEDULE_ERROR = '@schedule/SET_SCHEDULE_ERROR',
    UPDATE_PREFERENCES = '@schedule/UPDATE_PREFERENCES',
    SYNC_SCHEDULES = '@schedule/SYNC_SCHEDULES',
    BATCH_UPDATE_SCHEDULES = '@schedule/BATCH_UPDATE_SCHEDULES'
}

/**
 * Action interfaces for schedule operations
 * Define the structure of each possible action in the schedule module
 */
export interface FetchSchedulesAction {
    type: ScheduleActionTypes.FETCH_SCHEDULES;
    payload: Schedule[];
}

export interface CreateScheduleAction {
    type: ScheduleActionTypes.CREATE_SCHEDULE;
    payload: Schedule;
}

export interface UpdateScheduleAction {
    type: ScheduleActionTypes.UPDATE_SCHEDULE;
    payload: {
        id: string;
        updates: Partial<Schedule>;
    };
}

export interface DeleteScheduleAction {
    type: ScheduleActionTypes.DELETE_SCHEDULE;
    payload: string; // schedule id
}

export interface SetScheduleLoadingAction {
    type: ScheduleActionTypes.SET_SCHEDULE_LOADING;
    payload: boolean;
}

export interface SetScheduleErrorAction {
    type: ScheduleActionTypes.SET_SCHEDULE_ERROR;
    payload: string | null;
}

export interface UpdatePreferencesAction {
    type: ScheduleActionTypes.UPDATE_PREFERENCES;
    payload: Partial<SchedulePreferences>;
}

export interface SyncSchedulesAction {
    type: ScheduleActionTypes.SYNC_SCHEDULES;
    payload: {
        schedules: Schedule[];
        timestamp: Date;
    };
}

export interface BatchUpdateSchedulesAction {
    type: ScheduleActionTypes.BATCH_UPDATE_SCHEDULES;
    payload: {
        scheduleIds: string[];
        updates: Partial<Schedule>;
    };
}

/**
 * Union type of all possible schedule actions
 * Used for type safety in reducers and middleware
 */
export type ScheduleAction =
    | FetchSchedulesAction
    | CreateScheduleAction
    | UpdateScheduleAction
    | DeleteScheduleAction
    | SetScheduleLoadingAction
    | SetScheduleErrorAction
    | UpdatePreferencesAction
    | SyncSchedulesAction
    | BatchUpdateSchedulesAction;