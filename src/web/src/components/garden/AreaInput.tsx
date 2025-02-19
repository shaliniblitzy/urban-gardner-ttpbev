import React, { useCallback, useState, useRef } from 'react';
import styled from 'styled-components';
import { debounce } from 'lodash/debounce';
import { Input } from '../common/Input';
import { validateGardenArea } from '../../utils/validation.utils';
import { mediaQueries } from '../../theme/breakpoints';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * Props interface for the AreaInput component
 */
interface AreaInputProps {
  value: number;
  onChange: (area: number) => void;
  error?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
}

/**
 * Styled container for the area input with responsive design
 */
const StyledAreaInput = styled.div`
  position: relative;
  width: 100%;
  margin-bottom: ${spacing.medium};

  ${mediaQueries.smallOnly} {
    width: 100%;
    margin-bottom: ${spacing.large};
  }

  ${mediaQueries.mediumOnly} {
    width: 90%;
    margin-bottom: ${spacing.medium};
  }

  ${mediaQueries.large} {
    width: 80%;
    max-width: 400px;
    margin-bottom: ${spacing.medium};
  }
`;

/**
 * Styled error message with accessibility support
 */
const ErrorMessage = styled.span`
  ${typography.caption};
  color: ${({ theme }) => theme.palette.alert.base};
  position: absolute;
  bottom: -${spacing.small};
  left: 0;
  opacity: 0.9;
  transition: opacity 0.2s ease-in-out;
`;

/**
 * AreaInput component for capturing and validating garden area dimensions
 * Implements comprehensive validation rules and responsive design
 * @version 1.0.0
 */
export const AreaInput: React.FC<AreaInputProps> = ({
  value,
  onChange,
  error,
  className,
  id = 'garden-area-input',
  ariaLabel = 'Garden area in square feet',
  placeholder = 'Enter garden area (1-1000 sq ft)'
}) => {
  const [localError, setLocalError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced validation handler
  const debouncedValidate = useCallback(
    debounce((value: string) => {
      const validationResult = validateGardenArea(value);
      setLocalError(validationResult.errors[0] || '');
      
      if (validationResult.isValid) {
        onChange(Number(value));
      }
    }, 300),
    [onChange]
  );

  // Handle input changes with validation
  const handleAreaChange = useCallback((newValue: string) => {
    // Remove non-numeric characters except decimal point
    const sanitizedValue = newValue.replace(/[^\d.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitizedValue.split('.');
    if (parts.length > 2) return;
    
    // Limit to 2 decimal places
    if (parts[1]?.length > 2) return;
    
    debouncedValidate(sanitizedValue);
  }, [debouncedValidate]);

  // Handle blur event with final validation
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    const validationResult = validateGardenArea(event.target.value);
    setLocalError(validationResult.errors[0] || '');
    
    // Format to 2 decimal places if valid
    if (validationResult.isValid) {
      const formattedValue = Number(event.target.value).toFixed(2);
      onChange(Number(formattedValue));
    }
  }, [onChange]);

  return (
    <StyledAreaInput className={className}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleAreaChange}
        onBlur={handleBlur}
        error={error || localError}
        type="number"
        min={1}
        max={1000}
        step={0.01}
        placeholder={placeholder}
        aria-label={ariaLabel}
        id={id}
        inputMode="decimal"
        required
      />
      {(error || localError) && (
        <ErrorMessage
          role="alert"
          aria-live="polite"
        >
          {error || localError}
        </ErrorMessage>
      )}
    </StyledAreaInput>
  );
};

export default AreaInput;