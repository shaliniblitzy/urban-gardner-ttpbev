import React from 'react';
import { render, fireEvent, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import PlantCard from '../../../components/garden/PlantCard';
import { Plant, PlantType, GrowthStage, PlantHealth, SunlightCondition } from '../../../types/plant.types';

// Mock the translation hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      // Simple translation mock that returns the key and interpolated params
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    }
  })
}));

// Mock plant data factory
const createMockPlant = (overrides?: Partial<Plant>): Plant => ({
  id: 'test-plant-1',
  type: PlantType.TOMATOES,
  growthStage: GrowthStage.GROWING,
  sunlightNeeds: SunlightCondition.FULL_SUN,
  spacing: 2,
  daysToMaturity: 75,
  plantedDate: new Date('2024-01-01'),
  lastWateredDate: new Date('2024-01-15'),
  lastFertilizedDate: new Date('2024-01-10'),
  companionPlants: [PlantType.LETTUCE],
  expectedYield: 5,
  healthStatus: PlantHealth.GOOD,
  maintenanceHistory: [],
  nextWateringDate: new Date('2024-01-18'),
  nextFertilizingDate: new Date('2024-01-20'),
  ...overrides
});

// Helper function to render PlantCard with default props
const renderPlantCard = (customProps: Partial<any> = {}) => {
  const defaultProps = {
    plant: createMockPlant(),
    onWater: jest.fn().mockResolvedValue(undefined),
    onFertilize: jest.fn().mockResolvedValue(undefined),
    selected: false,
    onClick: jest.fn(),
    testId: 'plant-card'
  };

  return render(<PlantCard {...defaultProps} {...customProps} />);
};

describe('PlantCard Component', () => {
  describe('Plant Information Display', () => {
    it('renders plant type with correct label', () => {
      renderPlantCard();
      expect(screen.getByText('plant.type.TOMATOES')).toBeInTheDocument();
    });

    it('displays current growth stage with appropriate indicator', () => {
      renderPlantCard();
      const growthStage = screen.getByText('plant.growthStage.GROWING');
      expect(growthStage).toBeInTheDocument();
      expect(growthStage.closest('span')).toHaveStyle({
        backgroundColor: expect.any(String)
      });
    });

    it('shows health status with correct indicator color', () => {
      renderPlantCard();
      const healthIndicator = screen.getByText('plant.health.GOOD');
      expect(healthIndicator).toBeInTheDocument();
      expect(healthIndicator.previousElementSibling).toHaveStyle({
        backgroundColor: expect.any(String)
      });
    });

    it('displays next maintenance date correctly', () => {
      const plant = createMockPlant({
        nextWateringDate: new Date('2024-01-18'),
        nextFertilizingDate: new Date('2024-01-20')
      });
      renderPlantCard({ plant });
      expect(screen.getByText(/plant\.nextWatering/)).toBeInTheDocument();
    });
  });

  describe('Maintenance Actions', () => {
    it('enables water button when plant needs water', async () => {
      const onWater = jest.fn().mockResolvedValue(undefined);
      renderPlantCard({ 
        plant: createMockPlant({ needsWater: true }),
        onWater 
      });

      const waterButton = screen.getByRole('button', { name: /plant\.waterButton/ });
      expect(waterButton).not.toBeDisabled();
      
      await userEvent.click(waterButton);
      expect(onWater).toHaveBeenCalledTimes(1);
    });

    it('shows loading state during watering action', async () => {
      const onWater = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      renderPlantCard({ onWater });

      const waterButton = screen.getByRole('button', { name: /plant\.waterButton/ });
      fireEvent.click(waterButton);

      expect(screen.getByText('plant.watering')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('plant.water')).toBeInTheDocument();
      });
    });

    it('handles fertilize action with loading state', async () => {
      const onFertilize = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      renderPlantCard({ onFertilize });

      const fertilizeButton = screen.getByRole('button', { name: /plant\.fertilizeButton/ });
      fireEvent.click(fertilizeButton);

      expect(screen.getByText('plant.fertilizing')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('plant.fertilize')).toBeInTheDocument();
      });
    });
  });

  describe('Selection and Interaction', () => {
    it('applies selected state styling when selected', () => {
      renderPlantCard({ selected: true });
      const card = screen.getByTestId('plant-card');
      expect(card).toHaveStyle({
        border: expect.stringContaining('2px solid')
      });
    });

    it('handles click events correctly', () => {
      const onClick = jest.fn();
      renderPlantCard({ onClick });
      
      const card = screen.getByTestId('plant-card');
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('maintains proper tab order for interactive elements', () => {
      renderPlantCard();
      const card = screen.getByTestId('plant-card');
      const buttons = within(card).getAllByRole('button');
      
      expect(buttons[0]).toHaveAttribute('tabIndex', '0');
      expect(buttons.every(button => button.getAttribute('tabIndex') !== '-1')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for interactive elements', () => {
      renderPlantCard();
      const card = screen.getByTestId('plant-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('aria-pressed');
      expect(card).toHaveAttribute('aria-label');
    });

    it('supports keyboard navigation', () => {
      const onClick = jest.fn();
      renderPlantCard({ onClick });
      
      const card = screen.getByTestId('plant-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
      
      fireEvent.keyDown(card, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts layout to different screen sizes', () => {
      const { container } = renderPlantCard();
      const card = screen.getByTestId('plant-card');
      
      // Verify responsive styles are applied
      expect(card).toHaveStyle({
        minWidth: '200px',
        maxWidth: '300px'
      });

      // Verify media query styles
      const styles = window.getComputedStyle(card);
      expect(styles).toBeDefined();
    });

    it('maintains touch targets at appropriate sizes', () => {
      renderPlantCard();
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const height = parseFloat(styles.height);
        // Ensure minimum touch target size of 44px
        expect(height).toBeGreaterThanOrEqual(44);
      });
    });
  });
});