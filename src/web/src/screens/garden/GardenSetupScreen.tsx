import React, { useCallback, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigation } from '@react-navigation/native';
import { AreaInput } from '../../components/garden/AreaInput';
import { SunlightInput } from '../../components/garden/SunlightInput';
import { ZoneSelector } from '../../components/garden/ZoneSelector';
import { useGarden } from '../../hooks/useGarden';
import { GardenZone } from '../../types/garden.types';
import { SunlightCondition } from '../../types/zone.types';
import { GARDEN_VALIDATION } from '../../constants/garden';

// Styled components with responsive design
const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.medium};
  gap: ${({ theme }) => theme.spacing.large};
  max-width: 600px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.small};
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.medium};
  width: 100%;
`;

const Title = styled.h1`
  ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.palette.text};
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.small};
`;

const SectionTitle = styled.h2`
  ${({ theme }) => theme.typography.h2};
  color: ${({ theme }) => theme.palette.text};
`;

const SubmitButton = styled.button<{ isSubmitting: boolean }>`
  ${({ theme }) => theme.typography.button};
  padding: ${({ theme }) => theme.spacing.small} ${({ theme }) => theme.spacing.medium};
  background-color: ${({ theme }) => theme.palette.primary.base};
  color: ${({ theme }) => theme.palette.background};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.medium};
  margin-top: ${({ theme }) => theme.spacing.medium};
  cursor: ${({ isSubmitting }) => isSubmitting ? 'wait' : 'pointer'};
  opacity: ${({ isSubmitting }) => isSubmitting ? 0.7 : 1};
  transition: opacity 0.2s ease-in-out;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    cursor: not-allowed;
    background-color: ${({ theme }) => theme.palette.primary.light};
  }
`;

interface GardenSetupState {
  area: number;
  zones: GardenZone[];
  errors: {
    area: string | null;
    zones: string | null;
    sunlight: string | null;
    form: string | null;
  };
  isSubmitting: boolean;
  retryCount: number;
}

export const GardenSetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const { createGarden, generateLayout, isLoading, error: gardenError } = useGarden();

  const [state, setState] = useState<GardenSetupState>({
    area: 0,
    zones: [],
    errors: {
      area: null,
      zones: null,
      sunlight: null,
      form: null
    },
    isSubmitting: false,
    retryCount: 0
  });

  // Handle area input changes with validation
  const handleAreaChange = useCallback((area: number) => {
    setState(prev => ({
      ...prev,
      area,
      errors: {
        ...prev.errors,
        area: area < GARDEN_VALIDATION.AREA_LIMITS.MIN || 
              area > GARDEN_VALIDATION.AREA_LIMITS.MAX
          ? `Garden area must be between ${GARDEN_VALIDATION.AREA_LIMITS.MIN} and ${GARDEN_VALIDATION.AREA_LIMITS.MAX} sq ft`
          : null
      }
    }));
  }, []);

  // Handle zone changes with validation
  const handleZonesChange = useCallback((zones: GardenZone[]) => {
    setState(prev => {
      const totalZoneArea = zones.reduce((sum, zone) => sum + zone.area, 0);
      const zoneError = totalZoneArea > prev.area
        ? 'Total zone area cannot exceed garden area'
        : null;

      return {
        ...prev,
        zones,
        errors: {
          ...prev.errors,
          zones: zoneError
        }
      };
    });
  }, []);

  // Form submission handler
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    setState(prev => ({
      ...prev,
      isSubmitting: true,
      errors: {
        ...prev.errors,
        form: null
      }
    }));

    try {
      // Create garden
      const garden = await createGarden({
        area: state.area,
        zones: state.zones
      });

      if (garden) {
        // Generate initial layout
        const layout = await generateLayout(garden.id);
        
        if (layout) {
          navigation.navigate('GardenLayout', { gardenId: garden.id });
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          form: (error as Error).message
        },
        retryCount: prev.retryCount + 1
      }));
    } finally {
      setState(prev => ({
        ...prev,
        isSubmitting: false
      }));
    }
  }, [state.area, state.zones, createGarden, generateLayout, navigation]);

  // Handle external errors
  useEffect(() => {
    if (gardenError) {
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          form: gardenError.message
        }
      }));
    }
  }, [gardenError]);

  const hasErrors = Object.values(state.errors).some(error => error !== null);
  const isFormValid = state.area > 0 && state.zones.length > 0 && !hasErrors;

  return (
    <Container>
      <Title>Garden Setup</Title>
      <Form onSubmit={handleSubmit}>
        <Section>
          <SectionTitle>Garden Area</SectionTitle>
          <AreaInput
            value={state.area}
            onChange={handleAreaChange}
            error={state.errors.area}
            disabled={state.isSubmitting}
          />
        </Section>

        <Section>
          <SectionTitle>Garden Zones</SectionTitle>
          <ZoneSelector
            zones={state.zones}
            onZonesChange={handleZonesChange}
            totalArea={state.area}
            disabled={state.isSubmitting}
            onError={(error) => setState(prev => ({
              ...prev,
              errors: { ...prev.errors, zones: error }
            }))}
          />
        </Section>

        {state.errors.form && (
          <div role="alert" aria-live="polite" style={{ color: 'red' }}>
            {state.errors.form}
          </div>
        )}

        <SubmitButton
          type="submit"
          disabled={!isFormValid || state.isSubmitting || isLoading}
          isSubmitting={state.isSubmitting}
          aria-busy={state.isSubmitting}
        >
          {state.isSubmitting ? 'Creating Garden...' : 'Create Garden'}
        </SubmitButton>
      </Form>
    </Container>
  );
};

export default GardenSetupScreen;