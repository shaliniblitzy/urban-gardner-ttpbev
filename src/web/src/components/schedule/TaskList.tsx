import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { VirtualList } from 'react-window';
import ScheduleCard from './ScheduleCard';
import { Schedule, ScheduleFilter } from '../../types/schedule.types';
import { useSchedule } from '../../hooks/useSchedule';
import { theme } from '../../theme';
import { getResponsiveSpacing } from '../../theme/spacing';

/**
 * Props interface for the TaskList component
 */
interface TaskListProps {
  gardenId: string;
  filter?: ScheduleFilter;
  onTaskSelect?: (schedule: Schedule) => void;
  className?: string;
  offlineSupport?: boolean;
  retryOnError?: boolean;
  virtualizeList?: boolean;
}

/**
 * Styled components for the TaskList
 */
const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${getResponsiveSpacing('medium')};
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${getResponsiveSpacing('large')};
  color: ${theme.colors.palette.text}80;
  font-family: ${theme.typography.body1.fontFamily};
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  color: ${theme.colors.palette.primary.base};
`;

const ErrorContainer = styled.div`
  padding: ${getResponsiveSpacing('medium')};
  border-radius: 8px;
  background-color: ${theme.colors.palette.alert.light}20;
  color: ${theme.colors.palette.alert.base};
  margin-bottom: ${getResponsiveSpacing('medium')};
`;

const OfflineIndicator = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  padding: ${getResponsiveSpacing('small')};
  background-color: ${theme.colors.palette.secondary.light}20;
  border-radius: 4px;
  font-size: ${theme.typography.caption.fontSize};
  color: ${theme.colors.palette.secondary.dark};
`;

const RetryButton = styled.button`
  ${theme.typography.button};
  padding: ${getResponsiveSpacing('small')} ${getResponsiveSpacing('medium')};
  background-color: ${theme.colors.palette.primary.base};
  color: ${theme.colors.palette.background};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: ${getResponsiveSpacing('small')};

  &:hover {
    background-color: ${theme.colors.palette.primary.dark};
  }
`;

/**
 * TaskList component for displaying and managing garden maintenance tasks
 */
const TaskList: React.FC<TaskListProps> = ({
  gardenId,
  filter,
  onTaskSelect,
  className,
  offlineSupport = true,
  retryOnError = true,
  virtualizeList = true
}) => {
  const {
    schedules,
    loading,
    error,
    updateSchedule,
    retryOperation,
    isOffline
  } = useSchedule(gardenId);

  const [retryCount, setRetryCount] = useState(0);

  /**
   * Memoized filtered and sorted tasks
   */
  const filteredTasks = useMemo(() => {
    let result = [...schedules];

    if (filter) {
      if (filter.taskType) {
        result = result.filter(task => task.taskType === filter.taskType);
      }
      if (filter.completed !== undefined) {
        result = result.filter(task => task.completed === filter.completed);
      }
      if (filter.startDate) {
        result = result.filter(task => new Date(task.dueDate) >= filter.startDate!);
      }
      if (filter.endDate) {
        result = result.filter(task => new Date(task.dueDate) <= filter.endDate!);
      }
    }

    // Sort by due date and priority
    return result.sort((a, b) => {
      const dateComparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return dateComparison || a.priority - b.priority;
    });
  }, [schedules, filter]);

  /**
   * Handles task completion with offline support
   */
  const handleTaskComplete = useCallback(async (scheduleId: string) => {
    try {
      await updateSchedule(scheduleId, { completed: true });
    } catch (error) {
      if (offlineSupport && isOffline) {
        // Handle offline update
        console.log('Task completion queued for offline sync');
      } else {
        throw error;
      }
    }
  }, [updateSchedule, offlineSupport, isOffline]);

  /**
   * Handles task selection with error boundary
   */
  const handleTaskSelect = useCallback((schedule: Schedule) => {
    if (onTaskSelect) {
      try {
        onTaskSelect(schedule);
      } catch (error) {
        console.error('Error in task selection:', error);
      }
    }
  }, [onTaskSelect]);

  /**
   * Handles retry operation for failed requests
   */
  const handleRetry = useCallback(async () => {
    if (retryOnError && error) {
      setRetryCount(prev => prev + 1);
      await retryOperation(`retry-${Date.now()}`);
    }
  }, [retryOnError, error, retryOperation]);

  /**
   * Renders individual task items
   */
  const renderTask = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ScheduleCard
        schedule={filteredTasks[index]}
        onComplete={handleTaskComplete}
        onViewDetails={handleTaskSelect}
      />
    </div>
  ), [filteredTasks, handleTaskComplete, handleTaskSelect]);

  if (loading) {
    return (
      <LoadingContainer>
        <span>Loading tasks...</span>
      </LoadingContainer>
    );
  }

  if (error) {
    return (
      <ErrorContainer>
        <div>Error: {error.message}</div>
        {retryOnError && retryCount < 3 && (
          <RetryButton onClick={handleRetry}>
            Retry Operation
          </RetryButton>
        )}
      </ErrorContainer>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <EmptyState>
        No tasks found for the selected criteria
      </EmptyState>
    );
  }

  return (
    <ListContainer className={className}>
      {isOffline && offlineSupport && (
        <OfflineIndicator>
          Working Offline
        </OfflineIndicator>
      )}
      
      {virtualizeList && filteredTasks.length > 10 ? (
        <VirtualList
          height={600}
          width="100%"
          itemCount={filteredTasks.length}
          itemSize={150}
          overscanCount={2}
        >
          {renderTask}
        </VirtualList>
      ) : (
        filteredTasks.map(schedule => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            onComplete={handleTaskComplete}
            onViewDetails={handleTaskSelect}
          />
        ))
      )}
    </ListContainer>
  );
};

export default TaskList;