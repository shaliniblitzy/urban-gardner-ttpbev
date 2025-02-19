import React from 'react';
import styled from 'styled-components';
import { commonStyles } from '../../styles/common.styles';
import { theme } from '../../theme/colors';
import typography from '../../theme/typography';

interface SelectProps {
  id: string;
  name: string;
  value: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: boolean;
  errorMessage?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const SelectContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  position: relative;
`;

const Label = styled.label<{ disabled?: boolean }>`
  ${typography.body1};
  color: ${theme.palette.text};
  margin-bottom: 4px;
  
  ${({ disabled }) => disabled && `
    opacity: 0.6;
  `}
`;

const StyledSelect = styled.select<{ error?: boolean }>`
  ${commonStyles.input};
  appearance: none;
  padding-right: 32px;
  background-image: url("data:image/svg+xml;utf8,<svg fill='%23212121' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 8px center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:focus {
    outline: none;
    border-color: ${theme.palette.primary.base};
    box-shadow: 0 0 0 2px ${theme.palette.primary.light};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: ${theme.palette.background};
  }

  ${({ error }) => error && `
    border-color: ${theme.palette.alert.base};
    &:focus {
      border-color: ${theme.palette.alert.base};
      box-shadow: 0 0 0 2px ${theme.palette.alert.light};
    }
  `}

  @media (hover: none) {
    cursor: default;
  }
`;

const ErrorMessage = styled.span`
  color: ${theme.palette.alert.base};
  font-size: 12px;
  margin-top: 4px;
`;

export const Select: React.FC<SelectProps> = ({
  id,
  name,
  value,
  label,
  options,
  onChange,
  disabled = false,
  placeholder,
  error = false,
  errorMessage,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    const newValue = event.target.value;
    onChange(newValue);
  };

  const selectId = id || name;
  const errorId = `${selectId}-error`;
  const hasError = error && errorMessage;

  return (
    <SelectContainer>
      <Label 
        htmlFor={selectId}
        disabled={disabled}
      >
        {label}
      </Label>
      <StyledSelect
        id={selectId}
        name={name}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        error={error}
        aria-label={ariaLabel}
        aria-invalid={error}
        aria-describedby={hasError ? `${ariaDescribedBy} ${errorId}` : ariaDescribedBy}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map(({ value: optionValue, label: optionLabel }) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </StyledSelect>
      {hasError && (
        <ErrorMessage 
          id={errorId}
          role="alert"
          aria-live="polite"
        >
          {errorMessage}
        </ErrorMessage>
      )}
    </SelectContainer>
  );
};