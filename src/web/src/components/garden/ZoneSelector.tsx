import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Select } from '../common/Select';
import { GardenZone } from '../../types/garden.types';
import { SunlightCondition } from '../../types/zone.types';
import { GARDEN_VALIDATION, SUNLIGHT_REQUIREMENTS, ERROR_MARGINS } from '../../constants/garden';

interface ZoneSelectorProps {
  zones: GardenZone[];
  onZonesChange: (zones: GardenZone[]) => void;
  totalArea: number;
  disabled?: boolean;
  onError?: (error: string) => void;
}

const ZoneSelectorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  position: relative;
  padding: ${({ theme }) => theme.spacing.medium};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.small};
  }
`;

const ZoneRow = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  position: relative;
  padding: 8px;
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: ${({ theme }) => theme.colors.background.secondary};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const UtilizationIndicator = styled.div<{ utilization: number }>`
  color: ${({ theme, utilization }) => 
    utilization > 100 ? theme.palette.alert.base :
    utilization > 90 ? theme.palette.primary.dark :
    theme.palette.primary.base
  };
  font-size: ${({ theme }) => theme.typography.caption.fontSize};
  margin-top: 8px;
`;

const AddZoneButton = styled.button`
  ${({ theme }) => theme.typography.button};
  background: ${({ theme }) => theme.palette.primary.base};
  color: ${({ theme }) => theme.palette.background};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.small};
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.palette.primary.dark};
  }

  &:disabled {
    background: ${({ theme }) => theme.palette.primary.light};
    cursor: not-allowed;
  }
`;

const sunlightOptions = [
  { value: SunlightCondition.FULL_SUN, label: 'Full Sun (6+ hours)' },
  { value: SunlightCondition.PARTIAL_SHADE, label: 'Partial Shade (3-6 hours)' },
  { value: SunlightCondition.FULL_SHADE, label: 'Full Shade (<3 hours)' }
];

export const ZoneSelector: React.FC<ZoneSelectorProps> = ({
  zones,
  onZonesChange,
  totalArea,
  disabled = false,
  onError
}) => {
  const calculateSpaceUtilization = useCallback((currentZones: GardenZone[]): number => {
    const totalUsedArea = currentZones.reduce((sum, zone) => sum + zone.area, 0);
    return (totalUsedArea / totalArea) * 100;
  }, [totalArea]);

  const spaceUtilization = useMemo(() => 
    calculateSpaceUtilization(zones), [zones, calculateSpaceUtilization]);

  const validateZoneChanges = useCallback((updatedZones: GardenZone[]): boolean => {
    const totalUsedArea = updatedZones.reduce((sum, zone) => sum + zone.area, 0);
    
    if (totalUsedArea > totalArea * (1 + ERROR_MARGINS.AREA_CALCULATION)) {
      onError?.('Total zone area exceeds garden area');
      return false;
    }

    if (updatedZones.length > GARDEN_VALIDATION.MAX_ZONES) {
      onError?.('Maximum number of zones exceeded');
      return false;
    }

    if (updatedZones.some(zone => zone.area < GARDEN_VALIDATION.MIN_ZONE_SIZE)) {
      onError?.(`Minimum zone size is ${GARDEN_VALIDATION.MIN_ZONE_SIZE} sq ft`);
      return false;
    }

    return true;
  }, [totalArea, onError]);

  const handleZoneChange = useCallback((zoneIndex: number, sunlightCondition: SunlightCondition) => {
    const updatedZones = [...zones];
    updatedZones[zoneIndex] = {
      ...updatedZones[zoneIndex],
      sunlightCondition
    };

    if (validateZoneChanges(updatedZones)) {
      onZonesChange(updatedZones);
    }
  }, [zones, onZonesChange, validateZoneChanges]);

  const handleZoneAreaChange = useCallback((zoneIndex: number, area: number) => {
    const updatedZones = [...zones];
    updatedZones[zoneIndex] = {
      ...updatedZones[zoneIndex],
      area: Math.max(GARDEN_VALIDATION.MIN_ZONE_SIZE, area)
    };

    if (validateZoneChanges(updatedZones)) {
      onZonesChange(updatedZones);
    }
  }, [zones, onZonesChange, validateZoneChanges]);

  const handleAddZone = useCallback(() => {
    const remainingArea = totalArea - zones.reduce((sum, zone) => sum + zone.area, 0);
    
    if (remainingArea < GARDEN_VALIDATION.MIN_ZONE_SIZE) {
      onError?.('Insufficient space for new zone');
      return;
    }

    const newZone: GardenZone = {
      id: `zone-${zones.length + 1}`,
      area: Math.min(remainingArea, GARDEN_VALIDATION.MIN_ZONE_SIZE),
      sunlightCondition: SunlightCondition.FULL_SUN,
      plants: []
    };

    const updatedZones = [...zones, newZone];
    if (validateZoneChanges(updatedZones)) {
      onZonesChange(updatedZones);
    }
  }, [zones, totalArea, onZonesChange, validateZoneChanges, onError]);

  return (
    <ZoneSelectorContainer>
      {zones.map((zone, index) => (
        <ZoneRow key={zone.id}>
          <Select
            id={`zone-${zone.id}-sunlight`}
            name={`zone-${zone.id}-sunlight`}
            value={zone.sunlightCondition}
            label={`Zone ${index + 1} Sunlight`}
            options={sunlightOptions}
            onChange={(value) => handleZoneChange(index, value as SunlightCondition)}
            disabled={disabled}
            aria-label={`Select sunlight condition for zone ${index + 1}`}
          />
          <Select
            id={`zone-${zone.id}-area`}
            name={`zone-${zone.id}-area`}
            value={zone.area.toString()}
            label={`Zone ${index + 1} Area (sq ft)`}
            options={Array.from({ length: Math.floor(totalArea) }, (_, i) => ({
              value: (i + 1).toString(),
              label: `${i + 1} sq ft`
            }))}
            onChange={(value) => handleZoneAreaChange(index, Number(value))}
            disabled={disabled}
            aria-label={`Select area for zone ${index + 1}`}
          />
        </ZoneRow>
      ))}

      <UtilizationIndicator utilization={spaceUtilization}>
        Space Utilization: {spaceUtilization.toFixed(1)}%
      </UtilizationIndicator>

      <AddZoneButton
        onClick={handleAddZone}
        disabled={disabled || zones.length >= GARDEN_VALIDATION.MAX_ZONES}
        aria-label="Add new garden zone"
      >
        Add Zone
      </AddZoneButton>
    </ZoneSelectorContainer>
  );
};