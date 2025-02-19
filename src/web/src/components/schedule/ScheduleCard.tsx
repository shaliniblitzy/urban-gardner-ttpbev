import React, { useState } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns'; // ^2.30.0
import Card from '../common/Card';
import { Schedule, TaskType } from '../../types/schedule.types';
import { scheduleService } from '../../services/schedule.service';
import { theme } from '../../theme';

/**
 * Props interface for the ScheduleCard component
 */
interface ScheduleCardProps {
  schedule: Schedule;
  onComplete: (id: string) => Promise<void>;
  onViewDetails: (schedule: Schedule) => void;
  className?: string;
}

/**
 * Styled components for card layout and responsive design
 */
const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;

  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const TaskHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`;

const TaskType = styled.h3`
  ${theme.typography.h3};
  color: ${theme.palette.text};
  margin: 0;
  text-transform: capitalize;
`;

const DueDate = styled.span`
  ${theme.typography.body2};
  color: ${theme.palette.text}80;
`;

const TaskStatus = styled.span<{ completed: boolean }>`
  ${theme.typography.body2};
  color: ${props => props.completed ? theme.palette.primary.base : theme.palette.alert.base};
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: currentColor;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  ${theme.typography.button};
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: ${props => props.variant === 'primary' 
    ? theme.palette.primary.base 
    : theme.palette.background};
  color: ${props => props.variant === 'primary' 
    ? theme.palette.background 
    : theme.palette.primary.base};
  border: 1px solid ${theme.palette.primary.base};
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${props => props.variant === 'primary' 
      ? theme.palette.primary.dark 
      : theme.palette.primary.light}20;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/**
 * ScheduleCard component for displaying maintenance tasks
 * Implements card layout with status indication and action buttons
 */
const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onComplete,
  onViewDetails,
  className
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (isLoading || schedule.completed) return;

    setIsLoading(true);
    try {
      await scheduleService.markCompleted(schedule.id);
      await onComplete(schedule.id);
    } catch (error) {
      console.error('Failed to mark task as completed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTaskType = (type: TaskType): string => {
    return type.toLowerCase().replace('_', ' ');
  };

  return (
    <Card 
      elevation={schedule.completed ? 1 : 2}
      className={className}
      role="article"
      ariaLabel={`${formatTaskType(schedule.taskType)} task ${schedule.completed ? 'completed' : 'pending'}`}
    >
      <CardContent>
        <TaskHeader>
          <TaskType>{formatTaskType(schedule.taskType)}</TaskType>
          <DueDate>
            Due: {format(new Date(schedule.dueDate), 'MMM d, yyyy')}
          </DueDate>
        </TaskHeader>

        <TaskStatus completed={schedule.completed}>
          {schedule.completed ? 'Completed' : 'Pending'}
        </TaskStatus>

        <ActionButtons>
          <Button
            onClick={() => onViewDetails(schedule)}
            variant="secondary"
            aria-label="View task details"
          >
            View Details
          </Button>
          <Button
            onClick={handleComplete}
            variant="primary"
            disabled={isLoading || schedule.completed}
            aria-label={schedule.completed ? 'Task completed' : 'Mark task as complete'}
          >
            {isLoading ? 'Updating...' : schedule.completed ? 'Completed' : 'Mark Complete'}
          </Button>
        </ActionButtons>
      </CardContent>
    </Card>
  );
};

export default ScheduleCard;