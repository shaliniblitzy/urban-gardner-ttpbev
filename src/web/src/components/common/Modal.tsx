import React, { useEffect, useCallback, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Portal } from 'react-portal'; // ^4.2.0
import FocusTrap from 'focus-trap-react'; // ^9.0.0
import Button from './Button';
import { theme } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { mediaQueries } from '../../theme/breakpoints';
import typography from '../../theme/typography';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideIn = keyframes`
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

interface ModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  style?: React.CSSProperties;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
  role?: string;
}

const ModalOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 0.2s ease-in-out;
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const getModalWidth = (size: ModalProps['size'] = 'medium') => {
  switch (size) {
    case 'small':
      return css`
        width: 90%;
        max-width: 400px;
        ${mediaQueries.medium} {
          width: 400px;
        }
      `;
    case 'large':
      return css`
        width: 95%;
        max-width: 800px;
        ${mediaQueries.medium} {
          width: 800px;
        }
      `;
    default:
      return css`
        width: 90%;
        max-width: 600px;
        ${mediaQueries.medium} {
          width: 600px;
        }
      `;
  }
};

const ModalContent = styled.div<{ size: ModalProps['size'] }>`
  background: ${theme.palette.background};
  border-radius: 8px;
  padding: ${spacing.large};
  position: relative;
  max-height: 90vh;
  overflow-y: auto;
  ${props => getModalWidth(props.size)}
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: ${slideIn} 0.3s ease-out;
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  
  ${mediaQueries.smallOnly} {
    padding: ${spacing.medium};
    width: 95%;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.medium};
  padding-bottom: ${spacing.small};
  border-bottom: 1px solid ${theme.palette.secondary.light};
`;

const ModalTitle = styled.h2`
  ${typography.h3};
  margin: 0;
  color: ${theme.palette.text};
`;

const Modal: React.FC<ModalProps> = ({
  children,
  isOpen,
  onClose,
  title,
  showCloseButton = true,
  size = 'medium',
  className,
  style,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  closeOnEscape = true,
  closeOnOverlayClick = true,
  initialFocus,
  role = 'dialog',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = ariaLabelledBy || 'modal-title';
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && closeOnEscape) {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <Portal>
      <FocusTrap
        focusTrapOptions={{
          initialFocus: initialFocus?.current || undefined,
          escapeDeactivates: closeOnEscape,
          allowOutsideClick: true,
        }}
      >
        <ModalOverlay
          isOpen={isOpen}
          onClick={handleOverlayClick}
          data-testid="modal-overlay"
        >
          <ModalContent
            ref={contentRef}
            size={size}
            className={className}
            style={style}
            role={role}
            aria-labelledby={titleId}
            aria-describedby={ariaDescribedBy}
            aria-modal="true"
            data-testid="modal-content"
          >
            {(title || showCloseButton) && (
              <ModalHeader>
                {title && (
                  <ModalTitle id={titleId}>
                    {title}
                  </ModalTitle>
                )}
                {showCloseButton && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={onClose}
                    aria-label="Close modal"
                    data-testid="modal-close-button"
                  >
                    ✕
                  </Button>
                )}
              </ModalHeader>
            )}
            {children}
          </ModalContent>
        </ModalOverlay>
      </FocusTrap>
    </Portal>
  );
};

export default Modal;
export type { ModalProps };