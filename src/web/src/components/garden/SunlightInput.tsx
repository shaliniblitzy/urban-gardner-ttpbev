import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Input } from '../common/Input';
import { SunlightCondition } from '../../types/zone.types';
import { SUNLIGHT_REQUIREMENTS } from '../../constants/garden';

/**
 * Props interface for the SunlightInput component
 * @version 1.0.0
 */
interface SunlightInputProps {
  /** Current sunlight condition value */
  value: SunlightCondition;
  /** Callback function when sunlight condition changes */
  onChange: (condition: SunlightCondition) => void;
  /** Optional error message to display */
  error?: string;
  /** Optional zone identifier */
  zoneId?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Accessibility label */
  ariaLabel?: string;
  /** Test identifier for testing */
  testId?: string;
}

/**
 * Styled select component with garden theme integration
 */
const StyledSelect = styled.select`
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.secondary.light};
  background-color: ${({ theme }) => theme.palette.background};
  color: ${({ theme }) => theme.palette.text};
  font-size: ${({ theme }) => theme.typography.body1.fontSize};
  cursor: pointer;
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
 * Styled container for the sunlight input component
 */
const SunlightInputContainer = styled.div`
  position: relative;
  width: 100%;
`;

/**
 * Helper text displaying sunlight hours range
 */
const SunlightHoursText = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.typography.caption.fontSize};
  color: ${({ theme }) => theme.palette.text}80;
  margin-top: 4px;
`;

/**
 * SunlightInput component for selecting and managing sunlight conditions
 * Implements requirement F-001-RQ-002: Specify sunlight conditions
 * @version 1.0.0
 */
export const SunlightInput: React.FC<SunlightInputProps> = ({
  value,
  onChange,
  error,
  zoneId,
  disabled = false,
  ariaLabel = 'Sunlight condition',
  testId = 'sunlight-input',
}) => {
  /**
   * Handles changes in sunlight condition selection
   */
  const handleSunlightChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value as SunlightCondition;
      onChange(newValue);
    },
    [onChange]
  );

  /**
   * Generates select options for sunlight conditions
   */
  const sunlightOptions = useMemo(() => {
    return Object.values(SunlightCondition).map((condition) => {
      const requirements = SUNLIGHT_REQUIREMENTS[condition];
      const label = condition
        .replace('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

      return (
        <option key={condition} value={condition}>
          {label}
        </option>
      );
    });
  }, []);

  /**
   * Gets the current sunlight hours range text
   */
  const sunlightHoursText = useMemo(() => {
    const requirements = SUNLIGHT_REQUIREMENTS[value];
    return `${requirements.min}-${requirements.max} hours of direct sunlight per day`;
  }, [value]);

  const selectId = `sunlight-select-${zoneId || 'default'}`;
  const errorId = `${selectId}-error`;

  return (
    <SunlightInputContainer>
      <StyledSelect
        id={selectId}
        value={value}
        onChange={handleSunlightChange}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        aria-errormessage={error ? errorId : undefined}
        data-testid={testId}
      >
        {sunlightOptions}
      </StyledSelect>
      <SunlightHoursText>
        {sunlightHoursText}
      </SunlightHoursText>
      {error && (
        <Input
          value={error}
          onChange={() => {}}
          error={error}
          aria-live="polite"
          disabled
        />
      )}
    </SunlightInputContainer>
  );
};

export default SunlightInput;