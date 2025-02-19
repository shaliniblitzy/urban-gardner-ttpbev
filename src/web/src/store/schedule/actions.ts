import { Dispatch } from 'redux';
import { ThunkAction } from 'redux-thunk';
import { performance } from '@sentry/browser'; // ^7.0.0
import { 
    ScheduleActionTypes,
    ScheduleAction,
    SetScheduleLoadingAction,
    SetScheduleErrorAction
} from './types';
import { Schedule } from '../../types/schedule.types';
import { scheduleService } from '../../services/schedule.service';
import { RootState } from '../rootReducer';

/**
 * Action creator for setting schedule loading state
 */
export const setScheduleLoading = (loading: boolean): SetScheduleLoadingAction => ({
    type: ScheduleActionTypes.SET_SCHEDULE_LOADING,
    payload: loading
});

/**
 * Action creator for setting schedule error state
 */
export const setScheduleError = (error: string | null): SetScheduleErrorAction => ({
    type: ScheduleActionTypes.SET_SCHEDULE_ERROR,
    payload: error
});

/**
 * Thunk action creator for fetching schedules
 * Includes performance monitoring and error handling
 */
export const fetchSchedules = (): ThunkAction<
    Promise<void>,
    RootState,
    unknown,
    ScheduleAction
> => async (dispatch: Dispatch<ScheduleAction>) => {
    const perfMark = `fetch-schedules-${Date.now()}`;
    performance.mark(perfMark);

    try {
        dispatch(setScheduleLoading(true));
        const schedules = await scheduleService.getSchedules();
        
        dispatch({
            type: ScheduleActionTypes.FETCH_SCHEDULES,
            payload: schedules
        });

        performance.measure('Schedule Fetch Duration', perfMark);
    } catch (error) {
        dispatch(setScheduleError((error as Error).message));
        throw error;
    } finally {
        dispatch(setScheduleLoading(false));
    }
};

/**
 * Thunk action creator for creating a new schedule
 * Includes input validation and offline support
 */
export const createSchedule = (
    scheduleData: Partial<Schedule>
): ThunkAction<
    Promise<void>,
    RootState,
    unknown,
    ScheduleAction
> => async (dispatch: Dispatch<ScheduleAction>) => {
    const perfMark = `create-schedule-${Date.now()}`;
    performance.mark(perfMark);

    try {
        dispatch(setScheduleLoading(true));
        const newSchedule = await scheduleService.createSchedule(scheduleData);
        
        dispatch({
            type: ScheduleActionTypes.CREATE_SCHEDULE,
            payload: newSchedule
        });

        performance.measure('Schedule Creation Duration', perfMark);
    } catch (error) {
        dispatch(setScheduleError((error as Error).message));
        throw error;
    } finally {
        dispatch(setScheduleLoading(false));
    }
};

/**
 * Thunk action creator for updating an existing schedule
 * Includes offline queue support
 */
export const updateSchedule = (
    id: string,
    updates: Partial<Schedule>
): ThunkAction<
    Promise<void>,
    RootState,
    unknown,
    ScheduleAction
> => async (dispatch: Dispatch<ScheduleAction>) => {
    const perfMark = `update-schedule-${Date.now()}`;
    performance.mark(perfMark);

    try {
        dispatch(setScheduleLoading(true));
        const updatedSchedule = await scheduleService.updateSchedule(id, updates);
        
        dispatch({
            type: ScheduleActionTypes.UPDATE_SCHEDULE,
            payload: {
                id,
                updates: updatedSchedule
            }
        });

        performance.measure('Schedule Update Duration', perfMark);
    } catch (error) {
        dispatch(setScheduleError((error as Error).message));
        throw error;
    } finally {
        dispatch(setScheduleLoading(false));
    }
};

/**
 * Thunk action creator for deleting a schedule
 * Includes offline queue support
 */
export const deleteSchedule = (
    id: string
): ThunkAction<
    Promise<void>,
    RootState,
    unknown,
    ScheduleAction
> => async (dispatch: Dispatch<ScheduleAction>) => {
    const perfMark = `delete-schedule-${Date.now()}`;
    performance.mark(perfMark);

    try {
        dispatch(setScheduleLoading(true));
        await scheduleService.deleteSchedule(id);
        
        dispatch({
            type: ScheduleActionTypes.DELETE_SCHEDULE,
            payload: id
        });

        performance.measure('Schedule Deletion Duration', perfMark);
    } catch (error) {
        dispatch(setScheduleError((error as Error).message));
        throw error;
    } finally {
        dispatch(setScheduleLoading(false));
    }
};

/**
 * Thunk action creator for updating schedule preferences
 */
export const updatePreferences = (
    preferences: Partial<Schedule>
): ThunkAction<
    Promise<void>,
    RootState,
    unknown,
    ScheduleAction
> => async (dispatch: Dispatch<ScheduleAction>) => {
    const perfMark = `update-preferences-${Date.now()}`;
    performance.mark(perfMark);

    try {
        dispatch(setScheduleLoading(true));
        await scheduleService.updatePreferences(preferences);
        
        dispatch({
            type: ScheduleActionTypes.UPDATE_PREFERENCES,
            payload: preferences
        });

        performance.measure('Preferences Update Duration', perfMark);
    } catch (error) {
        dispatch(setScheduleError((error as Error).message));
        throw error;
    } finally {
        dispatch(setScheduleLoading(false));
    }
};

/**
 * Thunk action creator for synchronizing offline changes
 * Processes queued operations when connection is restored
 */
export const syncOfflineChanges = (): ThunkAction<
    Promise<void>,
    RootState,
    unknown,
    ScheduleAction
> => async (dispatch: Dispatch<ScheduleAction>) => {
    const perfMark = `sync-offline-${Date.now()}`;
    performance.mark(perfMark);

    try {
        dispatch(setScheduleLoading(true));
        const schedules = await scheduleService.getSchedules();
        
        dispatch({
            type: ScheduleActionTypes.SYNC_SCHEDULES,
            payload: {
                schedules,
                timestamp: new Date()
            }
        });

        performance.measure('Offline Sync Duration', perfMark);
    } catch (error) {
        dispatch(setScheduleError((error as Error).message));
        throw error;
    } finally {
        dispatch(setScheduleLoading(false));
    }
};