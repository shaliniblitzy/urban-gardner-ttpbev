import styled, { css } from 'styled-components';
import { breakpoints } from '../theme/breakpoints';

// Types for component props
interface ContainerProps {
  maxWidth?: string | number;
  padding?: string | number;
  printMode?: boolean;
}

interface GridProps {
  columns?: number | { [key: string]: number };
  gap?: string | number;
  alignItems?: string;
  justifyContent?: string;
}

// Responsive container component with print support
export const ResponsiveContainer = styled.div<ContainerProps>`
  display: grid;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;

  /* Responsive padding */
  padding: ${({ padding = '16px' }) => padding};
  @media screen and (min-width: ${breakpoints.medium}px) {
    padding: ${({ padding = '24px' }) => 
      typeof padding === 'number' ? `${padding * 1.5}px` : '24px'
    };
  }
  @media screen and (min-width: ${breakpoints.large}px) {
    padding: ${({ padding = '32px' }) => 
      typeof padding === 'number' ? `${padding * 2}px` : '32px'
    };
  }

  /* Max width constraints */
  max-width: ${({ maxWidth = '100%' }) => 
    typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth
  };

  /* Print styles */
  @media print {
    ${({ printMode }) => printMode && css`
      padding: 0;
      max-width: 100%;
      width: 100%;
    `}
  }
`;

// Responsive grid component with flexible layouts
export const ResponsiveGrid = styled.div<GridProps>`
  display: grid;
  width: 100%;
  box-sizing: border-box;

  /* Responsive grid columns */
  grid-template-columns: ${({ columns = 1 }) => 
    typeof columns === 'number' 
      ? `repeat(1, 1fr)`
      : `repeat(${columns.small || 1}, 1fr)`
  };

  @media screen and (min-width: ${breakpoints.medium}px) {
    grid-template-columns: ${({ columns = 1 }) =>
      typeof columns === 'number'
        ? `repeat(${Math.min(2, columns)}, 1fr)`
        : `repeat(${columns.medium || 2}, 1fr)`
    };
  }

  @media screen and (min-width: ${breakpoints.large}px) {
    grid-template-columns: ${({ columns = 1 }) =>
      typeof columns === 'number'
        ? `repeat(${columns}, 1fr)`
        : `repeat(${columns.large || columns}, 1fr)`
    };
  }

  /* Responsive gap spacing */
  gap: ${({ gap = '16px' }) => 
    typeof gap === 'number' ? `${gap}px` : gap
  };

  @media screen and (min-width: ${breakpoints.medium}px) {
    gap: ${({ gap = '24px' }) =>
      typeof gap === 'number' ? `${gap * 1.5}px` : '24px'
    };
  }

  @media screen and (min-width: ${breakpoints.large}px) {
    gap: ${({ gap = '32px' }) =>
      typeof gap === 'number' ? `${gap * 2}px` : '32px'
    };
  }

  /* Grid alignment */
  align-items: ${({ alignItems = 'start' }) => alignItems};
  justify-content: ${({ justifyContent = 'start' }) => justifyContent};
`;

// Common responsive style mixins
export const responsiveStyles = {
  // Flex column layout
  flexColumn: css`
    display: flex;
    flex-direction: column;
  `,

  // Flex row layout
  flexRow: css`
    display: flex;
    flex-direction: row;
  `,

  // Hide on mobile screens
  hideOnMobile: css`
    @media screen and (max-width: ${breakpoints.small - 0.02}px) {
      display: none;
    }
  `,

  // Show only on mobile screens
  showOnMobile: css`
    @media screen and (min-width: ${breakpoints.small}px) {
      display: none;
    }
  `,

  // Optimized touch target sizing
  touchTarget: css`
    min-height: 44px;
    min-width: 44px;
    
    @media screen and (min-width: ${breakpoints.medium}px) {
      min-height: 40px;
      min-width: 40px;
    }
  `,

  // Print visibility control
  printHide: css`
    @media print {
      display: none;
    }
  `,

  // Print-only display
  printOnly: css`
    @media screen {
      display: none;
    }
    @media print {
      display: block;
    }
  `
};