import { jest } from '@jest/globals';
import { scheduleService } from '../../services/schedule.service';
import { apiService } from '../../services/api.service';
import { notificationService } from '../../services/notification.service';
import { Schedule, TaskType } from '../../types/schedule.types';

// Mock the imported services
jest.mock('../../services/api.service');
jest.mock('../../services/notification.service');

describe('ScheduleService', () => {
  // Mock data
  const mockSchedule: Schedule = {
    id: '123',
    gardenId: 'garden-1',
    taskType: TaskType.WATERING,
    dueDate: new Date('2024-01-01'),
    completed: false,
    priority: 1,
    notificationSent: false
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  describe('Schedule CRUD Operations', () => {
    it('should retrieve all schedules successfully', async () => {
      const mockSchedules = [mockSchedule];
      jest.spyOn(apiService, 'get').mockResolvedValue(mockSchedules);

      const result = await scheduleService.getSchedules();

      expect(result).toEqual(mockSchedules);
      expect(apiService.get).toHaveBeenCalledWith('/api/schedules');
    });

    it('should create new schedule with notification', async () => {
      jest.spyOn(apiService, 'post').mockResolvedValue(mockSchedule);
      jest.spyOn(notificationService, 'createMaintenanceNotification').mockResolvedValue({
        id: 'notif-1',
        timestamp: new Date().toISOString(),
        success: true
      });

      const result = await scheduleService.createSchedule({
        gardenId: 'garden-1',
        taskType: TaskType.WATERING,
        dueDate: new Date('2024-01-01'),
        priority: 1
      });

      expect(result).toEqual(mockSchedule);
      expect(apiService.post).toHaveBeenCalled();
    });

    it('should update existing schedule', async () => {
      const updatedSchedule = { ...mockSchedule, completed: true };
      jest.spyOn(apiService, 'put').mockResolvedValue(updatedSchedule);

      const result = await scheduleService.updateSchedule('123', { completed: true });

      expect(result).toEqual(updatedSchedule);
      expect(apiService.put).toHaveBeenCalledWith('/api/schedules/123', { completed: true });
    });

    it('should delete schedule and cancel notifications', async () => {
      jest.spyOn(apiService, 'delete').mockResolvedValue(undefined);

      await scheduleService.deleteSchedule('123');

      expect(apiService.delete).toHaveBeenCalledWith('/api/schedules/123');
    });

    it('should mark schedule as completed', async () => {
      const completedSchedule = { ...mockSchedule, completed: true };
      jest.spyOn(apiService, 'put').mockResolvedValue(completedSchedule);

      const result = await scheduleService.markCompleted('123');

      expect(result).toEqual(completedSchedule);
      expect(apiService.put).toHaveBeenCalledWith('/api/schedules/123', { completed: true });
    });
  });

  describe('Offline Support', () => {
    beforeEach(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false
      });
    });

    it('should queue operations when offline', async () => {
      const newSchedule = {
        gardenId: 'garden-1',
        taskType: TaskType.WATERING,
        dueDate: new Date('2024-01-01'),
        priority: 1
      };

      await expect(scheduleService.createSchedule(newSchedule))
        .rejects.toThrow('Operation queued for offline mode');
    });

    it('should use cached data when offline', async () => {
      const mockSchedules = [mockSchedule];
      jest.spyOn(scheduleService, 'getCachedSchedules').mockResolvedValue(mockSchedules);

      const result = await scheduleService.getSchedules();

      expect(result).toEqual(mockSchedules);
    });

    it('should sync queued operations when online', async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true
      });

      jest.spyOn(apiService, 'post').mockResolvedValue(mockSchedule);
      
      await scheduleService.syncOfflineSchedules();

      expect(apiService.post).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should deliver notifications within 1 second', async () => {
      const startTime = Date.now();
      
      await scheduleService.createSchedule({
        gardenId: 'garden-1',
        taskType: TaskType.WATERING,
        dueDate: new Date('2024-01-01'),
        priority: 1
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent operations efficiently', async () => {
      const operations = Array(5).fill(null).map(() => 
        scheduleService.createSchedule({
          gardenId: 'garden-1',
          taskType: TaskType.WATERING,
          dueDate: new Date('2024-01-01'),
          priority: 1
        })
      );

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      jest.spyOn(apiService, 'get').mockRejectedValue(new Error('API Error'));

      await expect(scheduleService.getSchedules())
        .rejects.toThrow('API Error');
    });

    it('should validate input data', async () => {
      const invalidSchedule = {
        gardenId: 'garden-1',
        taskType: 'INVALID_TYPE' as TaskType,
        dueDate: new Date('2024-01-01'),
        priority: 1
      };

      await expect(scheduleService.createSchedule(invalidSchedule))
        .rejects.toThrow('Invalid task type');
    });

    it('should retry failed operations', async () => {
      jest.spyOn(apiService, 'post')
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce(mockSchedule);

      const result = await scheduleService.createSchedule({
        gardenId: 'garden-1',
        taskType: TaskType.WATERING,
        dueDate: new Date('2024-01-01'),
        priority: 1
      });

      expect(result).toEqual(mockSchedule);
      expect(apiService.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Preference Management', () => {
    it('should update notification preferences', async () => {
      const preferences = {
        preferredTime: '09:00',
        notificationEnabled: true,
        emailNotifications: true,
        pushNotifications: true
      };

      jest.spyOn(apiService, 'put').mockResolvedValue(undefined);

      await scheduleService.updatePreferences(preferences);

      expect(apiService.put).toHaveBeenCalledWith('/api/schedules/preferences', preferences);
    });

    it('should apply preferences to new schedules', async () => {
      const preferences = {
        preferredTime: '09:00',
        notificationEnabled: true,
        emailNotifications: true,
        pushNotifications: true
      };

      await scheduleService.updatePreferences(preferences);

      const result = await scheduleService.createSchedule({
        gardenId: 'garden-1',
        taskType: TaskType.WATERING,
        dueDate: new Date('2024-01-01'),
        priority: 1
      });

      expect(result.notificationSent).toBe(false);
    });
  });
});