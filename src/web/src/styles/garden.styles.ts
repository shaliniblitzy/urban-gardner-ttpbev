import styled from 'styled-components';
import { theme } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { mediaQueries } from '../theme/breakpoints';

// Constants for grid layout calculations
const GRID_GAP = 8;
const MIN_ZONE_SIZE = 80;

/**
 * Calculates responsive grid dimensions based on garden area and screen size
 * @param area - Garden area in square feet
 * @param screenWidth - Current screen width
 * @param aspectRatio - Desired grid aspect ratio (width/height)
 * @returns Optimized grid dimensions
 */
const calculateGridDimensions = (
  area: number,
  screenWidth: number,
  aspectRatio = 1.5
): { columns: number; rows: number; cellSize: number } => {
  const baseSize = Math.sqrt(area);
  const maxColumns = Math.floor((screenWidth - GRID_GAP * 2) / MIN_ZONE_SIZE);
  const columns = Math.min(Math.ceil(baseSize * aspectRatio), maxColumns);
  const rows = Math.ceil(area / columns);
  const cellSize = Math.floor((screenWidth - (columns + 1) * GRID_GAP) / columns);

  return { columns, rows, cellSize };
};

export const GardenContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: ${spacing.medium};
  background-color: ${theme.palette.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;

  ${mediaQueries.small} {
    padding: ${spacing.small};
  }

  ${mediaQueries.large} {
    padding: ${spacing.large};
  }
`;

export const GardenGrid = styled.div<{ columns: number; rows: number; cellSize: number }>`
  display: grid;
  grid-template-columns: repeat(${props => props.columns}, ${props => props.cellSize}px);
  grid-template-rows: repeat(${props => props.rows}, ${props => props.cellSize}px);
  gap: ${GRID_GAP}px;
  margin: ${spacing.medium} 0;
  position: relative;

  ${mediaQueries.small} {
    gap: ${GRID_GAP / 2}px;
  }
`;

export const ZoneIndicator = styled.div<{ sunlightLevel: 'fullSun' | 'partialShade' | 'fullShade' }>`
  width: 100%;
  height: 100%;
  background-color: ${props => theme.garden.zones[props.sunlightLevel]};
  border-radius: 4px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;

  &:hover {
    transform: scale(1.02);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.1);
    border-radius: inherit;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover::before {
    opacity: 1;
  }
`;

export const PlantIndicator = styled.div<{
  plantType: string;
  status: 'healthy' | 'needsAttention' | 'critical';
}>`
  width: 100%;
  height: 100%;
  background-color: ${theme.palette.primary.base};
  border: 2px solid ${props => theme.garden.plantStatus[props.status]};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: ${theme.palette.background};
  font-weight: bold;
  transition: all 0.3s ease;
  position: relative;
  
  &::after {
    content: '${props => props.plantType.charAt(0).toUpperCase()}';
    position: absolute;
  }

  ${mediaQueries.medium} {
    font-size: 14px;
  }
`;

export const UtilizationBar = styled.div<{ percentage: number }>`
  width: 100%;
  height: 8px;
  background-color: ${theme.palette.background};
  border-radius: 4px;
  overflow: hidden;
  margin-top: ${spacing.medium};

  &::before {
    content: '';
    display: block;
    width: ${props => props.percentage}%;
    height: 100%;
    background-color: ${props => {
      if (props.percentage >= 90) return theme.garden.plantStatus.healthy;
      if (props.percentage >= 70) return theme.garden.plantStatus.needsAttention;
      return theme.garden.plantStatus.critical;
    }};
    transition: width 0.3s ease, background-color 0.3s ease;
  }
`;

export const LegendContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.small};
  margin-top: ${spacing.medium};
  padding: ${spacing.small};
  background-color: ${theme.palette.background};
  border-radius: 4px;

  ${mediaQueries.small} {
    flex-direction: column;
  }
`;

export const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.small};
  font-size: 12px;
  color: ${theme.palette.text};

  ${mediaQueries.medium} {
    font-size: 14px;
  }
`;

export const LegendColor = styled.div<{ color: string }>`
  width: 16px;
  height: 16px;
  background-color: ${props => props.color};
  border-radius: 4px;
`;