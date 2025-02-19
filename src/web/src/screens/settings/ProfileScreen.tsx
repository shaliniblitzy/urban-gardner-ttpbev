import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { StorageService } from '../../services/storage.service';
import { mediaQueries } from '../../theme/breakpoints';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// Enhanced interface for user preferences with validation
interface UserPreferences {
  name: string;
  email: string;
  pushNotifications: boolean;
  emailNotifications: boolean;
  preferredTimeZone: string;
}

// Loading states for async operations
interface LoadingStates {
  saving: boolean;
  loading: boolean;
}

// Styled components with accessibility enhancements
const ProfileContainer = styled.div`
  padding: ${spacing.large};
  max-width: 600px;
  margin: 0 auto;
  
  ${mediaQueries.smallOnly} {
    padding: ${spacing.medium};
  }
`;

const FormSection = styled.div`
  margin-bottom: ${spacing.large};
`;

const Title = styled.h1`
  ${typography.h1};
  margin-bottom: ${spacing.medium};
  color: ${({ theme }) => theme.palette.text};
`;

const Label = styled.label`
  ${typography.body2};
  display: block;
  margin-bottom: ${spacing.xsmall};
  color: ${({ theme }) => theme.palette.text};
`;

const NotificationToggle = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.small};
  margin-bottom: ${spacing.medium};
`;

const ErrorMessage = styled.div`
  ${typography.caption};
  color: ${({ theme }) => theme.palette.alert.base};
  margin-top: ${spacing.xsmall};
`;

const LoadingSpinner = styled.div`
  margin: ${spacing.medium} auto;
  width: 24px;
  height: 24px;
  border: 2px solid ${({ theme }) => theme.palette.primary.light};
  border-top-color: ${({ theme }) => theme.palette.primary.base};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const ProfileScreen: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    name: '',
    email: '',
    pushNotifications: true,
    emailNotifications: true,
    preferredTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    saving: false,
    loading: true
  });

  const [error, setError] = useState<string>('');

  const storageService = new StorageService();

  // Load user preferences with decryption
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedPreferences = await storageService.getUserPreferences();
        if (storedPreferences) {
          setPreferences(storedPreferences);
        }
      } catch (err) {
        setError('Failed to load preferences');
        console.error('Preference loading error:', err);
      } finally {
        setLoadingStates(prev => ({ ...prev, loading: false }));
      }
    };

    loadPreferences();
  }, []);

  // Validate email format
  const validateEmail = useCallback((email: string): boolean => {
    return EMAIL_REGEX.test(email);
  }, []);

  // Handle input changes with validation
  const handleInputChange = useCallback((field: keyof UserPreferences, value: string | boolean) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
    setError('');
  }, []);

  // Save preferences with encryption and validation
  const handleSavePreferences = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, saving: true }));
      setError('');

      // Validate email before saving
      if (!validateEmail(preferences.email)) {
        setError('Please enter a valid email address');
        return;
      }

      // Encrypt and save preferences
      await storageService.saveUserPreferences(preferences);

    } catch (err) {
      setError('Failed to save preferences');
      console.error('Preference saving error:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, saving: false }));
    }
  };

  if (loadingStates.loading) {
    return (
      <ProfileContainer>
        <LoadingSpinner role="status" aria-label="Loading profile settings" />
      </ProfileContainer>
    );
  }

  return (
    <ProfileContainer role="form" aria-labelledby="profile-settings-title">
      <Title id="profile-settings-title">Profile Settings</Title>

      <FormSection>
        <Label htmlFor="name">Name</Label>
        <Input
          value={preferences.name}
          onChange={(value) => handleInputChange('name', value)}
          placeholder="Enter your name"
          aria-label="Name"
          required
        />

        <Label htmlFor="email">Email</Label>
        <Input
          value={preferences.email}
          onChange={(value) => handleInputChange('email', value)}
          placeholder="Enter your email"
          aria-label="Email"
          type="email"
          required
          error={error}
        />
      </FormSection>

      <FormSection role="group" aria-labelledby="notification-settings">
        <Title as="h2" id="notification-settings">Notification Settings</Title>

        <NotificationToggle>
          <input
            type="checkbox"
            id="pushNotifications"
            checked={preferences.pushNotifications}
            onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
            aria-label="Enable push notifications"
          />
          <Label htmlFor="pushNotifications">Enable Push Notifications</Label>
        </NotificationToggle>

        <NotificationToggle>
          <input
            type="checkbox"
            id="emailNotifications"
            checked={preferences.emailNotifications}
            onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
            aria-label="Enable email notifications"
          />
          <Label htmlFor="emailNotifications">Enable Email Notifications</Label>
        </NotificationToggle>
      </FormSection>

      <Button
        onClick={handleSavePreferences}
        disabled={loadingStates.saving}
        aria-busy={loadingStates.saving}
        variant="primary"
        fullWidth
      >
        {loadingStates.saving ? 'Saving...' : 'Save Preferences'}
      </Button>

      {error && (
        <ErrorMessage role="alert" aria-live="polite">
          {error}
        </ErrorMessage>
      )}
    </ProfileContainer>
  );
};

export default ProfileScreen;