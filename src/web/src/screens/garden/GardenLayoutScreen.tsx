import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMediaQuery } from '@mui/material';
import { CircularProgress } from '@mui/material';
import styled from 'styled-components';

import { GardenGrid } from '../../components/garden/GardenGrid';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { 
  selectCurrentLayout,
  selectCurrentGarden,
  selectGardenLoading,
  selectGardenError
} from '../../store/garden/selectors';
import {
  generateLayout,
  updateZone,
  undoLayoutChange,
  redoLayoutChange
} from '../../store/garden/actions';
import { theme } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { mediaQueries } from '../../theme/breakpoints';
import { GardenZone, GardenLayout } from '../../types/garden.types';
import { SunlightCondition } from '../../types/zone.types';

// Styled Components
const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${spacing.medium};
  background-color: ${theme.palette.background};
  min-height: 100vh;
  
  ${mediaQueries.small} {
    padding: ${spacing.small};
  }
`;

const LayoutHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.medium};
`;

const LayoutTitle = styled.h1`
  color: ${theme.palette.text};
  margin: 0;
`;

const LayoutControls = styled.div`
  display: flex;
  gap: ${spacing.small};
`;

const LayoutMetrics = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.medium};
  margin-bottom: ${spacing.medium};
  padding: ${spacing.small};
  background-color: ${theme.palette.secondary.light};
  border-radius: 8px;
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const MetricLabel = styled.span`
  font-size: 0.875rem;
  color: ${theme.palette.text};
`;

const MetricValue = styled.span`
  font-size: 1.25rem;
  font-weight: bold;
  color: ${theme.palette.primary.base};
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${spacing.small} ${spacing.medium};
  background-color: ${({ variant }) => 
    variant === 'secondary' ? theme.palette.secondary.base : theme.palette.primary.base};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${({ variant }) =>
      variant === 'secondary' ? theme.palette.secondary.dark : theme.palette.primary.dark};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 1000;
`;

interface GardenLayoutScreenProps {
  initialZoom?: number;
  enableUndo?: boolean;
  showMetrics?: boolean;
}

const GardenLayoutScreen: React.FC<GardenLayoutScreenProps> = ({
  initialZoom = 1,
  enableUndo = true,
  showMetrics = true
}) => {
  const dispatch = useDispatch();
  const currentLayout = useSelector(selectCurrentLayout);
  const currentGarden = useSelector(selectCurrentGarden);
  const isLoading = useSelector(selectGardenLoading);
  const error = useSelector(selectGardenError);
  
  const [zoom, setZoom] = useState(initialZoom);
  const [undoStack, setUndoStack] = useState<GardenLayout[]>([]);
  const [redoStack, setRedoStack] = useState<GardenLayout[]>([]);
  
  const isMobile = useMediaQuery('(max-width:768px)');

  // Calculate layout metrics
  const metrics = useMemo(() => {
    if (!currentLayout) return null;
    
    return {
      spaceUtilization: `${Math.round(currentLayout.spaceUtilization * 100)}%`,
      totalZones: currentLayout.zones.length,
      lastUpdated: new Date(currentLayout.generatedAt).toLocaleString()
    };
  }, [currentLayout]);

  // Handle zone click with undo support
  const handleZoneClick = useCallback((zone: GardenZone) => {
    if (!currentLayout || !currentGarden) return;

    try {
      // Save current state for undo
      if (enableUndo) {
        setUndoStack(prev => [...prev, currentLayout]);
        setRedoStack([]);
      }

      // Update zone
      dispatch(updateZone(currentGarden.id, zone.id, {
        ...zone,
        sunlightCondition: getNextSunlightCondition(zone.sunlightCondition)
      }));

      // Regenerate layout
      dispatch(generateLayout(currentGarden.id, {
        targetUtilization: 0.9,
        minZoneSize: 1,
        defaultSpacing: 0.5
      }));
    } catch (error) {
      console.error('Failed to update zone:', error);
    }
  }, [currentLayout, currentGarden, dispatch, enableUndo]);

  // Handle zoom change with bounds checking
  const handleZoomChange = useCallback((newZoom: number) => {
    const boundedZoom = Math.max(0.5, Math.min(2, newZoom));
    setZoom(boundedZoom);
  }, []);

  // Handle undo/redo operations
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !currentLayout) return;
    
    const previousLayout = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, currentLayout]);
    dispatch(undoLayoutChange(previousLayout));
  }, [undoStack, currentLayout, dispatch]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const nextLayout = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, currentLayout!]);
    dispatch(redoLayoutChange(nextLayout));
  }, [redoStack, currentLayout, dispatch]);

  // Helper function to cycle through sunlight conditions
  const getNextSunlightCondition = (current: SunlightCondition): SunlightCondition => {
    const conditions = Object.values(SunlightCondition);
    const currentIndex = conditions.indexOf(current);
    return conditions[(currentIndex + 1) % conditions.length];
  };

  // Error handling component
  if (error) {
    return (
      <ErrorBoundary>
        <LayoutContainer>
          <div>Error loading garden layout: {error}</div>
        </LayoutContainer>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LayoutContainer>
        <LayoutHeader>
          <LayoutTitle>Garden Layout</LayoutTitle>
          <LayoutControls>
            {enableUndo && (
              <>
                <ActionButton
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  aria-label="Undo last change"
                >
                  Undo
                </ActionButton>
                <ActionButton
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  aria-label="Redo last change"
                >
                  Redo
                </ActionButton>
              </>
            )}
            <ActionButton
              variant="secondary"
              onClick={() => handleZoomChange(zoom + 0.1)}
              aria-label="Zoom in"
            >
              +
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() => handleZoomChange(zoom - 0.1)}
              aria-label="Zoom out"
            >
              -
            </ActionButton>
          </LayoutControls>
        </LayoutHeader>

        {showMetrics && metrics && (
          <LayoutMetrics>
            <MetricItem>
              <MetricLabel>Space Utilization</MetricLabel>
              <MetricValue>{metrics.spaceUtilization}</MetricValue>
            </MetricItem>
            <MetricItem>
              <MetricLabel>Total Zones</MetricLabel>
              <MetricValue>{metrics.totalZones}</MetricValue>
            </MetricItem>
            <MetricItem>
              <MetricLabel>Last Updated</MetricLabel>
              <MetricValue>{metrics.lastUpdated}</MetricValue>
            </MetricItem>
          </LayoutMetrics>
        )}

        {currentLayout && (
          <GardenGrid
            layout={currentLayout}
            onZoneClick={handleZoneClick}
            onZoomChange={handleZoomChange}
            isEditable={!isLoading}
            showPlantStatus={true}
            accessibilityLabel="Interactive garden layout grid"
          />
        )}

        {isLoading && (
          <LoadingOverlay>
            <CircularProgress size={48} color="primary" />
          </LoadingOverlay>
        )}
      </LayoutContainer>
    </ErrorBoundary>
  );
};

export default GardenLayoutScreen;