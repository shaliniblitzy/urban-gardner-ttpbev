import React from 'react';
import styled from 'styled-components';
import * as Sentry from '@sentry/react';
import { Loading } from './Loading';
import { theme } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import typography from '../../theme/typography';

// Default retry configuration
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 5000; // 5 seconds

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
  retryAttempts?: number;
  retryDelay?: number;
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
}

const ErrorContainer = styled.div<{ fullScreen?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${spacing.large};
  text-align: center;
  min-height: ${props => props.fullScreen ? '100vh' : 'auto'};
  background-color: ${theme.palette.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  ${props => props.fullScreen && `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    z-index: 1000;
  `}

  @media (max-width: 768px) {
    padding: ${spacing.medium};
  }
`;

const ErrorMessage = styled.p`
  ${typography.body1};
  color: ${theme.palette.alert.base};
  margin: ${spacing.medium} 0;
  font-weight: ${typography.h3.fontWeight};
  line-height: 1.5;

  @media (max-width: 768px) {
    font-size: ${typography.body2.fontSize};
  }
`;

const ErrorCode = styled.code`
  ${typography.caption};
  color: ${theme.palette.secondary.base};
  font-family: monospace;
  margin: ${spacing.small} 0;
  display: block;
`;

const RetryButton = styled.button`
  ${typography.button};
  padding: ${spacing.small} ${spacing.medium};
  background-color: ${theme.palette.primary.base};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: ${spacing.medium};
  transition: background-color 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${theme.palette.primary.dark};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${theme.palette.primary.light};
  }
`;

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Report error to Sentry with additional context
    Sentry.withScope((scope) => {
      scope.setExtra('componentStack', errorInfo.componentStack);
      scope.setExtra('retryCount', this.state.retryCount);
      Sentry.captureException(error);
    });

    // Call onError prop if provided
    this.props.onError?.(error);
  }

  handleRetry = async (): Promise<void> => {
    const { retryAttempts = DEFAULT_RETRY_ATTEMPTS, retryDelay = DEFAULT_RETRY_DELAY } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= retryAttempts) {
      return;
    }

    this.setState({ isRetrying: true });

    // Calculate exponential backoff delay
    const backoffDelay = Math.min(
      retryDelay * Math.pow(2, retryCount),
      MAX_RETRY_DELAY
    );

    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, backoffDelay));

    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
      isRetrying: false
    }));
  };

  render(): React.ReactNode {
    const { children, fallback, fullScreen } = this.props;
    const { hasError, error, retryCount, isRetrying } = this.state;
    const { retryAttempts = DEFAULT_RETRY_ATTEMPTS } = this.props;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      return fallback;
    }

    return (
      <ErrorContainer 
        fullScreen={fullScreen}
        role="alert"
        aria-live="polite"
      >
        <ErrorMessage>
          An error occurred while rendering this component
        </ErrorMessage>
        <ErrorCode>
          {error?.message || 'Unknown error'}
        </ErrorCode>
        {isRetrying ? (
          <Loading size="small" color={theme.palette.primary.base} />
        ) : (
          <RetryButton
            onClick={this.handleRetry}
            disabled={retryCount >= retryAttempts}
            aria-disabled={retryCount >= retryAttempts}
          >
            {retryCount >= retryAttempts
              ? 'Maximum retry attempts reached'
              : 'Retry'}
          </RetryButton>
        )}
      </ErrorContainer>
    );
  }
}

export default ErrorBoundary;