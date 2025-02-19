import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import debounce from 'lodash/debounce';

import { useNotifications } from '../../hooks/useNotifications';
import NotificationPreferences from '../../components/schedule/NotificationPreferences';
import { Loading } from '../../components/common/Loading';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

// Styled components with responsive design and accessibility
const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.large};
  gap: ${({ theme }) => theme.spacing.medium};
  background-color: ${({ theme }) => theme.palette.background};
  min-height: 100vh;

  @media (max-width: ${({ theme }) => theme.breakpoints.medium}px) {
    padding: ${({ theme }) => theme.spacing.medium};
  }
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.large};

  @media (max-width: ${({ theme }) => theme.breakpoints.small}px) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.small};
  }
`;

const Title = styled.h1`
  ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.palette.text};
  margin: 0;
`;

const Section = styled.section`
  background-color: ${({ theme }) => theme.palette.background};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  padding: ${({ theme }) => theme.spacing.medium};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const PermissionButton = styled.button<{ $hasPermission: boolean }>`
  ${({ theme }) => theme.typography.button};
  padding: ${({ theme }) => theme.spacing.small} ${({ theme }) => theme.spacing.medium};
  background-color: ${({ theme, $hasPermission }) => 
    $hasPermission ? theme.palette.secondary.base : theme.palette.primary.base};
  color: ${({ theme }) => theme.palette.background};
  border: none;
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;

  &:hover:not(:disabled) {
    background-color: ${({ theme, $hasPermission }) => 
      $hasPermission ? theme.palette.secondary.dark : theme.palette.primary.dark};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.palette.primary.light};
  }
`;

const StatusMessage = styled.div<{ $isError?: boolean }>`
  ${({ theme }) => theme.typography.body2};
  color: ${({ theme, $isError }) => 
    $isError ? theme.palette.alert.base : theme.palette.primary.base};
  padding: ${({ theme }) => theme.spacing.small};
  margin-top: ${({ theme }) => theme.spacing.small};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  background-color: ${({ theme, $isError }) => 
    $isError ? `${theme.palette.alert.light}20` : `${theme.palette.primary.light}20`};
`;

interface NotificationSettingsScreenProps {
  navigation: any; // NavigationProp type would be defined in your navigation setup
}

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ navigation }) => {
  const { 
    permissionStatus, 
    preferences, 
    requestPermission, 
    updatePreferences 
  } = useNotifications();

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Handle permission request with error handling and retry logic
  const handlePermissionRequest = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatusMessage(null);

      const result = await requestPermission();
      
      if (result === 'granted') {
        setStatusMessage({
          text: 'Notification permissions granted successfully',
          isError: false
        });
      } else {
        setStatusMessage({
          text: 'Permission denied. Please enable notifications in your browser settings',
          isError: true
        });
      }
    } catch (error) {
      setStatusMessage({
        text: 'Failed to request notification permissions. Please try again',
        isError: true
      });
      console.error('Permission request error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [requestPermission]);

  // Handle preferences update with debouncing
  const handlePreferencesUpdate = useCallback(
    debounce(async (newPreferences) => {
      try {
        setStatusMessage(null);
        await updatePreferences(newPreferences);
        setStatusMessage({
          text: 'Preferences updated successfully',
          isError: false
        });
      } catch (error) {
        setStatusMessage({
          text: 'Failed to update preferences. Please try again',
          isError: true
        });
        console.error('Preferences update error:', error);
      }
    }, 300),
    [updatePreferences]
  );

  return (
    <ErrorBoundary>
      <Container>
        <Header>
          <Title>Notification Settings</Title>
          <PermissionButton
            onClick={handlePermissionRequest}
            disabled={isLoading || permissionStatus === 'granted'}
            $hasPermission={permissionStatus === 'granted'}
            aria-label={
              permissionStatus === 'granted' 
                ? 'Notifications enabled' 
                : 'Enable notifications'
            }
          >
            {permissionStatus === 'granted' 
              ? 'Notifications Enabled' 
              : 'Enable Notifications'}
          </PermissionButton>
        </Header>

        {isLoading ? (
          <Loading 
            size="medium" 
            ariaLabel="Loading notification settings" 
          />
        ) : (
          <Section 
            role="region" 
            aria-label="Notification preferences"
          >
            <NotificationPreferences
              ariaLabel="Notification preferences form"
              ariaDescribedBy={statusMessage ? 'status-message' : undefined}
            />
          </Section>
        )}

        {statusMessage && (
          <StatusMessage
            id="status-message"
            role="status"
            aria-live="polite"
            $isError={statusMessage.isError}
          >
            {statusMessage.text}
          </StatusMessage>
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default NotificationSettingsScreen;