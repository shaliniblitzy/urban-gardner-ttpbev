import React, { useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { Typography, theme } from '@mui/material';
import Card from '../common/Card';
import { Plant, GrowthStage, PlantHealth } from '../../types/plant.types';

/**
 * Props interface for the PlantCard component
 */
interface PlantCardProps {
  plant: Plant;
  onWater: () => Promise<void>;
  onFertilize: () => Promise<void>;
  selected: boolean;
  onClick: () => void;
  className?: string;
  testId?: string;
}

/**
 * Styled wrapper for the plant card with selection and interaction states
 */
const StyledPlantCard = styled(Card)<{ $selected: boolean }>`
  cursor: pointer;
  border: ${props => props.$selected ? `2px solid ${theme.palette.primary.main}` : 'none'};
  transition: all 0.2s ease-in-out;
  padding: ${theme.spacing(2)};
  &:hover {
    transform: scale(1.02);
  }
  &:focus {
    outline: 2px solid ${theme.palette.primary.main};
  }
  position: relative;
  min-width: 200px;
  max-width: 300px;

  @media (max-width: 600px) {
    width: 100%;
    max-width: none;
  }
`;

/**
 * Container for plant information with responsive layout
 */
const PlantInfo = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${theme.spacing(2)};
  align-items: start;

  @media (max-width: 400px) {
    grid-template-columns: 1fr;
  }
`;

/**
 * Container for maintenance action buttons
 */
const MaintenanceActions = styled.div`
  display: flex;
  gap: ${theme.spacing(1)};
  margin-top: ${theme.spacing(2)};
  justify-content: flex-end;

  @media (max-width: 400px) {
    justify-content: stretch;
  }
`;

/**
 * Status indicator for plant health
 */
const HealthIndicator = styled.div<{ $health: PlantHealth }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => {
    switch (props.$health) {
      case PlantHealth.EXCELLENT:
        return theme.palette.success.main;
      case PlantHealth.GOOD:
        return theme.palette.info.main;
      case PlantHealth.FAIR:
        return theme.palette.warning.main;
      case PlantHealth.POOR:
        return theme.palette.error.main;
      default:
        return theme.palette.grey[400];
    }
  }};
  margin-right: ${theme.spacing(1)};
`;

/**
 * Growth stage badge
 */
const GrowthStageBadge = styled.span`
  background-color: ${theme.palette.primary.light};
  color: ${theme.palette.primary.contrastText};
  padding: ${theme.spacing(0.5, 1)};
  border-radius: ${theme.shape.borderRadius}px;
  font-size: 0.75rem;
  font-weight: 500;
`;

/**
 * Maintenance button with loading state
 */
const MaintenanceButton = styled.button<{ $variant: 'water' | 'fertilize' }>`
  background-color: ${props => 
    props.$variant === 'water' ? theme.palette.info.main : theme.palette.success.main};
  color: ${theme.palette.common.white};
  border: none;
  border-radius: ${theme.shape.borderRadius}px;
  padding: ${theme.spacing(1, 2)};
  cursor: pointer;
  transition: opacity 0.2s ease;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

/**
 * PlantCard component for displaying plant information and maintenance actions
 */
const PlantCard: React.FC<PlantCardProps> = ({
  plant,
  onWater,
  onFertilize,
  selected,
  onClick,
  className,
  testId
}) => {
  const { t } = useTranslation();
  const [isWatering, setIsWatering] = useState(false);
  const [isFertilizing, setIsFertilizing] = useState(false);

  const handleWater = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWatering(true);
    try {
      await onWater();
    } finally {
      setIsWatering(false);
    }
  };

  const handleFertilize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFertilizing(true);
    try {
      await onFertilize();
    } finally {
      setIsFertilizing(false);
    }
  };

  const getNextMaintenanceDate = (): string => {
    const waterDate = new Date(plant.nextWateringDate);
    const fertilizeDate = new Date(plant.nextFertilizingDate);
    return waterDate < fertilizeDate 
      ? t('plant.nextWatering', { date: waterDate.toLocaleDateString() })
      : t('plant.nextFertilizing', { date: fertilizeDate.toLocaleDateString() });
  };

  return (
    <StyledPlantCard
      $selected={selected}
      onClick={onClick}
      className={className}
      data-testid={testId}
      elevation={selected ? 3 : 1}
      role="button"
      aria-pressed={selected}
      aria-label={t('plant.cardAriaLabel', { type: plant.type })}
    >
      <PlantInfo>
        <div>
          <Typography variant="h6" component="h3">
            {t(`plant.type.${plant.type}`)}
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: theme.spacing(1) }}>
            <HealthIndicator $health={plant.healthStatus} />
            <Typography variant="body2" color="textSecondary">
              {t(`plant.health.${plant.healthStatus}`)}
            </Typography>
          </div>
          <GrowthStageBadge>
            {t(`plant.growthStage.${plant.growthStage}`)}
          </GrowthStageBadge>
        </div>
        <Typography variant="caption" color="textSecondary">
          {getNextMaintenanceDate()}
        </Typography>
      </PlantInfo>

      <MaintenanceActions>
        <MaintenanceButton
          $variant="water"
          onClick={handleWater}
          disabled={isWatering}
          aria-label={t('plant.waterButton')}
        >
          {isWatering ? t('plant.watering') : t('plant.water')}
        </MaintenanceButton>
        <MaintenanceButton
          $variant="fertilize"
          onClick={handleFertilize}
          disabled={isFertilizing}
          aria-label={t('plant.fertilizeButton')}
        >
          {isFertilizing ? t('plant.fertilizing') : t('plant.fertilize')}
        </MaintenanceButton>
      </MaintenanceActions>
    </StyledPlantCard>
  );
};

export default PlantCard;