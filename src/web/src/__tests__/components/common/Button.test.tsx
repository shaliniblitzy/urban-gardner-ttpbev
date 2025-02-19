import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import '@testing-library/jest-dom';

import Button, { ButtonProps } from '../../../components/common/Button';
import { theme } from '../../../theme/colors';

// Helper function to render components with theme
const renderWithTheme = (ui: React.ReactNode, options = {}) => {
  const user = userEvent.setup();
  return {
    user,
    ...render(
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>,
      options
    ),
  };
};

describe('Button Component', () => {
  it('renders with default props', () => {
    renderWithTheme(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveStyle(`
      background-color: ${theme.palette.primary.base}
      color: #ffffff
    `);
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass(/medium/);
  });

  it('renders different variants correctly', () => {
    const { rerender } = renderWithTheme(
      <Button variant="primary">Primary</Button>
    );
    
    let button = screen.getByRole('button');
    expect(button).toHaveStyle(`background-color: ${theme.palette.primary.base}`);

    rerender(
      <ThemeProvider theme={theme}>
        <Button variant="secondary">Secondary</Button>
      </ThemeProvider>
    );
    button = screen.getByRole('button');
    expect(button).toHaveStyle(`background-color: ${theme.palette.secondary.base}`);

    rerender(
      <ThemeProvider theme={theme}>
        <Button variant="text">Text</Button>
      </ThemeProvider>
    );
    button = screen.getByRole('button');
    expect(button).toHaveStyle('background-color: transparent');
  });

  it('handles different sizes responsively', () => {
    const { rerender } = renderWithTheme(
      <Button size="small">Small</Button>
    );

    let button = screen.getByRole('button');
    expect(button).toHaveStyle(`
      padding: 8px 16px
      font-size: 14px
    `);

    rerender(
      <ThemeProvider theme={theme}>
        <Button size="medium">Medium</Button>
      </ThemeProvider>
    );
    button = screen.getByRole('button');
    expect(button).toHaveStyle(`
      padding: 12px 24px
      font-size: 16px
    `);

    rerender(
      <ThemeProvider theme={theme}>
        <Button size="large">Large</Button>
      </ThemeProvider>
    );
    button = screen.getByRole('button');
    expect(button).toHaveStyle(`
      padding: 16px 32px
      font-size: 18px
    `);
  });

  it('handles interactions correctly', async () => {
    const handleClick = jest.fn();
    const { user } = renderWithTheme(
      <Button onClick={handleClick}>Click me</Button>
    );

    const button = screen.getByRole('button');
    
    // Mouse click
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    // Keyboard interactions
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(2);

    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(3);
  });

  it('handles loading state', async () => {
    const handleClick = jest.fn();
    const { user } = renderWithTheme(
      <Button loading onClick={handleClick}>Loading</Button>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveStyle('pointer-events: none');
    
    // Verify loading indicator
    expect(button).toHaveStyle(`
      color: transparent
      position: relative
    `);

    // Attempt interaction during loading
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('handles disabled state', async () => {
    const handleClick = jest.fn();
    const { user } = renderWithTheme(
      <Button disabled onClick={handleClick}>Disabled</Button>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveStyle('opacity: 0.6');
    
    // Attempt interaction when disabled
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies fullWidth prop correctly', () => {
    const { rerender } = renderWithTheme(
      <Button fullWidth>Full Width</Button>
    );

    let button = screen.getByRole('button');
    expect(button).toHaveStyle('width: 100%');

    rerender(
      <ThemeProvider theme={theme}>
        <Button>Normal Width</Button>
      </ThemeProvider>
    );
    button = screen.getByRole('button');
    expect(button).toHaveStyle('width: auto');
  });

  it('maintains accessibility standards', () => {
    renderWithTheme(
      <Button aria-label="Accessible Button">
        Click me
      </Button>
    );

    const button = screen.getByRole('button');
    
    // ARIA attributes
    expect(button).toHaveAttribute('aria-label', 'Accessible Button');
    expect(button).toHaveAttribute('role', 'button');
    
    // Focus handling
    button.focus();
    expect(button).toHaveFocus();
    
    // Tab navigation
    expect(button).not.toHaveAttribute('tabindex', '-1');
  });

  it('accepts and applies custom className and style', () => {
    renderWithTheme(
      <Button 
        className="custom-class"
        style={{ margin: '10px' }}
      >
        Styled Button
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveStyle('margin: 10px');
  });

  it('handles custom data-testid attribute', () => {
    renderWithTheme(
      <Button data-testid="custom-button">
        Test Button
      </Button>
    );

    expect(screen.getByTestId('custom-button')).toBeInTheDocument();
  });
});