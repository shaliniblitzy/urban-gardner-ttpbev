import React from 'react';
import styled, { css } from 'styled-components';
import { theme } from '../../theme/colors';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
}

const getVariantStyles = (variant: ButtonProps['variant'] = 'primary') => {
  const { palette } = theme;

  switch (variant) {
    case 'primary':
      return css`
        background-color: ${palette.primary.base};
        color: #ffffff;

        &:hover:not(:disabled) {
          background-color: ${palette.primary.light};
        }

        &:active:not(:disabled) {
          background-color: ${palette.primary.dark};
        }
      `;

    case 'secondary':
      return css`
        background-color: ${palette.secondary.base};
        color: ${palette.text};

        &:hover:not(:disabled) {
          background-color: ${palette.secondary.light};
        }

        &:active:not(:disabled) {
          background-color: ${palette.secondary.dark};
        }
      `;

    case 'text':
      return css`
        background-color: transparent;
        color: ${palette.text};
        padding: 0;

        &:hover:not(:disabled) {
          background-color: rgba(0, 0, 0, 0.04);
        }

        &:active:not(:disabled) {
          background-color: rgba(0, 0, 0, 0.08);
        }
      `;

    default:
      return '';
  }
};

const getSizeStyles = (size: ButtonProps['size'] = 'medium') => {
  switch (size) {
    case 'small':
      return css`
        padding: 8px 16px;
        font-size: 14px;
        line-height: 1.4;
        min-height: 32px;

        @media (max-width: 375px) {
          padding: 6px 12px;
          font-size: 13px;
        }
      `;

    case 'large':
      return css`
        padding: 16px 32px;
        font-size: 18px;
        line-height: 1.5;
        min-height: 48px;

        @media (max-width: 375px) {
          padding: 12px 24px;
          font-size: 16px;
        }
      `;

    default: // medium
      return css`
        padding: 12px 24px;
        font-size: 16px;
        line-height: 1.5;
        min-height: 40px;

        @media (max-width: 375px) {
          padding: 8px 16px;
          font-size: 15px;
        }
      `;
  }
};

const StyledButton = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  outline: none;
  transition: all 0.2s ease-in-out;
  position: relative;
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  opacity: ${props => props.disabled ? 0.6 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
  white-space: nowrap;
  text-decoration: none;
  margin: 0;
  
  ${props => getVariantStyles(props.variant)}
  ${props => getSizeStyles(props.size)}

  &:focus-visible {
    outline: 2px solid ${theme.palette.primary.base};
    outline-offset: 2px;
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  ${props => props.loading && css`
    color: transparent;
    pointer-events: none;

    &::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-radius: 50%;
      border-right-color: transparent;
      animation: rotate 0.8s linear infinite;
    }

    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `}
`;

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  fullWidth = false,
  loading = false,
  onClick,
  type = 'button',
  className,
  style,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      loading={loading}
      onClick={onClick}
      type={type}
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      data-testid={dataTestId}
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default Button;