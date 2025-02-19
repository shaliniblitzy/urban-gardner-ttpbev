import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import Calendar from 'react-calendar';
import { Schedule } from '../../types/schedule.types';
import { useSchedule } from '../../hooks/useSchedule';
import Loading from '../common/Loading';
import { theme } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { mediaQueries } from '../../theme/breakpoints';
import typography from '../../theme/typography';

// Styled components for enhanced calendar visualization
const CalendarContainer = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  background: ${theme.palette.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  ${mediaQueries.small} {
    padding: ${spacing.small};
  }
  
  ${mediaQueries.medium} {
    padding: ${spacing.medium};
  }
`;

const StyledCalendar = styled(Calendar)`
  width: 100%;
  border: none;
  
  .react-calendar__tile {
    padding: ${spacing.medium};
    position: relative;
    ${typography.body2};
    
    &:enabled:hover {
      background-color: ${theme.palette.primary.light}20;
    }
    
    &--active {
      background-color: ${theme.palette.primary.base}20 !important;
    }
  }
  
  .react-calendar__navigation {
    ${typography.h3};
    margin-bottom: ${spacing.medium};
  }
`;

const TaskIndicator = styled.div<{ priority: number; completed: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: ${({ priority, completed }) => 
    completed 
      ? theme.palette.secondary.base 
      : priority <= 2 
        ? theme.palette.alert.base
        : theme.palette.primary.base};
`;

const TaskList = styled.div`
  margin-top: ${spacing.medium};
  padding: ${spacing.medium};
  border-top: 1px solid ${theme.palette.secondary.light};
`;

const TaskItem = styled.div<{ completed: boolean }>`
  display: flex;
  align-items: center;
  padding: ${spacing.small};
  margin-bottom: ${spacing.small};
  background-color: ${({ completed }) => 
    completed ? theme.palette.secondary.light : theme.palette.background};
  border-radius: 4px;
  opacity: ${({ completed }) => completed ? 0.7 : 1};
`;

const TaskCheckbox = styled.input.attrs({ type: 'checkbox' })`
  margin-right: ${spacing.small};
  cursor: pointer;
`;

const TaskDetails = styled.div`
  flex: 1;
  ${typography.body2};
`;

interface CalendarProps {
  gardenId: string;
  onDateSelect?: (date: Date) => void;
  onTaskComplete?: (scheduleId: string) => void;
  theme?: ThemeProps;
  accessibility?: AccessibilityConfig;
  locale?: string;
  direction?: 'ltr' | 'rtl';
}

interface AccessibilityConfig {
  ariaLabels?: Record<string, string>;
  keyboardShortcuts?: boolean;
  highContrast?: boolean;
}

const GardenCalendar: React.FC<CalendarProps> = ({
  gardenId,
  onDateSelect,
  onTaskComplete,
  accessibility = {},
  locale = 'en-US',
  direction = 'ltr'
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { schedules, loading, updateSchedule, error } = useSchedule(gardenId);

  // Memoized function to get tasks for a specific date
  const getTasksForDate = useCallback((date: Date, schedules: Schedule[]) => {
    return schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.dueDate);
      return scheduleDate.toDateString() === date.toDateString();
    }).sort((a, b) => {
      // Sort by priority (high to low) and completion status
      if (a.completed === b.completed) {
        return a.priority - b.priority;
      }
      return a.completed ? 1 : -1;
    });
  }, []);

  // Memoized tasks for selected date
  const selectedDateTasks = useMemo(() => 
    getTasksForDate(selectedDate, schedules),
    [selectedDate, schedules, getTasksForDate]
  );

  // Handle date selection
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  }, [onDateSelect]);

  // Handle task completion
  const handleTaskComplete = useCallback(async (scheduleId: string, completed: boolean) => {
    try {
      await updateSchedule(scheduleId, { completed });
      onTaskComplete?.(scheduleId);
    } catch (err) {
      console.error('Error updating task completion:', err);
    }
  }, [updateSchedule, onTaskComplete]);

  // Custom tile content to show task indicators
  const tileContent = useCallback(({ date }: { date: Date }) => {
    const dateTasks = getTasksForDate(date, schedules);
    if (dateTasks.length === 0) return null;

    const highestPriorityTask = dateTasks.reduce((prev, current) => 
      current.priority < prev.priority ? current : prev
    );

    return (
      <TaskIndicator 
        priority={highestPriorityTask.priority}
        completed={highestPriorityTask.completed}
        aria-hidden="true"
      />
    );
  }, [schedules, getTasksForDate]);

  if (loading) {
    return <Loading size="medium" overlay />;
  }

  if (error) {
    return <div role="alert">Error loading schedule: {error.message}</div>;
  }

  return (
    <CalendarContainer dir={direction}>
      <StyledCalendar
        onChange={handleDateClick}
        value={selectedDate}
        locale={locale}
        tileContent={tileContent}
        prevLabel={accessibility.ariaLabels?.prevMonth || "Previous month"}
        nextLabel={accessibility.ariaLabels?.nextMonth || "Next month"}
        navigationAriaLabel={accessibility.ariaLabels?.navigation || "Calendar navigation"}
        tileClassName={accessibility.highContrast ? "high-contrast" : undefined}
        showNeighboringMonth={false}
      />
      
      <TaskList role="list" aria-label="Tasks for selected date">
        {selectedDateTasks.map(task => (
          <TaskItem 
            key={task.id}
            completed={task.completed}
            role="listitem"
          >
            <TaskCheckbox
              checked={task.completed}
              onChange={(e) => handleTaskComplete(task.id, e.target.checked)}
              aria-label={`Mark ${task.taskType} as ${task.completed ? 'incomplete' : 'complete'}`}
            />
            <TaskDetails>
              <span>{task.taskType}</span>
              {task.priority <= 2 && (
                <span role="status" aria-label="High priority task">
                  ⚠️ High Priority
                </span>
              )}
            </TaskDetails>
          </TaskItem>
        ))}
        {selectedDateTasks.length === 0 && (
          <div role="status">No tasks scheduled for this date</div>
        )}
      </TaskList>
    </CalendarContainer>
  );
};

export default React.memo(GardenCalendar);