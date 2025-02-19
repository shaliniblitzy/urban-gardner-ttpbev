import { renderHook, act, waitFor } from '@testing-library/react-hooks'; // ^8.0.1
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { Provider } from 'react-redux'; // ^8.0.0
import { configureStore } from '@reduxjs/toolkit';
import { useGarden } from '../../hooks/useGarden';
import { gardenService } from '../../services/garden.service';
import { Garden, GardenInput, GardenLayout, GardenZone, VegetableRequirement } from '../../types/garden.types';
import { SunlightCondition } from '../../types/zone.types';
import { PlantType } from '../../types/plant.types';
import gardenReducer from '../../store/garden/reducer';

// Mock garden service
jest.mock('../../services/garden.service');

// Test data
const mockGardenInput: GardenInput = {
  area: 500,
  zones: [
    {
      area: 300,
      sunlightCondition: SunlightCondition.FULL_SUN,
      plants: [
        {
          id: 'plant1',
          type: PlantType.TOMATOES,
          spacing: 2,
          plantedDate: new Date(),
          lastWateredDate: new Date(),
          lastFertilizedDate: new Date(),
          companionPlants: [],
          expectedYield: 5,
          healthStatus: 'GOOD',
          maintenanceHistory: []
        }
      ]
    }
  ]
};

const mockGarden: Garden = {
  id: 'garden1',
  area: 500,
  zones: mockGardenInput.zones as GardenZone[],
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockGardenLayout: GardenLayout = {
  gardenId: 'garden1',
  spaceUtilization: 92,
  zones: mockGardenInput.zones as GardenZone[],
  generatedAt: new Date()
};

// Test wrapper with Redux store
const createWrapper = () => {
  const store = configureStore({
    reducer: {
      garden: gardenReducer
    }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

describe('useGarden hook', () => {
  let performanceNow: number;

  beforeEach(() => {
    jest.clearAllMocks();
    performanceNow = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => performanceNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Garden Creation', () => {
    test('should create garden with valid input', async () => {
      // Mock service response
      (gardenService.createGarden as jest.Mock).mockResolvedValueOnce(mockGarden);

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.createGarden(mockGardenInput);
      });

      expect(result.current.currentGarden).toEqual(mockGarden);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBeFalsy();
    });

    test('should validate garden area constraints', async () => {
      const invalidInput = {
        ...mockGardenInput,
        area: 1500 // Exceeds 1000 sq ft limit
      };

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.createGarden(invalidInput);
      });

      expect(result.current.error).toEqual(expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('between 1 and 1000 square feet')
      }));
    });

    test('should handle service errors with retry mechanism', async () => {
      (gardenService.createGarden as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockGarden);

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.createGarden(mockGardenInput);
      });

      // Wait for retry
      await waitFor(() => {
        expect(result.current.currentGarden).toEqual(mockGarden);
      });

      expect(gardenService.createGarden).toHaveBeenCalledTimes(2);
    });
  });

  describe('Layout Generation', () => {
    test('should generate layout within performance threshold', async () => {
      (gardenService.generateLayout as jest.Mock).mockResolvedValueOnce(mockGardenLayout);

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      const startTime = Date.now();
      
      await act(async () => {
        await result.current.generateLayout('garden1');
      });

      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(3000); // 3 second threshold
      expect(result.current.currentLayout).toEqual(mockGardenLayout);
      expect(result.current.currentLayout?.spaceUtilization).toBeGreaterThanOrEqual(90);
    });

    test('should handle missing garden error', async () => {
      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.generateLayout('nonexistent');
      });

      expect(result.current.error).toEqual(expect.objectContaining({
        code: 'NO_GARDEN_SELECTED',
        message: expect.stringContaining('No garden selected')
      }));
    });

    test('should optimize space utilization', async () => {
      const optimizedLayout: GardenLayout = {
        ...mockGardenLayout,
        spaceUtilization: 95 // Exceeds target of 92%
      };

      (gardenService.generateLayout as jest.Mock).mockResolvedValueOnce(optimizedLayout);

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.generateLayout('garden1');
      });

      expect(result.current.currentLayout?.spaceUtilization).toBeGreaterThanOrEqual(92);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      (gardenService.createGarden as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.createGarden(mockGardenInput);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBeFalsy();
    });

    test('should reset error state on successful retry', async () => {
      (gardenService.createGarden as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(mockGarden);

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.createGarden(mockGardenInput);
      });

      // Wait for retry and success
      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.currentGarden).toEqual(mockGarden);
      });
    });
  });

  describe('Performance Monitoring', () => {
    test('should track operation duration', async () => {
      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      const startTime = Date.now();
      performanceNow += 2000; // Simulate 2 second operation

      await act(async () => {
        await result.current.createGarden(mockGardenInput);
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });

    test('should log performance warnings when thresholds exceeded', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      (gardenService.generateLayout as jest.Mock).mockImplementation(
        () => new Promise(resolve => {
          performanceNow += 4000; // Exceed 3 second threshold
          resolve(mockGardenLayout);
        })
      );

      const { result } = renderHook(() => useGarden(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.generateLayout('garden1');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeded performance threshold')
      );
    });
  });
});