import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import TaskList from '../../components/schedule/TaskList';
import ScheduleCard from '../../components/schedule/ScheduleCard';
import { useSchedule } from '../../hooks/useSchedule';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { usePerformanceMonitor } from '@gardening/monitoring';
import { theme } from '../../theme';
import { Schedule, ScheduleFilter } from '../../types/schedule.types';

// Styled Components
const ScreenContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${theme.spacing.large};
  
  @media (max-width: ${theme.breakpoints.medium}px) {
    padding: ${theme.spacing.medium};
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.large};
  flex-wrap: wrap;
  gap: ${theme.spacing.medium};
`;

const Title = styled.h1`
  ${theme.typography.h1};
  color: ${theme.colors.palette.text};
  margin: 0;
`;

const StatusBar = styled.div<{ isOffline: boolean }>`
  display: flex;
  align-items: center;
  padding: ${theme.spacing.small};
  background-color: ${({ isOffline }) => 
    isOffline ? theme.colors.palette.alert.light : theme.colors.palette.secondary.light}20;
  border-radius: 4px;
  margin-bottom: ${theme.spacing.medium};
`;

const StatusText = styled.span`
  ${theme.typography.body2};
  color: ${theme.colors.palette.text};
  margin-left: ${theme.spacing.small};
`;

const FilterContainer = styled.div`
  display: flex;
  gap: ${theme.spacing.medium};
  flex-wrap: wrap;
  margin-bottom: ${theme.spacing.medium};
  
  @media (max-width: ${theme.breakpoints.medium}px) {
    flex-direction: column;
  }
`;

const RetryButton = styled.button`
  ${theme.typography.button};
  padding: ${theme.spacing.small} ${theme.spacing.medium};
  background-color: ${theme.colors.palette.primary.base};
  color: ${theme.colors.palette.background};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover:not(:disabled) {
    background-color: ${theme.colors.palette.primary.dark};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ScheduleListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ScheduleFilter>({});
  const performance = usePerformanceMonitor('ScheduleListScreen');
  
  const {
    schedules,
    loading,
    error,
    updateSchedule,
    isOffline,
    syncStatus,
    retryOperation
  } = useSchedule('default-garden-id'); // TODO: Get actual garden ID from context/store

  // Handle task selection with performance tracking
  const handleTaskSelect = useCallback((schedule: Schedule) => {
    performance.trackEvent('task_select');
    navigate(`/schedule/${schedule.id}`);
  }, [navigate, performance]);

  // Handle filter changes with debouncing
  const handleFilterChange = useCallback((newFilter: ScheduleFilter) => {
    performance.trackEvent('filter_change');
    setFilter(newFilter);
  }, [performance]);

  // Handle sync retry
  const handleSyncRetry = useCallback(async () => {
    performance.trackEvent('sync_retry');
    try {
      await retryOperation('sync');
    } catch (error) {
      console.error('Sync retry failed:', error);
    }
  }, [retryOperation, performance]);

  // Monitor performance metrics
  useEffect(() => {
    performance.trackMetric('schedules_count', schedules.length);
    performance.trackMetric('loading_state', loading ? 1 : 0);
  }, [schedules.length, loading, performance]);

  return (
    <ErrorBoundary>
      <ScreenContainer>
        <Header>
          <Title>Maintenance Schedule</Title>
          {isOffline && (
            <StatusBar isOffline={true}>
              <StatusText>
                Working Offline - Changes will sync when connection is restored
              </StatusText>
            </StatusBar>
          )}
        </Header>

        {syncStatus?.status === 'error' && (
          <StatusBar isOffline={false}>
            <StatusText>Sync failed - Some changes may not be saved</StatusText>
            <RetryButton 
              onClick={handleSyncRetry}
              disabled={loading}
              aria-label="Retry synchronization"
            >
              Retry Sync
            </RetryButton>
          </StatusBar>
        )}

        <FilterContainer>
          {/* Filter controls would go here */}
        </FilterContainer>

        <TaskList
          gardenId="default-garden-id" // TODO: Get actual garden ID
          filter={filter}
          onTaskSelect={handleTaskSelect}
          offlineSupport={true}
          retryOnError={true}
          virtualizeList={true}
        />

        {syncStatus?.pendingChanges > 0 && (
          <StatusBar isOffline={false}>
            <StatusText>
              {syncStatus.pendingChanges} changes pending synchronization
            </StatusText>
          </StatusBar>
        )}
      </ScreenContainer>
    </ErrorBoundary>
  );
};

export default ScheduleListScreen;