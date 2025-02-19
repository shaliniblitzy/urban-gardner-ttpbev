import React from 'react';
import styled from 'styled-components';
import { commonStyles } from '../../styles/common.styles';
import { theme } from '../../theme/colors';
import { getResponsiveSpacing } from '../../theme/spacing';

/**
 * Props interface for the Card component with enhanced customization options
 */
interface CardProps {
  /** Content to be rendered inside the card */
  children: React.ReactNode;
  /** Elevation level affecting shadow depth (1-5) */
  elevation?: number;
  /** Padding size variant */
  padding?: 'small' | 'medium' | 'large';
  /** Optional CSS class name for additional styling */
  className?: string;
  /** Optional click handler for interactive cards */
  onClick?: () => void;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** ARIA role for semantic meaning */
  role?: string;
}

/**
 * Calculates shadow based on elevation level
 * @param elevation - Number between 1-5 representing shadow depth
 */
const getShadowStyle = (elevation: number): string => {
  const validElevation = Math.max(1, Math.min(5, elevation));
  const shadowOpacity = 0.1 + (validElevation - 1) * 0.05;
  const shadowBlur = 4 + (validElevation - 1) * 4;
  const shadowSpread = validElevation - 1;
  
  return `0 ${validElevation * 2}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity}), 
          0 ${validElevation}px ${shadowSpread}px rgba(0, 0, 0, ${shadowOpacity * 0.5})`;
};

const StyledCard = styled.div<{
  $elevation: number;
  $padding: CardProps['padding'];
  $isClickable: boolean;
}>`
  background-color: ${theme.palette.background};
  border-radius: ${commonStyles.card.borderRadius};
  padding: ${props => getResponsiveSpacing(props.$padding || 'medium')};
  box-shadow: ${props => getShadowStyle(props.$elevation)};
  transition: box-shadow 0.3s ease-in-out, transform 0.2s ease-in-out;
  position: relative;
  overflow: hidden;
  cursor: ${props => props.$isClickable ? 'pointer' : 'default'};

  &:focus-visible {
    outline: 2px solid ${theme.palette.primary.base};
    outline-offset: 2px;
  }

  ${props => props.$isClickable && `
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${getShadowStyle(props.$elevation + 1)};
    }

    &:active {
      transform: translateY(0);
      box-shadow: ${getShadowStyle(props.$elevation)};
    }
  `}
`;

/**
 * A styled container component that provides elevation, responsive padding,
 * and accessibility features for content display.
 *
 * @version 1.0.0
 */
const Card: React.FC<CardProps> = ({
  children,
  elevation = 1,
  padding = 'medium',
  className,
  onClick,
  ariaLabel,
  role = 'region',
  ...props
}) => {
  // Keyboard interaction handler for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <StyledCard
      $elevation={elevation}
      $padding={padding}
      $isClickable={!!onClick}
      className={className}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={role}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {children}
    </StyledCard>
  );
};

export default Card;