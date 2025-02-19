import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { useState, useEffect } from 'react'; // ^18.2.0
import { Schedule, TaskType, ScheduleFilter } from '../types/schedule.types';
import { scheduleService } from '../services/schedule.service';
import * as Sentry from '@sentry/browser'; // ^7.0.0

interface PerformanceMetrics {
  operationDuration: number;
  retryCount: number;
  offlineQueueSize: number;
  lastSyncTimestamp: string;
}

interface ErrorContext {
  code: string;
  message: string;
  retryAttempt?: number;
  recoverySteps?: string[];
}

interface ScheduleHookReturn {
  schedules: Schedule[];
  loading: boolean;
  error: ErrorContext | null;
  performanceMetrics: PerformanceMetrics;
  createSchedule: (data: Partial<Schedule>) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  markCompleted: (id: string) => Promise<void>;
  generateSchedules: (gardenId: string) => Promise<void>;
  retryOperation: (operationId: string) => Promise<void>;
  syncOfflineChanges: () => Promise<void>;
  filterSchedules: (filter: ScheduleFilter) => Promise<void>;
}

/**
 * Enhanced custom hook for managing garden maintenance schedules
 * with offline support, performance monitoring, and error handling
 */
export const useSchedule = (gardenId: string): ScheduleHookReturn => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorContext | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    operationDuration: 0,
    retryCount: 0,
    offlineQueueSize: 0,
    lastSyncTimestamp: new Date().toISOString()
  });

  /**
   * Tracks performance metrics for schedule operations
   */
  const trackPerformance = (startTime: number, retryCount: number = 0) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      operationDuration: Date.now() - startTime,
      retryCount,
      lastSyncTimestamp: new Date().toISOString()
    }));
  };

  /**
   * Handles and formats errors from schedule operations
   */
  const handleError = (error: any): ErrorContext => {
    const errorContext: ErrorContext = {
      code: error.code || 'SCHEDULE_ERROR',
      message: error.message || 'An error occurred during schedule operation',
      retryAttempt: error.retryAttempt,
      recoverySteps: error.recoverySteps || ['Try again later']
    };

    Sentry.captureException(error, {
      tags: {
        gardenId,
        operationType: 'schedule_operation'
      }
    });

    setError(errorContext);
    return errorContext;
  };

  /**
   * Fetches schedules with error handling and performance tracking
   */
  const fetchSchedules = async (filter?: ScheduleFilter) => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      const response = await scheduleService.getSchedules(filter);
      setSchedules(response);
      trackPerformance(startTime);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Creates a new schedule with optimistic updates
   */
  const createSchedule = async (data: Partial<Schedule>): Promise<void> => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      // Optimistic update
      const tempSchedule: Schedule = {
        ...data,
        id: `temp-${Date.now()}`,
        completed: false,
        gardenId,
      } as Schedule;

      setSchedules(prev => [...prev, tempSchedule]);

      const created = await scheduleService.createSchedule(data);
      setSchedules(prev => prev.map(s => 
        s.id === tempSchedule.id ? created : s
      ));
      
      trackPerformance(startTime);
    } catch (error) {
      handleError(error);
      // Rollback optimistic update
      setSchedules(prev => prev.filter(s => !s.id.startsWith('temp-')));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Updates an existing schedule with optimistic updates
   */
  const updateSchedule = async (id: string, updates: Partial<Schedule>): Promise<void> => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    const originalSchedule = schedules.find(s => s.id === id);
    
    try {
      // Optimistic update
      setSchedules(prev => prev.map(s => 
        s.id === id ? { ...s, ...updates } : s
      ));

      await scheduleService.updateSchedule(id, updates);
      trackPerformance(startTime);
    } catch (error) {
      handleError(error);
      // Rollback optimistic update
      if (originalSchedule) {
        setSchedules(prev => prev.map(s => 
          s.id === id ? originalSchedule : s
        ));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Marks a schedule as completed
   */
  const markCompleted = async (id: string): Promise<void> => {
    await updateSchedule(id, { completed: true });
  };

  /**
   * Deletes a schedule with optimistic updates
   */
  const deleteSchedule = async (id: string): Promise<void> => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    const deletedSchedule = schedules.find(s => s.id === id);

    try {
      // Optimistic update
      setSchedules(prev => prev.filter(s => s.id !== id));
      await scheduleService.deleteSchedule(id);
      trackPerformance(startTime);
    } catch (error) {
      handleError(error);
      // Rollback optimistic update
      if (deletedSchedule) {
        setSchedules(prev => [...prev, deletedSchedule]);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generates new schedules for a garden
   */
  const generateSchedules = async (gardenId: string): Promise<void> => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      await scheduleService.generateSchedule(gardenId);
      await fetchSchedules();
      trackPerformance(startTime);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retries a failed operation
   */
  const retryOperation = async (operationId: string): Promise<void> => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      await scheduleService.retryFailedOperation(operationId);
      await fetchSchedules();
      trackPerformance(startTime, (performanceMetrics.retryCount || 0) + 1);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Synchronizes offline changes
   */
  const syncOfflineChanges = async (): Promise<void> => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      await scheduleService.syncOfflineChanges();
      await fetchSchedules();
      trackPerformance(startTime);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filters schedules based on criteria
   */
  const filterSchedules = async (filter: ScheduleFilter): Promise<void> => {
    await fetchSchedules(filter);
  };

  // Initial fetch of schedules
  useEffect(() => {
    fetchSchedules();
  }, [gardenId]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineChanges();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return {
    schedules,
    loading,
    error,
    performanceMetrics,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    markCompleted,
    generateSchedules,
    retryOperation,
    syncOfflineChanges,
    filterSchedules
  };
};