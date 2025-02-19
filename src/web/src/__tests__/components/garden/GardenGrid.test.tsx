import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { GardenGrid } from '../../../components/garden/GardenGrid';
import { GardenLayout, GardenZone } from '../../../types/garden.types';
import { SunlightCondition } from '../../../types/zone.types';
import { PlantType, PlantHealth } from '../../../types/plant.types';

// Mock ResizeObserver for window resize tests
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.ResizeObserver = mockResizeObserver;

// Mock sample garden layout data
const mockGardenLayout: GardenLayout = {
  gardenId: 'garden-1',
  spaceUtilization: 0.85,
  zones: [
    {
      id: 'zone-1',
      area: 25,
      sunlightCondition: SunlightCondition.FULL_SUN,
      plants: [
        {
          id: 'plant-1',
          type: PlantType.TOMATOES,
          healthStatus: PlantHealth.GOOD,
          spacing: 2,
          plantedDate: new Date(),
          lastWateredDate: new Date(),
          lastFertilizedDate: new Date(),
          growthStage: 'GROWING',
          sunlightNeeds: SunlightCondition.FULL_SUN,
          daysToMaturity: 60,
          companionPlants: [],
          expectedYield: 5,
          maintenanceHistory: []
        }
      ]
    },
    {
      id: 'zone-2',
      area: 20,
      sunlightCondition: SunlightCondition.PARTIAL_SHADE,
      plants: [
        {
          id: 'plant-2',
          type: PlantType.LETTUCE,
          healthStatus: PlantHealth.EXCELLENT,
          spacing: 1,
          plantedDate: new Date(),
          lastWateredDate: new Date(),
          lastFertilizedDate: new Date(),
          growthStage: 'GROWING',
          sunlightNeeds: SunlightCondition.PARTIAL_SHADE,
          daysToMaturity: 45,
          companionPlants: [],
          expectedYield: 2,
          maintenanceHistory: []
        }
      ]
    }
  ],
  generatedAt: new Date()
};

const mockOnZoneClick = jest.fn();

describe('GardenGrid Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Set initial window size
    global.innerWidth = 1024;
    global.innerHeight = 768;
    global.dispatchEvent(new Event('resize'));
  });

  afterEach(() => {
    // Cleanup after each test
    jest.resetAllMocks();
  });

  describe('Layout Rendering', () => {
    it('renders garden grid with correct zones and dimensions', () => {
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      // Verify grid container
      const gridContainer = screen.getByRole('grid');
      expect(gridContainer).toBeInTheDocument();

      // Verify zone indicators
      const zoneElements = screen.getAllByRole('button');
      expect(zoneElements).toHaveLength(mockGardenLayout.zones.length);

      // Verify plant indicators
      mockGardenLayout.zones.forEach(zone => {
        zone.plants.forEach(plant => {
          const plantIndicator = screen.getByLabelText(
            new RegExp(`${plant.type.toLowerCase()}.*`, 'i')
          );
          expect(plantIndicator).toBeInTheDocument();
        });
      });
    });

    it('displays space utilization bar with correct percentage', () => {
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      const utilizationBar = screen.getByRole('progressbar');
      expect(utilizationBar).toBeInTheDocument();
      expect(utilizationBar).toHaveAttribute(
        'aria-valuenow',
        String(mockGardenLayout.spaceUtilization * 100)
      );
    });

    it('renders legend with correct zone and plant status indicators', () => {
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      const legend = screen.getByRole('complementary');
      expect(legend).toBeInTheDocument();

      // Verify sunlight condition legends
      expect(screen.getByText('Full Sun')).toBeInTheDocument();
      expect(screen.getByText('Partial Shade')).toBeInTheDocument();
      expect(screen.getByText('Full Shade')).toBeInTheDocument();

      // Verify plant status legends
      expect(screen.getByText('Healthy Plants')).toBeInTheDocument();
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
      expect(screen.getByText('Critical Status')).toBeInTheDocument();
    });
  });

  describe('Interaction Handling', () => {
    it('calls onZoneClick when zone is clicked in editable mode', async () => {
      const user = userEvent.setup();
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      const firstZone = screen.getAllByRole('button')[0];
      await user.click(firstZone);

      expect(mockOnZoneClick).toHaveBeenCalledWith(
        mockGardenLayout.zones[0],
        expect.any(Object)
      );
    });

    it('does not call onZoneClick when not in editable mode', async () => {
      const user = userEvent.setup();
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={false}
        />
      );

      const firstZone = screen.getAllByRole('button')[0];
      await user.click(firstZone);

      expect(mockOnZoneClick).not.toHaveBeenCalled();
    });

    it('supports keyboard navigation and interaction', async () => {
      const user = userEvent.setup();
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      const zones = screen.getAllByRole('button');
      await user.tab();
      expect(zones[0]).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockOnZoneClick).toHaveBeenCalledWith(
        mockGardenLayout.zones[0],
        expect.any(Object)
      );
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts grid layout for small screens', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      const gridContainer = screen.getByRole('grid');
      expect(gridContainer).toHaveStyle({
        gridTemplateColumns: expect.stringMatching(/repeat\(\d+, \d+px\)/)
      });
    });

    it('maintains readability of plant indicators on different screen sizes', async () => {
      const screenSizes = [375, 768, 1024];

      for (const width of screenSizes) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        render(
          <GardenGrid
            layout={mockGardenLayout}
            onZoneClick={mockOnZoneClick}
            isEditable={true}
          />
        );

        const plantIndicators = screen.getAllByRole('button');
        plantIndicators.forEach(indicator => {
          expect(indicator).toBeVisible();
        });

        cleanup();
      }
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for interactive elements', () => {
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      // Check main container
      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Garden Layout Grid'
      );

      // Check zone indicators
      mockGardenLayout.zones.forEach(zone => {
        const zoneElement = screen.getByLabelText(
          new RegExp(`Garden zone with ${zone.sunlightCondition.toLowerCase().replace('_', ' ')} conditions`, 'i')
        );
        expect(zoneElement).toBeInTheDocument();
      });

      // Check utilization bar
      const utilizationBar = screen.getByRole('progressbar');
      expect(utilizationBar).toHaveAttribute('aria-valuemin', '0');
      expect(utilizationBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('maintains proper focus management', async () => {
      const user = userEvent.setup();
      render(
        <GardenGrid
          layout={mockGardenLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      // Test focus trap within interactive elements
      await user.tab();
      expect(screen.getAllByRole('button')[0]).toHaveFocus();

      // Test focus visibility
      const focusedElement = document.activeElement;
      expect(focusedElement).toHaveStyleRule('outline', expect.any(String), {
        modifier: ':focus-visible'
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty garden layout gracefully', () => {
      const emptyLayout: GardenLayout = {
        ...mockGardenLayout,
        zones: []
      };

      render(
        <GardenGrid
          layout={emptyLayout}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles missing plant data in zones', () => {
      const layoutWithEmptyZone: GardenLayout = {
        ...mockGardenLayout,
        zones: [
          {
            ...mockGardenLayout.zones[0],
            plants: []
          }
        ]
      };

      render(
        <GardenGrid
          layout={layoutWithEmptyZone}
          onZoneClick={mockOnZoneClick}
          isEditable={true}
        />
      );

      const zoneElement = screen.getByRole('button');
      expect(zoneElement).toBeInTheDocument();
      expect(within(zoneElement).queryByRole('img')).not.toBeInTheDocument();
    });
  });
});