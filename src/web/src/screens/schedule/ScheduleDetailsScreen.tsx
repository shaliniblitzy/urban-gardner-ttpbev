import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { format } from 'date-fns';
import * as Sentry from '@sentry/react';
import { ErrorBoundary } from '@sentry/react';

import { Schedule, TaskType } from '../../types/schedule.types';
import { scheduleService } from '../../services/schedule.service';

// Styled components with accessibility and responsive design
const Container = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  max-width: 800px;
  margin: 0 auto;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;

const DetailSection = styled.section`
  background-color: ${({ theme }) => theme.colors.background.secondary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Header = styled.h1`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-size: 1.5rem;
`;

const TaskInfo = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Label = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const ProgressBar = styled.div<{ progress: number }>`
  width: 100%;
  height: 8px;
  background-color: ${({ theme }) => theme.colors.background.tertiary};
  border-radius: 4px;
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${({ progress }) => `${progress}%`};
    height: 100%;
    background-color: ${({ theme }) => theme.colors.primary.main};
    transition: width 0.3s ease-in-out;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: column;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  background-color: ${({ theme, variant }) => 
    variant === 'primary' ? theme.colors.primary.main : theme.colors.background.tertiary};
  color: ${({ theme, variant }) => 
    variant === 'primary' ? theme.colors.text.inverse : theme.colors.text.primary};

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error.main};
  padding: ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.error.light};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

interface ScheduleDetailsProps {
  onUpdate?: (schedule: Schedule) => void;
}

const ScheduleDetailsScreen: React.FC<ScheduleDetailsProps> = ({ onUpdate }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch schedule details
  useEffect(() => {
    const fetchSchedule = async () => {
      const transaction = Sentry.startTransaction({ name: 'fetchScheduleDetails' });
      
      try {
        setIsLoading(true);
        setError(null);
        const response = await scheduleService.getSchedules({ id: id });
        setSchedule(response[0]);
      } catch (err) {
        setError('Failed to load schedule details. Please try again.');
        Sentry.captureException(err);
      } finally {
        setIsLoading(false);
        transaction.finish();
      }
    };

    if (id) {
      fetchSchedule();
    }
  }, [id]);

  const handleMarkComplete = useCallback(async () => {
    if (!schedule?.id) return;

    try {
      setError(null);
      const updatedSchedule = await scheduleService.markCompleted(schedule.id);
      setSchedule(updatedSchedule);
      onUpdate?.(updatedSchedule);
    } catch (err) {
      if (isOffline) {
        scheduleService.queueOfflineAction('update', { id: schedule.id, completed: true });
        setSchedule({ ...schedule, completed: true });
      } else {
        setError('Failed to mark task as complete. Please try again.');
        Sentry.captureException(err);
      }
    }
  }, [schedule, isOffline, onUpdate]);

  const handlePostpone = useCallback(async () => {
    if (!schedule?.id) return;

    try {
      setError(null);
      const newDate = new Date(schedule.dueDate);
      newDate.setDate(newDate.getDate() + 1);
      
      const updatedSchedule = await scheduleService.updateSchedule(schedule.id, {
        dueDate: newDate
      });
      setSchedule(updatedSchedule);
      onUpdate?.(updatedSchedule);
    } catch (err) {
      if (isOffline) {
        const newDate = new Date(schedule.dueDate);
        newDate.setDate(newDate.getDate() + 1);
        scheduleService.queueOfflineAction('update', { id: schedule.id, dueDate: newDate });
        setSchedule({ ...schedule, dueDate: newDate });
      } else {
        setError('Failed to postpone task. Please try again.');
        Sentry.captureException(err);
      }
    }
  }, [schedule, isOffline, onUpdate]);

  if (isLoading) {
    return (
      <Container role="status" aria-label="Loading schedule details">
        <DetailSection>Loading...</DetailSection>
      </Container>
    );
  }

  if (!schedule) {
    return (
      <Container role="alert">
        <ErrorMessage>Schedule not found</ErrorMessage>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </Container>
    );
  }

  return (
    <ErrorBoundary fallback={<ErrorMessage>Something went wrong</ErrorMessage>}>
      <Container role="main" aria-labelledby="schedule-title">
        {isOffline && (
          <ErrorMessage role="alert">
            You are currently offline. Changes will be synchronized when you're back online.
          </ErrorMessage>
        )}
        
        {error && (
          <ErrorMessage role="alert">
            {error}
          </ErrorMessage>
        )}

        <Header id="schedule-title">
          Task Details
        </Header>

        <DetailSection>
          <TaskInfo>
            <Label>Type:</Label>
            <span>{TaskType[schedule.taskType]}</span>
            
            <Label>Due Date:</Label>
            <span>{format(new Date(schedule.dueDate), 'PPP')}</span>
            
            <Label>Status:</Label>
            <span>{schedule.completed ? 'Completed' : 'Pending'}</span>
            
            <Label>Progress:</Label>
            <ProgressBar 
              progress={schedule.progress || 0}
              role="progressbar"
              aria-valuenow={schedule.progress || 0}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </TaskInfo>

          <ButtonGroup>
            <Button
              variant="primary"
              onClick={handleMarkComplete}
              disabled={schedule.completed}
              aria-disabled={schedule.completed}
            >
              Mark as Complete
            </Button>
            <Button
              onClick={handlePostpone}
              disabled={schedule.completed}
              aria-disabled={schedule.completed}
            >
              Postpone
            </Button>
            <Button onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </ButtonGroup>
        </DetailSection>
      </Container>
    </ErrorBoundary>
  );
};

export default ScheduleDetailsScreen;