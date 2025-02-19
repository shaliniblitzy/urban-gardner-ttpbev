import styled from 'styled-components';
import { theme } from '../theme/colors';
import { spacing, getResponsiveSpacing } from '../theme/spacing';
import typography from '../theme/typography';

/**
 * Common container styles with garden-optimized max width and responsive padding
 * @version 1.0.0
 */
export const Container = styled.div`
  max-width: ${containerMaxWidth};
  margin: 0 auto;
  padding: ${getResponsiveSpacing('medium', {
    responsive: {
      small: 0.8,
      medium: 1,
      large: 1.2
    }
  })};
  width: 100%;
  box-sizing: border-box;
`;

/**
 * Garden zone visualization styles with status indicators
 * @version 1.0.0
 */
export const ZoneIndicator = styled.div<{ zoneType: 'fullSun' | 'partialShade' | 'fullShade' }>`
  background-color: ${({ zoneType }) => theme.garden.zones[zoneType]};
  border-radius: ${borderRadius.medium};
  padding: ${spacing.small};
  display: flex;
  align-items: center;
  gap: ${spacing.xsmall};
  
  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: currentColor;
  }
`;

/**
 * Enhanced card component with elevation and interactive states
 * @version 1.0.0
 */
export const Card = styled.div`
  background-color: ${theme.palette.background};
  border-radius: ${borderRadius.medium};
  padding: ${spacing.medium};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

/**
 * Button variants with garden theme colors
 * @version 1.0.0
 */
export const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'alert' }>`
  ${typography.button};
  padding: ${spacing.small} ${spacing.medium};
  border-radius: ${borderRadius.small};
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
  
  background-color: ${({ variant = 'primary' }) => theme.palette[variant].base};
  color: ${theme.palette.background};

  &:hover {
    background-color: ${({ variant = 'primary' }) => theme.palette[variant].dark};
  }

  &:disabled {
    background-color: ${({ variant = 'primary' }) => theme.palette[variant].light};
    cursor: not-allowed;
  }
`;

/**
 * Input field styles with accessibility considerations
 * @version 1.0.0
 */
export const Input = styled.input`
  ${typography.body1};
  padding: ${spacing.small};
  border: 1px solid ${theme.palette.secondary.light};
  border-radius: ${borderRadius.small};
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s ease-in-out;

  &:focus {
    outline: none;
    border-color: ${theme.palette.primary.base};
    box-shadow: 0 0 0 2px ${theme.palette.primary.light};
  }

  &::placeholder {
    color: ${theme.palette.text}80;
  }
`;

/**
 * Responsive grid system for garden layouts
 * @version 1.0.0
 */
export const Grid = styled.div<{ columns?: number; gap?: keyof typeof spacing }>`
  display: grid;
  grid-template-columns: repeat(${({ columns = 1 }) => columns}, 1fr);
  gap: ${({ gap = 'medium' }) => spacing[gap]};
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

/**
 * Plant status indicator with health state colors
 * @version 1.0.0
 */
export const PlantStatus = styled.div<{ status: 'healthy' | 'needsAttention' | 'critical' }>`
  display: inline-flex;
  align-items: center;
  padding: ${spacing.xsmall} ${spacing.small};
  border-radius: ${borderRadius.small};
  background-color: ${({ status }) => theme.garden.plantStatus[status]}20;
  color: ${({ status }) => theme.garden.plantStatus[status]};
  ${typography.caption};
`;

/**
 * Creates responsive style variations with garden-specific features
 * @param baseStyles - Base style object
 * @param options - Configuration options
 */
export const createResponsiveStyles = (
  baseStyles: Record<string, any>,
  options: {
    small?: Record<string, any>;
    medium?: Record<string, any>;
    large?: Record<string, any>;
    rtl?: boolean;
  } = {}
) => {
  const { small, medium, large, rtl } = options;

  return {
    ...baseStyles,
    ...(small && {
      '@media (max-width: 375px)': small
    }),
    ...(medium && {
      '@media (min-width: 376px) and (max-width: 768px)': medium
    }),
    ...(large && {
      '@media (min-width: 769px)': large
    }),
    ...(rtl && {
      direction: 'rtl'
    })
  };
};

// Global constants
const containerMaxWidth = '1200px';
const borderRadius = {
  small: '4px',
  medium: '8px',
  large: '12px'
} as const;