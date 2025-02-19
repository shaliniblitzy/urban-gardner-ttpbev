import React, { useCallback, useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { debounce } from 'lodash';
import { validateGardenArea } from '../../utils/validation.utils';
import { commonStyles } from '../../styles/common.styles';

/**
 * Interface for Input component props with comprehensive type support
 * @version 1.0.0
 */
interface InputProps {
  value: string | number;
  onChange: (value: string, isValid: boolean) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  validate?: (value: string) => { isValid: boolean; error?: string };
  ariaLabel?: string;
  inputMode?: 'numeric' | 'text' | 'decimal';
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Styled input container with responsive design support
 */
const InputContainer = styled.div`
  position: relative;
  width: 100%;
  margin-bottom: ${({ hasError }: { hasError: boolean }) => hasError ? '1.5rem' : '1rem'};

  @media (max-width: 375px) {
    margin-bottom: ${({ hasError }: { hasError: boolean }) => hasError ? '2rem' : '1.25rem'};
  }
`;

/**
 * Styled input element with garden theme integration
 */
const StyledInput = styled.input`
  ${commonStyles.input};
  width: 100%;
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.palette.primary.base};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.palette.primary.light}40;
  }

  &:disabled {
    background-color: ${({ theme }) => theme.palette.background}80;
    cursor: not-allowed;
  }

  &[aria-invalid="true"] {
    border-color: ${({ theme }) => theme.palette.alert.base};
  }
`;

/**
 * Styled error message with accessibility support
 */
const ErrorMessage = styled.span`
  ${commonStyles.errorText};
  position: absolute;
  bottom: -1.25rem;
  left: 0;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.palette.alert.base};
`;

/**
 * Enhanced input component with validation and accessibility support
 * @version 1.0.0
 */
export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  type = 'text',
  validate,
  ariaLabel,
  inputMode,
  min,
  max,
  step,
  required = false,
  disabled = false,
}) => {
  const [localError, setLocalError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = `${inputRef.current?.id || 'input'}-error`;

  // Initialize validation function based on input type
  const getValidationFunction = useCallback(() => {
    if (validate) return validate;
    if (type === 'number') return validateGardenArea;
    return undefined;
  }, [type, validate]);

  // Debounced validation handler
  const debouncedValidate = useCallback(
    debounce((value: string) => {
      const validationFn = getValidationFunction();
      if (!validationFn) return;

      const result = validationFn(value);
      setLocalError(result.errors?.[0] || '');
      onChange(value, result.isValid);
    }, 300),
    [getValidationFunction, onChange]
  );

  // Handle input changes with validation
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      
      // Handle numeric input formatting
      if (type === 'number') {
        const numericValue = newValue.replace(/[^\d.]/g, '');
        const parts = numericValue.split('.');
        if (parts.length > 2) return; // Prevent multiple decimal points
        if (parts[1]?.length > 2) return; // Limit to 2 decimal places
        event.target.value = numericValue;
      }

      debouncedValidate(newValue);
    },
    [type, debouncedValidate]
  );

  // Handle blur events with immediate validation
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      const validationFn = getValidationFunction();
      if (validationFn) {
        const result = validationFn(event.target.value);
        setLocalError(result.errors?.[0] || '');
      }
      onBlur?.(event);
    },
    [getValidationFunction, onBlur]
  );

  // Update ARIA attributes when error state changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setAttribute('aria-invalid', (!!error || !!localError).toString());
    }
  }, [error, localError]);

  return (
    <InputContainer hasError={!!error || !!localError}>
      <StyledInput
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        type={type}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-required={required}
        aria-invalid={!!error || !!localError}
        aria-errormessage={errorId}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
      />
      {(error || localError) && (
        <ErrorMessage
          id={errorId}
          role="alert"
        >
          {error || localError}
        </ErrorMessage>
      )}
    </InputContainer>
  );
};

export default Input;