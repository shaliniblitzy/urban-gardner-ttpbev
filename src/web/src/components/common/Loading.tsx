import React, { memo } from 'react';
import styled, { keyframes } from 'styled-components';
import { theme } from '../../theme/colors';

// Constants for spinner configuration
const SPINNER_SIZES = {
  small: '24px',
  medium: '48px',
  large: '64px'
} as const;

const ANIMATION_DURATION = '1.2s';
const ANIMATION_TIMING = 'cubic-bezier(0.5, 0, 0.5, 1)';

// Component interfaces
interface LoadingProps {
  size?: keyof typeof SPINNER_SIZES;
  color?: string;
  overlay?: boolean;
  ariaLabel?: string;
}

interface StyledSpinnerProps {
  size: string;
  color: string;
}

interface LoadingOverlayProps {
  isVisible: boolean;
}

// Spinner animation keyframes
const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Styled components
const LoadingOverlay = styled.div<LoadingOverlayProps>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(245, 245, 245, 0.8);
  display: ${({ isVisible }) => (isVisible ? 'flex' : 'none')};
  justify-content: center;
  align-items: center;
  z-index: ${theme.zIndex?.overlay || 1000};
`;

const SpinnerContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Spinner = styled.div<StyledSpinnerProps>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  border: 2px solid ${({ color }) => `${color}40`};
  border-top: 2px solid ${({ color }) => color};
  border-radius: 50%;
  animation: ${rotate} ${ANIMATION_DURATION} ${ANIMATION_TIMING} infinite;
`;

// Utility functions
const getSpinnerSize = memo((size?: keyof typeof SPINNER_SIZES): string => {
  if (!size || !SPINNER_SIZES[size]) {
    return SPINNER_SIZES.medium;
  }
  return SPINNER_SIZES[size];
});

const validateColor = memo((color?: string): string => {
  if (!color) {
    return theme.palette.primary.base;
  }
  
  // Basic color validation regex
  const isValidColor = /^(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\(.*\)|rgba\(.*\))$/.test(color);
  return isValidColor ? color : theme.palette.primary.base;
});

/**
 * Loading component that provides visual feedback during asynchronous operations
 * @param {LoadingProps} props - Component properties
 * @returns {JSX.Element} - Rendered loading spinner
 * @version 1.0.0
 */
export const Loading: React.FC<LoadingProps> = memo(({
  size = 'medium',
  color,
  overlay = false,
  ariaLabel = 'Loading content'
}) => {
  const spinnerSize = getSpinnerSize(size);
  const spinnerColor = validateColor(color);

  const spinnerElement = (
    <SpinnerContainer>
      <Spinner
        size={spinnerSize}
        color={spinnerColor}
        role="progressbar"
        aria-label={ariaLabel}
        aria-busy="true"
      />
    </SpinnerContainer>
  );

  if (overlay) {
    return (
      <LoadingOverlay isVisible={true}>
        {spinnerElement}
      </LoadingOverlay>
    );
  }

  return spinnerElement;
});

Loading.displayName = 'Loading';

export default Loading;