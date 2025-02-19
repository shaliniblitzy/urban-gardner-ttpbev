import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Input from '../../../components/common/Input';
import { validateGardenArea } from '../../../utils/validation.utils';
import { ThemeProvider } from 'styled-components';
import { theme } from '../../../theme/colors';

// Mock the validation utility
jest.mock('../../../utils/validation.utils', () => ({
  validateGardenArea: jest.fn()
}));

// Mock window.matchMedia for responsive design testing
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

const renderInput = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <Input
        value=""
        onChange={() => {}}
        {...props}
      />
    </ThemeProvider>
  );
};

describe('Input Component', () => {
  const mockOnChange = jest.fn();
  const mockOnBlur = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with required props', () => {
      renderInput({ value: '', onChange: mockOnChange });
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should apply responsive styles based on screen size', () => {
      // Mock small screen
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '@media screen and (max-width: 375px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }));

      const { container } = renderInput({ value: '', onChange: mockOnChange });
      const inputContainer = container.firstChild;
      expect(inputContainer).toHaveStyle({ marginBottom: '1.25rem' });
    });

    it('should show error state styling when error is provided', () => {
      const { container } = renderInput({
        value: '',
        onChange: mockOnChange,
        error: 'Invalid input'
      });
      const errorMessage = screen.getByText('Invalid input');
      expect(errorMessage).toBeInTheDocument();
      expect(container.firstChild).toHaveStyle({ marginBottom: '1.5rem' });
    });
  });

  describe('Garden Area Validation', () => {
    beforeEach(() => {
      (validateGardenArea as jest.Mock).mockImplementation((value) => ({
        isValid: Number(value) >= 1 && Number(value) <= 1000,
        errors: []
      }));
    });

    it('should validate numeric input', async () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        type: 'number',
        inputMode: 'numeric'
      });

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'abc');
      expect(input).toHaveValue('');
    });

    it('should enforce area range constraints', async () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        type: 'number',
        min: 1,
        max: 1000
      });

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '1001');
      
      await waitFor(() => {
        expect(validateGardenArea).toHaveBeenCalledWith('1001');
      });
    });

    it('should limit decimal precision to 2 places', async () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        type: 'number'
      });

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '100.999');
      expect(input).toHaveValue('100.99');
    });

    it('should prevent special characters', async () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        type: 'number'
      });

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '100@#$');
      expect(input).toHaveValue('100');
    });
  });

  describe('Event Handling', () => {
    it('should call onChange with validated value', async () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        type: 'number'
      });

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '100');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('100', true);
      });
    });

    it('should call onBlur with validated value', async () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        onBlur: mockOnBlur,
        type: 'number'
      });

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '100');
      fireEvent.blur(input);

      expect(mockOnBlur).toHaveBeenCalled();
    });

    it('should debounce validation on input change', async () => {
      jest.useFakeTimers();
      
      renderInput({
        value: '',
        onChange: mockOnChange,
        type: 'number'
      });

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '100');

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(validateGardenArea).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        ariaLabel: 'Garden area input',
        required: true
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Garden area input');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should update aria-invalid on error', () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        error: 'Invalid input'
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should associate error message with input', () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        error: 'Invalid input'
      });

      const input = screen.getByRole('textbox');
      const errorId = input.getAttribute('aria-errormessage');
      const errorMessage = screen.getByText('Invalid input');
      expect(errorMessage.id).toBe(errorId);
    });

    it('should handle keyboard navigation', async () => {
      renderInput({
        value: '',
        onChange: mockOnChange,
        type: 'number'
      });

      const input = screen.getByRole('textbox');
      input.focus();
      expect(document.activeElement).toBe(input);

      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).not.toBe(input);
    });
  });
});