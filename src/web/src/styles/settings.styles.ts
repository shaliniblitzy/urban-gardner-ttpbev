import styled from 'styled-components';
import { theme } from '../../theme/colors';
import { getResponsiveSpacing } from '../../theme/spacing';
import typography from '../../theme/typography';

/**
 * Main container for the settings screen
 * Implements responsive padding and max-width constraints
 */
export const SettingsContainer = styled.div`
  background-color: ${theme.palette.background};
  min-height: 100vh;
  padding: ${getResponsiveSpacing('medium', {
    responsive: {
      small: 0.8,
      medium: 1,
      large: 1.2
    }
  })};
  max-width: 1200px;
  margin: 0 auto;
  
  @media (max-width: 375px) {
    padding: ${getResponsiveSpacing('small')};
  }
`;

/**
 * Container for individual settings sections
 * Provides consistent spacing and visual separation
 */
export const SettingsSection = styled.section`
  background-color: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: ${getResponsiveSpacing('large')};
  padding: ${getResponsiveSpacing('medium')};
  
  @media (max-width: 375px) {
    border-radius: 4px;
    padding: ${getResponsiveSpacing('small')};
  }
`;

/**
 * Section title component with proper typography and spacing
 */
export const SectionTitle = styled.h2`
  color: ${theme.palette.text};
  font-family: ${typography.h2.fontFamily};
  font-size: ${typography.h2.fontSize};
  font-weight: ${typography.h2.fontWeight};
  line-height: ${typography.h2.lineHeight};
  margin-bottom: ${getResponsiveSpacing('medium')};
`;

/**
 * Form group container for organizing form elements
 * Implements consistent spacing and responsive layout
 */
export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${getResponsiveSpacing('small')};
  margin-bottom: ${getResponsiveSpacing('medium')};
  
  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    gap: ${getResponsiveSpacing('medium')};
  }
`;

/**
 * Label component for form elements
 * Ensures proper typography and accessibility
 */
export const SettingsLabel = styled.label`
  color: ${theme.palette.text};
  font-family: ${typography.body1.fontFamily};
  font-size: ${typography.body1.fontSize};
  font-weight: ${typography.body1.fontWeight};
  line-height: ${typography.body1.lineHeight};
  min-width: 200px;
  
  @media (max-width: 768px) {
    min-width: auto;
  }
`;

/**
 * Button component for settings actions
 * Implements theme colors and interactive states
 */
export const SettingsButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  background-color: ${props => 
    props.variant === 'secondary' 
      ? theme.palette.secondary.base 
      : theme.palette.primary.base};
  color: #FFFFFF;
  font-family: ${typography.button.fontFamily};
  font-size: ${typography.button.fontSize};
  font-weight: ${typography.button.fontWeight};
  padding: ${getResponsiveSpacing('small')} ${getResponsiveSpacing('medium')};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${props => 
      props.variant === 'secondary' 
        ? theme.palette.secondary.dark 
        : theme.palette.primary.dark};
  }
  
  &:active {
    background-color: ${props => 
      props.variant === 'secondary' 
        ? theme.palette.secondary.light 
        : theme.palette.primary.light};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 375px) {
    width: 100%;
  }
`;

/**
 * Select input component for settings
 * Implements theme-consistent styling
 */
export const SettingsSelect = styled.select`
  background-color: #FFFFFF;
  border: 1px solid ${theme.palette.secondary.light};
  border-radius: 4px;
  color: ${theme.palette.text};
  font-family: ${typography.body1.fontFamily};
  font-size: ${typography.body1.fontSize};
  padding: ${getResponsiveSpacing('small')};
  width: 100%;
  max-width: 300px;
  
  &:focus {
    border-color: ${theme.palette.primary.base};
    outline: none;
  }
  
  @media (max-width: 768px) {
    max-width: none;
  }
`;

/**
 * Checkbox container for settings options
 * Ensures proper alignment and spacing
 */
export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${getResponsiveSpacing('xsmall')};
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
`;

/**
 * Error message component for settings validation
 */
export const ErrorMessage = styled.span`
  color: ${theme.palette.alert.base};
  font-family: ${typography.caption.fontFamily};
  font-size: ${typography.caption.fontSize};
  margin-top: ${getResponsiveSpacing('xxsmall')};
`;