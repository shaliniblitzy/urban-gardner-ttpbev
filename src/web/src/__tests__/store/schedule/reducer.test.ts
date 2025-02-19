import scheduleReducer from '../../../store/schedule/reducer';
import { ScheduleState, ScheduleActionTypes } from '../../../store/schedule/types';
import { TaskType } from '../../../types/schedule.types';

describe('scheduleReducer', () => {
    // Initial test state setup
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

    // Mock data for testing
    const mockSchedule = {
        id: 'test-schedule-1',
        gardenId: 'garden-1',
        taskType: TaskType.WATERING,
        dueDate: new Date('2024-01-01T09:00:00.000Z'),
        completed: false,
        priority: 1,
        notificationSent: false
    };

    it('should return initial state', () => {
        expect(scheduleReducer(undefined, { type: '@@INIT' } as any)).toEqual(initialState);
    });

    it('should handle FETCH_SCHEDULES', () => {
        const schedules = [mockSchedule];
        const action = {
            type: ScheduleActionTypes.FETCH_SCHEDULES,
            payload: schedules
        };

        const newState = scheduleReducer(initialState, action);
        expect(newState.schedules).toEqual(schedules);
        expect(newState.loading).toBeFalsy();
        expect(newState.error).toBeNull();
    });

    it('should handle CREATE_SCHEDULE', () => {
        const action = {
            type: ScheduleActionTypes.CREATE_SCHEDULE,
            payload: mockSchedule
        };

        const newState = scheduleReducer(initialState, action);
        expect(newState.schedules).toHaveLength(1);
        expect(newState.schedules[0]).toEqual(mockSchedule);
        expect(newState.error).toBeNull();
    });

    it('should handle UPDATE_SCHEDULE', () => {
        const stateWithSchedule = {
            ...initialState,
            schedules: [mockSchedule]
        };

        const updates = {
            completed: true,
            notificationSent: true
        };

        const action = {
            type: ScheduleActionTypes.UPDATE_SCHEDULE,
            payload: {
                id: mockSchedule.id,
                updates
            }
        };

        const newState = scheduleReducer(stateWithSchedule, action);
        expect(newState.schedules[0].completed).toBeTruthy();
        expect(newState.schedules[0].notificationSent).toBeTruthy();
        expect(newState.error).toBeNull();
    });

    it('should handle DELETE_SCHEDULE', () => {
        const stateWithSchedule = {
            ...initialState,
            schedules: [mockSchedule]
        };

        const action = {
            type: ScheduleActionTypes.DELETE_SCHEDULE,
            payload: mockSchedule.id
        };

        const newState = scheduleReducer(stateWithSchedule, action);
        expect(newState.schedules).toHaveLength(0);
        expect(newState.error).toBeNull();
    });

    it('should handle BATCH_UPDATE_SCHEDULES', () => {
        const schedules = [
            mockSchedule,
            { ...mockSchedule, id: 'test-schedule-2' }
        ];

        const stateWithSchedules = {
            ...initialState,
            schedules
        };

        const updates = {
            completed: true,
            priority: 2
        };

        const action = {
            type: ScheduleActionTypes.BATCH_UPDATE_SCHEDULES,
            payload: {
                scheduleIds: [mockSchedule.id, 'test-schedule-2'],
                updates
            }
        };

        const newState = scheduleReducer(stateWithSchedules, action);
        expect(newState.schedules).toHaveLength(2);
        expect(newState.schedules.every(s => s.completed)).toBeTruthy();
        expect(newState.schedules.every(s => s.priority === 2)).toBeTruthy();
    });

    it('should handle SYNC_SCHEDULES', () => {
        const syncTimestamp = new Date();
        const newSchedules = [mockSchedule];

        const action = {
            type: ScheduleActionTypes.SYNC_SCHEDULES,
            payload: {
                schedules: newSchedules,
                timestamp: syncTimestamp
            }
        };

        const newState = scheduleReducer(initialState, action);
        expect(newState.schedules).toEqual(newSchedules);
        expect(newState.lastSync).toEqual(syncTimestamp);
        expect(newState.error).toBeNull();
    });

    it('should handle SET_SCHEDULE_LOADING', () => {
        const action = {
            type: ScheduleActionTypes.SET_SCHEDULE_LOADING,
            payload: true
        };

        const newState = scheduleReducer(initialState, action);
        expect(newState.loading).toBeTruthy();
    });

    it('should handle SET_SCHEDULE_ERROR', () => {
        const error = 'Test error message';
        const action = {
            type: ScheduleActionTypes.SET_SCHEDULE_ERROR,
            payload: error
        };

        const newState = scheduleReducer(initialState, action);
        expect(newState.error).toEqual(error);
        expect(newState.loading).toBeFalsy();
    });

    it('should handle UPDATE_PREFERENCES', () => {
        const newPreferences = {
            preferredTime: '10:00',
            emailNotifications: true
        };

        const action = {
            type: ScheduleActionTypes.UPDATE_PREFERENCES,
            payload: newPreferences
        };

        const newState = scheduleReducer(initialState, action);
        expect(newState.preferences.preferredTime).toEqual('10:00');
        expect(newState.preferences.emailNotifications).toBeTruthy();
        expect(newState.preferences.notificationEnabled).toBeTruthy();
        expect(newState.preferences.pushNotifications).toBeTruthy();
        expect(newState.error).toBeNull();
    });

    it('should handle unknown action type', () => {
        const action = {
            type: 'UNKNOWN_ACTION',
            payload: {}
        };

        const newState = scheduleReducer(initialState, action as any);
        expect(newState).toEqual(initialState);
    });

    it('should preserve unrelated state properties when updating', () => {
        const stateWithData = {
            ...initialState,
            schedules: [mockSchedule],
            lastSync: new Date()
        };

        const action = {
            type: ScheduleActionTypes.SET_SCHEDULE_LOADING,
            payload: true
        };

        const newState = scheduleReducer(stateWithData, action);
        expect(newState.schedules).toEqual(stateWithData.schedules);
        expect(newState.lastSync).toEqual(stateWithData.lastSync);
        expect(newState.loading).toBeTruthy();
    });
});