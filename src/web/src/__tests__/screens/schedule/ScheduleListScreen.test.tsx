import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { axe } from '@testing-library/jest-dom';
import ScheduleListScreen from '../../../screens/schedule/ScheduleListScreen';
import { useSchedule } from '../../../hooks/useSchedule';
import { createStore } from 'redux';
import { TaskType } from '../../../types/schedule.types';

// Mock useSchedule hook
jest.mock('../../../hooks/useSchedule');

// Mock performance monitoring
jest.mock('@gardening/monitoring', () => ({
  usePerformanceMonitor: () => ({
    trackEvent: jest.fn(),
    trackMetric: jest.fn()
  })
}));

// Test data
const mockSchedules = [
  {
    id: '1',
    gardenId: 'default-garden-id',
    taskType: TaskType.WATERING,
    dueDate: new Date('2024-01-15'),
    completed: false,
    priority: 1,
    notificationSent: false
  },
  {
    id: '2',
    gardenId: 'default-garden-id',
    taskType: TaskType.FERTILIZING,
    dueDate: new Date('2024-01-16'),
    completed: true,
    priority: 2,
    notificationSent: true
  }
];

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    store = createStore((state) => state, initialState),
    ...renderOptions
  } = {}
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
};

describe('ScheduleListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('should render the schedule list with correct title', () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      expect(screen.getByText('Maintenance Schedule')).toBeInTheDocument();
    });

    it('should display loading state correctly', () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: [],
        loading: true,
        error: null,
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should display empty state when no schedules exist', () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: [],
        loading: false,
        error: null,
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
    });
  });

  describe('Task Management', () => {
    it('should handle task selection and navigation', async () => {
      const mockNavigate = jest.fn();
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useNavigate: () => mockNavigate
      }));

      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      
      const taskCard = screen.getByText(TaskType.WATERING);
      fireEvent.click(taskCard);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/schedule/1');
      });
    });

    it('should update task completion status', async () => {
      const mockUpdateSchedule = jest.fn();
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false,
        updateSchedule: mockUpdateSchedule
      });

      renderWithProviders(<ScheduleListScreen />);
      
      const completeButton = screen.getByLabelText(/mark task as complete/i);
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(mockUpdateSchedule).toHaveBeenCalledWith('1', { completed: true });
      });
    });
  });

  describe('Offline Functionality', () => {
    it('should display offline indicator when offline', () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: true
      });

      renderWithProviders(<ScheduleListScreen />);
      expect(screen.getByText(/working offline/i)).toBeInTheDocument();
    });

    it('should handle sync retry when connection is restored', async () => {
      const mockRetryOperation = jest.fn();
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false,
        syncStatus: { status: 'error' },
        retryOperation: mockRetryOperation
      });

      renderWithProviders(<ScheduleListScreen />);
      
      const retryButton = screen.getByText(/retry sync/i);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockRetryOperation).toHaveBeenCalled();
      });
    });
  });

  describe('Performance', () => {
    it('should render and update within performance thresholds', async () => {
      const startTime = performance.now();
      
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(3000); // 3s threshold from requirements
    });

    it('should handle large schedule lists efficiently', async () => {
      const largeScheduleList = Array(100).fill(null).map((_, index) => ({
        ...mockSchedules[0],
        id: `schedule-${index}`
      }));

      (useSchedule as jest.Mock).mockReturnValue({
        schedules: largeScheduleList,
        loading: false,
        error: null,
        isOffline: false
      });

      const startTime = performance.now();
      renderWithProviders(<ScheduleListScreen />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(3000);
      expect(screen.getAllByRole('article')).toHaveLength(100);
    });
  });

  describe('Error Handling', () => {
    it('should display error state with retry option', () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: [],
        loading: false,
        error: { message: 'Failed to load schedules' },
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      expect(screen.getByText(/failed to load schedules/i)).toBeInTheDocument();
    });

    it('should handle error recovery', async () => {
      const mockRetryOperation = jest.fn();
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: [],
        loading: false,
        error: { message: 'Failed to load schedules' },
        isOffline: false,
        retryOperation: mockRetryOperation
      });

      renderWithProviders(<ScheduleListScreen />);
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockRetryOperation).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG accessibility standards', async () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false
      });

      const { container } = renderWithProviders(<ScheduleListScreen />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      
      const firstTask = screen.getAllByRole('article')[0];
      firstTask.focus();
      expect(document.activeElement).toBe(firstTask);
    });

    it('should have proper ARIA labels and roles', () => {
      (useSchedule as jest.Mock).mockReturnValue({
        schedules: mockSchedules,
        loading: false,
        error: null,
        isOffline: false
      });

      renderWithProviders(<ScheduleListScreen />);
      
      expect(screen.getAllByRole('article')).toHaveLength(mockSchedules.length);
      expect(screen.getByRole('button', { name: /mark task as complete/i })).toBeInTheDocument();
    });
  });
});