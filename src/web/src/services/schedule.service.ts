import { format } from 'date-fns'; // ^2.30.0
import * as Sentry from '@sentry/browser'; // ^7.0.0
import { Schedule, TaskType, SchedulePreferences, ScheduleFilter } from '../types/schedule.types';
import { apiService, ApiError } from './api.service';

/**
 * Interface for offline queue item
 */
interface QueueItem {
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

/**
 * Enhanced service for managing garden maintenance schedules
 * with offline support, performance monitoring, and error handling
 */
class ScheduleService {
  private static instance: ScheduleService;
  private readonly API_ENDPOINT = '/api/schedules';
  private preferences: SchedulePreferences;
  private offlineQueue: QueueItem[] = [];
  private scheduleCache: Map<string, { data: Schedule[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Initialize default preferences
    this.preferences = {
      preferredTime: '09:00',
      notificationEnabled: true,
      emailNotifications: true,
      pushNotifications: true
    };

    // Set up performance monitoring
    this.initializePerformanceMonitoring();
  }

  /**
   * Initializes performance monitoring for schedule operations
   */
  private initializePerformanceMonitoring(): void {
    Sentry.init({
      tracesSampleRate: 1.0,
      integrations: [new Sentry.BrowserTracing()]
    });
  }

  /**
   * Retrieves maintenance schedules with caching and offline support
   */
  public async getSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    const transaction = Sentry.startTransaction({ name: 'getSchedules' });

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(filter);
      const cachedData = this.scheduleCache.get(cacheKey);
      
      if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_DURATION) {
        return cachedData.data;
      }

      const queryParams = this.buildQueryParams(filter);
      const response = await apiService.get<Schedule[]>(`${this.API_ENDPOINT}${queryParams}`);
      
      // Update cache
      this.scheduleCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      return response;
    } catch (error) {
      Sentry.captureException(error);
      throw this.handleScheduleError(error as ApiError);
    } finally {
      transaction.finish();
    }
  }

  /**
   * Creates a new maintenance schedule with validation
   */
  public async createSchedule(scheduleData: Partial<Schedule>): Promise<Schedule> {
    const transaction = Sentry.startTransaction({ name: 'createSchedule' });

    try {
      this.validateScheduleData(scheduleData);

      if (!navigator.onLine) {
        this.addToOfflineQueue('create', scheduleData);
        throw new Error('Operation queued for offline mode');
      }

      const response = await apiService.post<Partial<Schedule>, Schedule>(
        this.API_ENDPOINT,
        scheduleData
      );

      // Invalidate cache
      this.invalidateCache();

      return response;
    } catch (error) {
      Sentry.captureException(error);
      throw this.handleScheduleError(error as ApiError);
    } finally {
      transaction.finish();
    }
  }

  /**
   * Updates an existing schedule with validation
   */
  public async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const transaction = Sentry.startTransaction({ name: 'updateSchedule' });

    try {
      if (!navigator.onLine) {
        this.addToOfflineQueue('update', { id, ...updates });
        throw new Error('Operation queued for offline mode');
      }

      const response = await apiService.put<Partial<Schedule>, Schedule>(
        `${this.API_ENDPOINT}/${id}`,
        updates
      );

      this.invalidateCache();
      return response;
    } catch (error) {
      Sentry.captureException(error);
      throw this.handleScheduleError(error as ApiError);
    } finally {
      transaction.finish();
    }
  }

  /**
   * Marks a schedule as completed
   */
  public async markCompleted(id: string): Promise<Schedule> {
    return this.updateSchedule(id, { completed: true });
  }

  /**
   * Updates schedule preferences
   */
  public async updatePreferences(newPreferences: Partial<SchedulePreferences>): Promise<void> {
    const transaction = Sentry.startTransaction({ name: 'updatePreferences' });

    try {
      this.preferences = { ...this.preferences, ...newPreferences };
      await apiService.put<Partial<SchedulePreferences>, void>(
        `${this.API_ENDPOINT}/preferences`,
        newPreferences
      );
    } catch (error) {
      Sentry.captureException(error);
      throw this.handleScheduleError(error as ApiError);
    } finally {
      transaction.finish();
    }
  }

  /**
   * Deletes a schedule
   */
  public async deleteSchedule(id: string): Promise<void> {
    const transaction = Sentry.startTransaction({ name: 'deleteSchedule' });

    try {
      if (!navigator.onLine) {
        this.addToOfflineQueue('delete', { id });
        throw new Error('Operation queued for offline mode');
      }

      await apiService.delete(`${this.API_ENDPOINT}/${id}`);
      this.invalidateCache();
    } catch (error) {
      Sentry.captureException(error);
      throw this.handleScheduleError(error as ApiError);
    } finally {
      transaction.finish();
    }
  }

  /**
   * Processes offline queue when connection is restored
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    const transaction = Sentry.startTransaction({ name: 'processOfflineQueue' });

    try {
      for (const item of this.offlineQueue) {
        switch (item.action) {
          case 'create':
            await this.createSchedule(item.data);
            break;
          case 'update':
            await this.updateSchedule(item.data.id, item.data);
            break;
          case 'delete':
            await this.deleteSchedule(item.data.id);
            break;
        }
      }
      this.offlineQueue = [];
    } catch (error) {
      Sentry.captureException(error);
      throw this.handleScheduleError(error as ApiError);
    } finally {
      transaction.finish();
    }
  }

  /**
   * Validates schedule data before creation/update
   */
  private validateScheduleData(data: Partial<Schedule>): void {
    if (!data.taskType || !Object.values(TaskType).includes(data.taskType)) {
      throw new Error('Invalid task type');
    }

    if (data.dueDate && new Date(data.dueDate) < new Date()) {
      throw new Error('Due date cannot be in the past');
    }
  }

  /**
   * Generates cache key based on filter parameters
   */
  private generateCacheKey(filter?: ScheduleFilter): string {
    return filter ? JSON.stringify(filter) : 'all';
  }

  /**
   * Builds query parameters string from filter
   */
  private buildQueryParams(filter?: ScheduleFilter): string {
    if (!filter) return '';

    const params = new URLSearchParams();
    if (filter.taskType) params.append('taskType', filter.taskType);
    if (filter.completed !== undefined) params.append('completed', String(filter.completed));
    if (filter.startDate) params.append('startDate', format(filter.startDate, 'yyyy-MM-dd'));
    if (filter.endDate) params.append('endDate', format(filter.endDate, 'yyyy-MM-dd'));

    return `?${params.toString()}`;
  }

  /**
   * Handles schedule-specific errors
   */
  private handleScheduleError(error: ApiError): Error {
    const errorMessage = error.message || 'An error occurred while processing the schedule operation';
    return new Error(errorMessage);
  }

  /**
   * Invalidates the schedule cache
   */
  private invalidateCache(): void {
    this.scheduleCache.clear();
  }

  /**
   * Adds an operation to the offline queue
   */
  private addToOfflineQueue(action: QueueItem['action'], data: any): void {
    this.offlineQueue.push({
      action,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Gets singleton instance of ScheduleService
   */
  public static getInstance(): ScheduleService {
    if (!ScheduleService.instance) {
      ScheduleService.instance = new ScheduleService();
    }
    return ScheduleService.instance;
  }
}

// Export singleton instance
export const scheduleService = ScheduleService.getInstance();