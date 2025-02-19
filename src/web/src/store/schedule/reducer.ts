/**
 * @fileoverview Redux reducer for garden maintenance schedule state management
 * Handles schedule-related actions and state updates with enhanced sync capabilities
 * @version 1.0.0
 */

import { 
    ScheduleState, 
    ScheduleAction, 
    ScheduleActionTypes 
} from './types';

/**
 * Initial state for schedule management
 * Includes default values for schedules, loading state, error tracking, and preferences
 */
const initialState: ScheduleState = {
    schedules: [],
    loading: false,
    error: null,
    lastSync: null,
    preferences: {
        preferredTime: '09:00',
        notificationEnabled: true,
        emailNotifications: false,
        pushNotifications: true
    }
};

/**
 * Redux reducer for handling schedule state updates
 * Implements comprehensive error handling and sync tracking
 * 
 * @param state - Current schedule state, defaults to initial state if undefined
 * @param action - Schedule action to process
 * @returns Updated schedule state
 */
const scheduleReducer = (
    state: ScheduleState = initialState,
    action: ScheduleAction
): ScheduleState => {
    switch (action.type) {
        case ScheduleActionTypes.FETCH_SCHEDULES:
            return {
                ...state,
                schedules: action.payload,
                loading: false,
                error: null
            };

        case ScheduleActionTypes.CREATE_SCHEDULE:
            return {
                ...state,
                schedules: [...state.schedules, action.payload],
                error: null
            };

        case ScheduleActionTypes.UPDATE_SCHEDULE:
            return {
                ...state,
                schedules: state.schedules.map(schedule => 
                    schedule.id === action.payload.id
                        ? { ...schedule, ...action.payload.updates }
                        : schedule
                ),
                error: null
            };

        case ScheduleActionTypes.DELETE_SCHEDULE:
            return {
                ...state,
                schedules: state.schedules.filter(
                    schedule => schedule.id !== action.payload
                ),
                error: null
            };

        case ScheduleActionTypes.BATCH_UPDATE_SCHEDULES:
            return {
                ...state,
                schedules: state.schedules.map(schedule =>
                    action.payload.scheduleIds.includes(schedule.id)
                        ? { ...schedule, ...action.payload.updates }
                        : schedule
                ),
                error: null
            };

        case ScheduleActionTypes.SYNC_SCHEDULES:
            return {
                ...state,
                schedules: action.payload.schedules,
                lastSync: action.payload.timestamp,
                error: null
            };

        case ScheduleActionTypes.SET_SCHEDULE_LOADING:
            return {
                ...state,
                loading: action.payload
            };

        case ScheduleActionTypes.SET_SCHEDULE_ERROR:
            return {
                ...state,
                error: action.payload,
                loading: false
            };

        case ScheduleActionTypes.UPDATE_PREFERENCES:
            return {
                ...state,
                preferences: {
                    ...state.preferences,
                    ...action.payload
                },
                error: null
            };

        default:
            return state;
    }
};

export default scheduleReducer;