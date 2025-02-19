import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { useNotifications } from '../../hooks/useNotifications';
import { StorageService } from '../../services/storage.service';
import { NotificationType, NotificationPreferences } from '../../types/notification.types';
import { spacing } from '../../theme/spacing';
import { mediaQueries } from '../../theme/breakpoints';
import { typography } from '../../theme/typography';

// Styled components with responsive design
const SettingsContainer = styled.div`
  padding: ${spacing.medium};
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${spacing.large};

  ${mediaQueries.small} {
    padding: ${spacing.small};
  }
`;

const Section = styled.section`
  background: ${({ theme }) => theme.palette.background};
  border-radius: 8px;
  padding: ${spacing.medium};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: ${spacing.large};
`;

const SectionTitle = styled.h2`
  ${typography.h2};
  color: ${({ theme }) => theme.palette.text};
  margin-bottom: ${spacing.medium};
`;

const PreferenceItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.small};
  margin-bottom: ${spacing.medium};
`;

const PreferenceLabel = styled.label`
  ${typography.body1};
  flex: 1;
`;

const StorageInfo = styled.div`
  ${typography.body2};
  color: ${({ theme }) => theme.palette.text};
  margin-top: ${spacing.small};
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.palette.alert.base};
  ${typography.caption};
  margin-top: ${spacing.xsmall};
`;

const SettingsScreen: React.FC = () => {
  // Hooks and state
  const {
    preferences,
    updatePreferences,
    permissionStatus,
    requestPermission,
    isLoading,
    error: notificationError
  } = useNotifications();

  const [storageInfo, setStorageInfo] = useState<{
    usedSpace: number;
    availableSpace: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load storage information
  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        const info = await StorageService.getInstance().getStorageInfo();
        setStorageInfo({
          usedSpace: info.usedSpace,
          availableSpace: info.availableSpace
        });
      } catch (err) {
        setError('Failed to load storage information');
      }
    };

    loadStorageInfo();
  }, []);

  // Notification preference handlers
  const handleNotificationToggle = useCallback(async () => {
    try {
      if (!preferences.enabled && permissionStatus !== 'granted') {
        const permission = await requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied');
        }
      }

      await updatePreferences({
        ...preferences,
        enabled: !preferences.enabled
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
    }
  }, [preferences, permissionStatus, requestPermission, updatePreferences]);

  const handleReminderTimeChange = useCallback(async (time: string) => {
    try {
      await updatePreferences({
        ...preferences,
        reminderTime: time
      });
    } catch (err) {
      setError('Failed to update reminder time');
    }
  }, [preferences, updatePreferences]);

  // Storage management handlers
  const handleClearData = useCallback(async () => {
    try {
      await StorageService.getInstance().clearAllData();
      setStorageInfo({
        usedSpace: 0,
        availableSpace: 500 * 1024 * 1024 // 500MB
      });
    } catch (err) {
      setError('Failed to clear data');
    }
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      const data = await StorageService.getInstance().exportData();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garden-planner-backup-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export data');
    }
  }, []);

  return (
    <SettingsContainer>
      <Section>
        <SectionTitle>Notification Preferences</SectionTitle>
        <PreferenceItem>
          <PreferenceLabel htmlFor="notifications-toggle">
            Enable Notifications
          </PreferenceLabel>
          <Button
            id="notifications-toggle"
            onClick={handleNotificationToggle}
            disabled={isLoading}
            variant={preferences.enabled ? 'primary' : 'secondary'}
            aria-pressed={preferences.enabled}
          >
            {preferences.enabled ? 'Enabled' : 'Disabled'}
          </Button>
        </PreferenceItem>

        <PreferenceItem>
          <PreferenceLabel htmlFor="reminder-time">
            Daily Reminder Time
          </PreferenceLabel>
          <Select
            id="reminder-time"
            name="reminder-time"
            value={preferences.reminderTime}
            onChange={(value) => handleReminderTimeChange(value)}
            disabled={!preferences.enabled}
            options={Array.from({ length: 24 }, (_, i) => ({
              value: `${i.toString().padStart(2, '0')}:00`,
              label: `${i.toString().padStart(2, '0')}:00`
            }))}
            aria-label="Select daily reminder time"
          />
        </PreferenceItem>

        {notificationError && (
          <ErrorMessage role="alert">{notificationError.message}</ErrorMessage>
        )}
      </Section>

      <Section>
        <SectionTitle>Data Management</SectionTitle>
        {storageInfo && (
          <StorageInfo>
            Storage Used: {Math.round(storageInfo.usedSpace / 1024 / 1024)}MB of{' '}
            {Math.round(storageInfo.availableSpace / 1024 / 1024)}MB
          </StorageInfo>
        )}

        <PreferenceItem>
          <Button
            onClick={handleExportData}
            variant="secondary"
            aria-label="Export garden data"
          >
            Export Data
          </Button>
          <Button
            onClick={handleClearData}
            variant="alert"
            aria-label="Clear all garden data"
          >
            Clear Data
          </Button>
        </PreferenceItem>

        {error && <ErrorMessage role="alert">{error}</ErrorMessage>}
      </Section>
    </SettingsContainer>
  );
};

export default SettingsScreen;