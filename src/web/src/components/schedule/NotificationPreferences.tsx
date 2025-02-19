import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import debounce from 'lodash/debounce';

import { useNotifications } from '../../hooks/useNotifications';
import { NotificationType } from '../../types/notification.types';
import { Select } from '../common/Select';
import { ErrorBoundary } from '../common/ErrorBoundary';

// Time options for reminder time selection
const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return [
    { value: `${hour}:00`, label: `${hour}:00` },
    { value: `${hour}:30`, label: `${hour}:30` }
  ];
}).flat();

interface NotificationPreferencesProps {
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing(1)};
    gap: ${({ theme }) => theme.spacing(1)};
  }
`;

const PreferenceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 48px;
  padding: ${({ theme }) => theme.spacing(1)} 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing(1)};
  }
`;

const Label = styled.span`
  color: ${({ theme }) => theme.palette.text.primary};
  font-size: ${({ theme }) => theme.typography.body1.fontSize};
  font-weight: ${({ theme }) => theme.typography.fontWeightMedium};
  user-select: none;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.palette.error.main};
  font-size: ${({ theme }) => theme.typography.caption.fontSize};
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  role: alert;
`;

const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  className,
  ariaLabel = 'Notification Preferences',
  ariaDescribedBy
}) => {
  const { preferences, updatePreferences } = useNotifications();
  const [error, setError] = useState<string | null>(null);

  // Handle reminder time change with debouncing
  const handleTimeChange = useCallback(
    debounce(async (time: string) => {
      try {
        // Validate time format
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          throw new Error('Invalid time format');
        }

        await updatePreferences({
          ...preferences,
          reminderTime: time
        });

        setError(null);

        // Announce change to screen readers
        const announcement = `Reminder time updated to ${time}`;
        const ariaLive = document.createElement('div');
        ariaLive.setAttribute('aria-live', 'polite');
        ariaLive.textContent = announcement;
        document.body.appendChild(ariaLive);
        setTimeout(() => document.body.removeChild(ariaLive), 1000);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update reminder time');
        console.error('Error updating reminder time:', err);
      }
    }, 300),
    [preferences, updatePreferences]
  );

  // Handle notification type toggle with debouncing
  const handleToggleChange = useCallback(
    debounce(async (type: NotificationType, value: boolean) => {
      try {
        const updatedTypes = value
          ? [...(preferences.enabledTypes || []), type]
          : (preferences.enabledTypes || []).filter(t => t !== type);

        await updatePreferences({
          ...preferences,
          enabledTypes: updatedTypes
        });

        setError(null);

        // Announce change to screen readers
        const announcement = `${type} notifications ${value ? 'enabled' : 'disabled'}`;
        const ariaLive = document.createElement('div');
        ariaLive.setAttribute('aria-live', 'polite');
        ariaLive.textContent = announcement;
        document.body.appendChild(ariaLive);
        setTimeout(() => document.body.removeChild(ariaLive), 1000);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update notification preferences');
        console.error('Error updating notification preferences:', err);
      }
    }, 300),
    [preferences, updatePreferences]
  );

  return (
    <ErrorBoundary>
      <Container
        className={className}
        role="region"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      >
        <PreferenceRow>
          <Label>Daily Reminder Time</Label>
          <Select
            id="reminder-time"
            name="reminderTime"
            value={preferences.reminderTime}
            label="Select reminder time"
            options={TIME_OPTIONS}
            onChange={handleTimeChange}
            aria-label="Select daily reminder time"
          />
        </PreferenceRow>

        <PreferenceRow>
          <Label>Maintenance Reminders</Label>
          <input
            type="checkbox"
            id="maintenance-notifications"
            checked={preferences.enabledTypes?.includes(NotificationType.MAINTENANCE_REMINDER)}
            onChange={(e) => handleToggleChange(NotificationType.MAINTENANCE_REMINDER, e.target.checked)}
            aria-label="Enable maintenance reminders"
          />
        </PreferenceRow>

        <PreferenceRow>
          <Label>Watering Schedule</Label>
          <input
            type="checkbox"
            id="watering-notifications"
            checked={preferences.enabledTypes?.includes(NotificationType.WATERING_SCHEDULE)}
            onChange={(e) => handleToggleChange(NotificationType.WATERING_SCHEDULE, e.target.checked)}
            aria-label="Enable watering schedule notifications"
          />
        </PreferenceRow>

        <PreferenceRow>
          <Label>Fertilizer Reminders</Label>
          <input
            type="checkbox"
            id="fertilizer-notifications"
            checked={preferences.enabledTypes?.includes(NotificationType.FERTILIZER_REMINDER)}
            onChange={(e) => handleToggleChange(NotificationType.FERTILIZER_REMINDER, e.target.checked)}
            aria-label="Enable fertilizer reminders"
          />
        </PreferenceRow>

        {error && (
          <ErrorMessage role="alert">
            {error}
          </ErrorMessage>
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default NotificationPreferences;