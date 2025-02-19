import React, { useEffect, useMemo, useCallback } from 'react';
import { useWindowSize } from 'react-use'; // ^17.4.0
import {
  Garden,
  GardenZone,
  GardenLayout,
  PlantStatus
} from '../../types/garden.types';
import {
  calculateSpaceUtilization,
  formatGardenDimensions
} from '../../utils/garden.utils';
import {
  GardenContainer,
  GardenGrid as StyledGrid,
  ZoneIndicator,
  PlantIndicator,
  UtilizationBar,
  LegendContainer,
  LegendItem,
  LegendColor
} from '../../styles/garden.styles';
import { theme } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface GardenGridProps {
  layout: GardenLayout;
  onZoneClick?: (zone: GardenZone, event: React.SyntheticEvent) => void;
  isEditable?: boolean;
  accessibilityLabel?: string;
  showPlantStatus?: boolean;
}

/**
 * Interactive garden grid visualization component
 * Displays optimized garden layout with zones, plants, and space utilization
 * @version 1.0.0
 */
export const GardenGrid: React.FC<GardenGridProps> = ({
  layout,
  onZoneClick,
  isEditable = false,
  accessibilityLabel = 'Garden Layout Grid',
  showPlantStatus = true,
}) => {
  const { width: windowWidth } = useWindowSize();

  // Calculate grid dimensions based on window size and garden area
  const gridDimensions = useMemo(() => {
    const totalArea = layout.zones.reduce((sum, zone) => sum + zone.area, 0);
    const aspectRatio = windowWidth >= 768 ? 1.6 : 1.2;
    const columns = Math.ceil(Math.sqrt(totalArea * aspectRatio));
    const rows = Math.ceil(totalArea / columns);
    const cellSize = Math.floor((windowWidth - 32) / columns);

    return { columns, rows, cellSize };
  }, [layout.zones, windowWidth]);

  // Calculate space utilization metrics
  const utilization = useMemo(() => 
    calculateSpaceUtilization(layout),
    [layout]
  );

  // Handle zone interaction events
  const handleZoneClick = useCallback((
    zone: GardenZone,
    event: React.SyntheticEvent
  ) => {
    if (isEditable && onZoneClick) {
      event.preventDefault();
      onZoneClick(zone, event);
    }
  }, [isEditable, onZoneClick]);

  // Handle keyboard navigation
  const handleKeyPress = useCallback((
    event: React.KeyboardEvent,
    zone: GardenZone
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleZoneClick(zone, event);
    }
  }, [handleZoneClick]);

  // Render zone with plants
  const renderZone = useCallback((zone: GardenZone) => {
    const sunlightLevel = zone.sunlightCondition.toLowerCase().replace('_', '') as 'fullSun' | 'partialShade' | 'fullShade';

    return (
      <ZoneIndicator
        key={zone.id}
        sunlightLevel={sunlightLevel}
        onClick={(e) => handleZoneClick(zone, e)}
        onKeyPress={(e) => handleKeyPress(e, zone)}
        role="button"
        tabIndex={isEditable ? 0 : -1}
        aria-label={`Garden zone with ${zone.sunlightCondition.toLowerCase().replace('_', ' ')} conditions`}
      >
        {showPlantStatus && zone.plants.map((plant) => (
          <PlantIndicator
            key={plant.id}
            plantType={plant.type}
            status={plant.healthStatus.toLowerCase() as 'healthy' | 'needsAttention' | 'critical'}
            aria-label={`${plant.type} plant in ${plant.healthStatus.toLowerCase()} condition`}
          />
        ))}
      </ZoneIndicator>
    );
  }, [handleZoneClick, handleKeyPress, isEditable, showPlantStatus]);

  return (
    <GardenContainer
      role="region"
      aria-label={accessibilityLabel}
    >
      <StyledGrid
        columns={gridDimensions.columns}
        rows={gridDimensions.rows}
        cellSize={gridDimensions.cellSize}
        role="grid"
      >
        {layout.zones.map(renderZone)}
      </StyledGrid>

      <UtilizationBar
        percentage={utilization.percentage}
        role="progressbar"
        aria-valuenow={utilization.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Space utilization: ${utilization.percentage}%`}
      />

      <LegendContainer role="complementary" aria-label="Garden layout legend">
        <LegendItem>
          <LegendColor color={theme.garden.zones.fullSun} />
          <span>Full Sun</span>
        </LegendItem>
        <LegendItem>
          <LegendColor color={theme.garden.zones.partialShade} />
          <span>Partial Shade</span>
        </LegendItem>
        <LegendItem>
          <LegendColor color={theme.garden.zones.fullShade} />
          <span>Full Shade</span>
        </LegendItem>
        {showPlantStatus && (
          <>
            <LegendItem>
              <LegendColor color={theme.garden.plantStatus.healthy} />
              <span>Healthy Plants</span>
            </LegendItem>
            <LegendItem>
              <LegendColor color={theme.garden.plantStatus.needsAttention} />
              <span>Needs Attention</span>
            </LegendItem>
            <LegendItem>
              <LegendColor color={theme.garden.plantStatus.critical} />
              <span>Critical Status</span>
            </LegendItem>
          </>
        )}
      </LegendContainer>
    </GardenContainer>
  );
};