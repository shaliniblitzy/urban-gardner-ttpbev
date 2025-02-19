import { renderHook, act } from '@testing-library/react-hooks';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { useSchedule } from '../../hooks/useSchedule';
import { scheduleService } from '../../services/schedule.service';
import { Schedule, TaskType } from '../../types/schedule.types';

// Mock service worker setup
const server = setupServer();

// Mock schedule data
const mockSchedule: Schedule = {
  id: '1',
  gardenId: 'garden-1',
  taskType: TaskType.WATERING,
  dueDate: new Date('2024-01-01'),
  completed: false,
  priority: 1,
  notificationSent: false
};

// Mock performance metrics
const mockPerformanceMetrics = {
  operationDuration: 500,
  retryCount: 0,
  offlineQueueSize: 0,
  lastSyncTimestamp: new Date().toISOString()
};

// Mock service methods
jest.mock('../../services/schedule.service', () => ({
  scheduleService: {
    getSchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    syncOfflineQueue: jest.fn(),
    getPerformanceMetrics: jest.fn(() => mockPerformanceMetrics)
  }
}));

describe('useSchedule', () => {
  // Setup and teardown
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });
  afterAll(() => server.close());

  describe('Online Operations', () => {
    beforeEach(() => {
      // Mock online status
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });

    test('should fetch schedules on initial load', async () => {
      (scheduleService.getSchedules as jest.Mock).mockResolvedValueOnce([mockSchedule]);

      const { result, waitForNextUpdate } = renderHook(() => useSchedule('garden-1'));
      
      expect(result.current.loading).toBe(true);
      await waitForNextUpdate();
      
      expect(result.current.schedules).toEqual([mockSchedule]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('should create schedule successfully', async () => {
      const newSchedule = { ...mockSchedule, id: '2' };
      (scheduleService.createSchedule as jest.Mock).mockResolvedValueOnce(newSchedule);

      const { result } = renderHook(() => useSchedule('garden-1'));

      await act(async () => {
        await result.current.createSchedule({
          taskType: TaskType.WATERING,
          dueDate: new Date('2024-01-01')
        });
      });

      expect(scheduleService.createSchedule).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    test('should update schedule successfully', async () => {
      const updatedSchedule = { ...mockSchedule, completed: true };
      (scheduleService.updateSchedule as jest.Mock).mockResolvedValueOnce(updatedSchedule);

      const { result } = renderHook(() => useSchedule('garden-1'));

      await act(async () => {
        await result.current.updateSchedule('1', { completed: true });
      });

      expect(scheduleService.updateSchedule).toHaveBeenCalledWith('1', { completed: true });
      expect(result.current.error).toBeNull();
    });

    test('should delete schedule successfully', async () => {
      (scheduleService.deleteSchedule as jest.Mock).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSchedule('garden-1'));

      await act(async () => {
        await result.current.deleteSchedule('1');
      });

      expect(scheduleService.deleteSchedule).toHaveBeenCalledWith('1');
      expect(result.current.error).toBeNull();
    });
  });

  describe('Offline Operations', () => {
    beforeEach(() => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    });

    test('should queue operations when offline', async () => {
      const { result } = renderHook(() => useSchedule('garden-1'));

      await act(async () => {
        await result.current.createSchedule({
          taskType: TaskType.WATERING,
          dueDate: new Date('2024-01-01')
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain('offline');
    });

    test('should sync offline queue when coming online', async () => {
      const { result } = renderHook(() => useSchedule('garden-1'));

      await act(async () => {
        // Simulate coming online
        Object.defineProperty(navigator, 'onLine', { value: true });
        window.dispatchEvent(new Event('online'));
      });

      expect(scheduleService.syncOfflineQueue).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    test('should track operation duration', async () => {
      (scheduleService.getSchedules as jest.Mock).mockResolvedValueOnce([mockSchedule]);

      const { result, waitForNextUpdate } = renderHook(() => useSchedule('garden-1'));
      
      await waitForNextUpdate();
      
      expect(result.current.performanceMetrics.operationDuration).toBeDefined();
      expect(result.current.performanceMetrics.operationDuration).toBeLessThan(3000); // SLA requirement
    });

    test('should track retry attempts', async () => {
      (scheduleService.getSchedules as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([mockSchedule]);

      const { result, waitForNextUpdate } = renderHook(() => useSchedule('garden-1'));
      
      await waitForNextUpdate();
      
      expect(result.current.performanceMetrics.retryCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      const apiError = new Error('API Error');
      (scheduleService.getSchedules as jest.Mock).mockRejectedValueOnce(apiError);

      const { result, waitForNextUpdate } = renderHook(() => useSchedule('garden-1'));
      
      await waitForNextUpdate();
      
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });

    test('should handle network errors with retry', async () => {
      const networkError = new Error('Network Error');
      (scheduleService.getSchedules as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce([mockSchedule]);

      const { result, waitForNextUpdate } = renderHook(() => useSchedule('garden-1'));
      
      await waitForNextUpdate();
      
      expect(result.current.schedules).toEqual([mockSchedule]);
      expect(result.current.error).toBeNull();
    });
  });
});