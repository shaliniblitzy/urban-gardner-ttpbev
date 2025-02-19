import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Garden, GardenZone, GardenLayout } from '../../types/garden.types';
import { gardenService } from '../../services/garden.service';
import { GardenGrid } from '../../components/garden/GardenGrid';
import { theme } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import styled from 'styled-components';
import { mediaQueries } from '../../theme/breakpoints';

// Styled components for layout and UI elements
const ScreenContainer = styled.main`
  padding: ${spacing.medium};
  max-width: 1200px;
  margin: 0 auto;

  ${mediaQueries.small} {
    padding: ${spacing.small};
  }
`;

const Header = styled.header`
  margin-bottom: ${spacing.large};
`;

const Title = styled.h1`
  color: ${theme.palette.text};
  font-size: 24px;
  margin-bottom: ${spacing.small};
`;

const MetricsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${spacing.medium};
  margin-bottom: ${spacing.large};
`;

const MetricCard = styled.div`
  background: ${theme.palette.background};
  padding: ${spacing.medium};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ErrorMessage = styled.div`
  color: ${theme.palette.alert.base};
  padding: ${spacing.medium};
  background: ${theme.palette.alert.light};
  border-radius: 4px;
  margin-bottom: ${spacing.medium};
`;

const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

// Custom error class for garden details operations
class GardenDetailsError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean
  ) {
    super(message);
    this.name = 'GardenDetailsError';
  }
}

interface GardenMetrics {
  spaceUtilization: number;
  totalPlants: number;
  healthyPlants: number;
  needsAttention: number;
}

const GardenDetailsScreen: React.FC = () => {
  // State management
  const [garden, setGarden] = useState<Garden | null>(null);
  const [layout, setLayout] = useState<GardenLayout | null>(null);
  const [metrics, setMetrics] = useState<GardenMetrics | null>(null);
  const [selectedZone, setSelectedZone] = useState<GardenZone | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<GardenDetailsError | null>(null);

  // Hooks
  const { id: gardenId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate garden metrics
  const calculateMetrics = useCallback((garden: Garden): GardenMetrics => {
    const plants = garden.zones.flatMap(zone => zone.plants);
    const healthyCount = plants.filter(p => p.healthStatus === 'HEALTHY').length;
    const attentionCount = plants.filter(p => p.healthStatus !== 'HEALTHY').length;

    return {
      spaceUtilization: garden.zones.reduce((sum, zone) => sum + zone.area, 0) / garden.area * 100,
      totalPlants: plants.length,
      healthyPlants: healthyCount,
      needsAttention: attentionCount
    };
  }, []);

  // Fetch garden details with error handling and retry logic
  const fetchGardenDetails = useCallback(async () => {
    if (!gardenId) {
      setError(new GardenDetailsError('Invalid garden ID', 'INVALID_ID', false));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Cancel previous request if exists
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const gardenData = await gardenService.getGardenById(gardenId);
      setGarden(gardenData);

      // Generate optimized layout
      const layoutData = await gardenService.generateLayout(gardenId, {
        targetUtilization: 90,
        minZoneSize: 1,
        defaultSpacing: 0.5
      });
      setLayout(layoutData);

      // Calculate and set metrics
      setMetrics(calculateMetrics(gardenData));
    } catch (err) {
      const isRecoverable = err instanceof Error && 
        !err.message.includes('INVALID_ID');
      setError(new GardenDetailsError(
        err instanceof Error ? err.message : 'Failed to load garden details',
        'FETCH_ERROR',
        isRecoverable
      ));
    } finally {
      setIsLoading(false);
    }
  }, [gardenId, calculateMetrics]);

  // Handle zone selection with accessibility support
  const handleZoneClick = useCallback((zone: GardenZone, event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault();
    setSelectedZone(zone);

    // Update URL with selected zone
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('zoneId', zone.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  }, [location, navigate]);

  // Initialize component
  useEffect(() => {
    fetchGardenDetails();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchGardenDetails]);

  // Memoized metrics display
  const metricsDisplay = useMemo(() => {
    if (!metrics) return null;

    return (
      <MetricsContainer>
        <MetricCard>
          <h3>Space Utilization</h3>
          <p>{metrics.spaceUtilization.toFixed(1)}%</p>
        </MetricCard>
        <MetricCard>
          <h3>Total Plants</h3>
          <p>{metrics.totalPlants}</p>
        </MetricCard>
        <MetricCard>
          <h3>Plant Health</h3>
          <p>{metrics.healthyPlants} healthy / {metrics.needsAttention} need attention</p>
        </MetricCard>
      </MetricsContainer>
    );
  }, [metrics]);

  return (
    <ScreenContainer role="main" aria-label="Garden Details">
      <Header>
        <Title>Garden Details</Title>
        {error && (
          <ErrorMessage role="alert">
            {error.message}
            {error.recoverable && (
              <button onClick={fetchGardenDetails}>Retry</button>
            )}
          </ErrorMessage>
        )}
      </Header>

      {metricsDisplay}

      {layout && (
        <GardenGrid
          layout={layout}
          onZoneClick={handleZoneClick}
          isEditable={true}
          showPlantStatus={true}
          accessibilityLabel="Interactive garden layout grid"
        />
      )}

      {isLoading && (
        <LoadingOverlay role="status" aria-label="Loading garden details">
          <div>Loading...</div>
        </LoadingOverlay>
      )}
    </ScreenContainer>
  );
};

export default GardenDetailsScreen;