import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { jest } from '@jest/globals';
import ScheduleCard from '../../../components/schedule/ScheduleCard';
import { Schedule, TaskType } from '../../../types/schedule.types';
import { scheduleService } from '../../../services/schedule.service';
import { theme } from '../../../theme';

// Mock schedule service
jest.mock('../../../services/schedule.service', () => ({
  scheduleService: {
    markCompleted: jest.fn(),
    postponeTask: jest.fn()
  }
}));

// Custom render function with theme provider
const renderWithTheme = (ui: React.ReactNode) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

// Mock schedule data
const mockSchedule: Schedule = {
  id: 'test-schedule-1',
  gardenId: 'garden-1',
  taskType: TaskType.WATERING,
  dueDate: new Date('2024-01-15T09:00:00'),
  completed: false,
  priority: 1,
  notificationSent: false,
  plant: 'Tomatoes',
  zone: 'Zone 1',
  instructions: ['Water thoroughly', 'Check soil moisture', 'Avoid leaf wetness']
};

describe('ScheduleCard Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders schedule card with correct task information', () => {
    const onComplete = jest.fn();
    const onViewDetails = jest.fn();

    renderWithTheme(
      <ScheduleCard
        schedule={mockSchedule}
        onComplete={onComplete}
        onViewDetails={onViewDetails}
      />
    );

    // Verify task type display
    expect(screen.getByText('watering')).toBeInTheDocument();

    // Verify due date formatting
    expect(screen.getByText('Due: Jan 15, 2024')).toBeInTheDocument();

    // Verify plant and zone information
    expect(screen.getByText(/Tomatoes/)).toBeInTheDocument();
    expect(screen.getByText(/Zone 1/)).toBeInTheDocument();

    // Verify task status
    expect(screen.getByText('Pending')).toBeInTheDocument();

    // Verify action buttons
    expect(screen.getByRole('button', { name: /view task details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark task as complete/i })).toBeInTheDocument();
  });

  it('handles task completion interaction correctly', async () => {
    const onComplete = jest.fn();
    const onViewDetails = jest.fn();

    // Mock successful completion
    (scheduleService.markCompleted as jest.Mock).mockResolvedValueOnce({
      ...mockSchedule,
      completed: true
    });

    renderWithTheme(
      <ScheduleCard
        schedule={mockSchedule}
        onComplete={onComplete}
        onViewDetails={onViewDetails}
      />
    );

    // Click complete button
    const completeButton = screen.getByRole('button', { name: /mark task as complete/i });
    await user.click(completeButton);

    // Verify loading state
    expect(screen.getByText('Updating...')).toBeInTheDocument();

    // Verify service call
    await waitFor(() => {
      expect(scheduleService.markCompleted).toHaveBeenCalledWith(mockSchedule.id);
    });

    // Verify callback
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(mockSchedule.id);
    });

    // Verify button is disabled after completion
    await waitFor(() => {
      expect(completeButton).toBeDisabled();
    });
  });

  it('handles task completion error gracefully', async () => {
    const onComplete = jest.fn();
    const onViewDetails = jest.fn();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock failed completion
    (scheduleService.markCompleted as jest.Mock).mockRejectedValueOnce(
      new Error('Failed to mark task as completed')
    );

    renderWithTheme(
      <ScheduleCard
        schedule={mockSchedule}
        onComplete={onComplete}
        onViewDetails={onViewDetails}
      />
    );

    // Click complete button
    const completeButton = screen.getByRole('button', { name: /mark task as complete/i });
    await user.click(completeButton);

    // Verify error handling
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to mark task as completed:',
        expect.any(Error)
      );
    });

    // Verify button returns to normal state
    await waitFor(() => {
      expect(screen.getByText('Mark Complete')).toBeInTheDocument();
      expect(completeButton).not.toBeDisabled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('triggers view details modal with correct data', async () => {
    const onComplete = jest.fn();
    const onViewDetails = jest.fn();

    renderWithTheme(
      <ScheduleCard
        schedule={mockSchedule}
        onComplete={onComplete}
        onViewDetails={onViewDetails}
      />
    );

    // Click view details button
    const viewDetailsButton = screen.getByRole('button', { name: /view task details/i });
    await user.click(viewDetailsButton);

    // Verify callback with correct data
    expect(onViewDetails).toHaveBeenCalledWith(mockSchedule);

    // Test keyboard accessibility
    await user.tab();
    expect(viewDetailsButton).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onViewDetails).toHaveBeenCalledTimes(2);
  });

  it('applies correct styles based on completion status and theme', () => {
    const onComplete = jest.fn();
    const onViewDetails = jest.fn();
    const completedSchedule = { ...mockSchedule, completed: true };

    const { rerender } = renderWithTheme(
      <ScheduleCard
        schedule={mockSchedule}
        onComplete={onComplete}
        onViewDetails={onViewDetails}
      />
    );

    // Verify incomplete status styles
    const incompleteStatus = screen.getByText('Pending');
    expect(incompleteStatus).toHaveStyle({
      color: theme.palette.alert.base
    });

    // Rerender with completed schedule
    rerender(
      <ThemeProvider theme={theme}>
        <ScheduleCard
          schedule={completedSchedule}
          onComplete={onComplete}
          onViewDetails={onViewDetails}
        />
      </ThemeProvider>
    );

    // Verify completed status styles
    const completeStatus = screen.getByText('Completed');
    expect(completeStatus).toHaveStyle({
      color: theme.palette.primary.base
    });
  });

  it('maintains accessibility standards', () => {
    const onComplete = jest.fn();
    const onViewDetails = jest.fn();

    const { container } = renderWithTheme(
      <ScheduleCard
        schedule={mockSchedule}
        onComplete={onComplete}
        onViewDetails={onViewDetails}
      />
    );

    // Verify ARIA roles and labels
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      'watering task pending'
    );

    // Verify button accessibility
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveAttribute('aria-label');
    });

    // Verify focus management
    const viewDetailsButton = screen.getByRole('button', { name: /view task details/i });
    viewDetailsButton.focus();
    expect(viewDetailsButton).toHaveFocus();
  });
});