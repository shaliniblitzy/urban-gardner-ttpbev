import { gardenReducer } from '../../../store/garden/reducer';
import { GardenState, GardenActionTypes } from '../../../store/garden/types';
import { Garden, GardenLayout } from '../../../types/garden.types';
import { SunlightCondition } from '../../../types/zone.types';
import { PlantType } from '../../../types/plant.types';

describe('gardenReducer', () => {
  let initialState: GardenState;
  let mockGarden: Garden;
  let mockLayout: GardenLayout;

  beforeEach(() => {
    // Set up initial state for each test
    initialState = {
      gardens: [],
      currentGarden: null,
      currentLayout: null,
      loading: false,
      error: null,
      retryCount: 0,
      spaceUtilization: 0
    };

    // Mock garden data
    mockGarden = {
      id: 'test-garden-1',
      area: 500,
      zones: [
        {
          id: 'zone-1',
          area: 200,
          sunlightCondition: SunlightCondition.FULL_SUN,
          plants: []
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock layout data
    mockLayout = {
      gardenId: 'test-garden-1',
      spaceUtilization: 92,
      zones: [
        {
          id: 'zone-1',
          area: 200,
          sunlightCondition: SunlightCondition.FULL_SUN,
          plants: []
        }
      ],
      generatedAt: new Date()
    };
  });

  // Garden Area Validation Tests
  describe('Garden Area Validation', () => {
    it('should reject garden area below minimum (1 sq ft)', () => {
      const invalidGarden = { ...mockGarden, area: 0 };
      const state = gardenReducer(initialState, {
        type: GardenActionTypes.CREATE_GARDEN_REQUEST,
        payload: invalidGarden
      });

      expect(state.error).not.toBeNull();
      expect(state.error?.code).toBe('E001');
      expect(state.loading).toBe(false);
    });

    it('should reject garden area above maximum (1000 sq ft)', () => {
      const invalidGarden = { ...mockGarden, area: 1001 };
      const state = gardenReducer(initialState, {
        type: GardenActionTypes.CREATE_GARDEN_REQUEST,
        payload: invalidGarden
      });

      expect(state.error).not.toBeNull();
      expect(state.error?.code).toBe('E001');
      expect(state.loading).toBe(false);
    });

    it('should accept valid garden area (1-1000 sq ft)', () => {
      const state = gardenReducer(initialState, {
        type: GardenActionTypes.CREATE_GARDEN_REQUEST,
        payload: mockGarden
      });

      expect(state.error).toBeNull();
      expect(state.loading).toBe(true);
    });
  });

  // Layout Generation Performance Tests
  describe('Layout Generation Performance', () => {
    it('should generate layout within performance requirements (< 3s)', () => {
      const startTime = Date.now();
      
      const state = gardenReducer(initialState, {
        type: GardenActionTypes.GENERATE_LAYOUT_SUCCESS,
        payload: mockLayout
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(3000);
      expect(state.currentLayout).toEqual(mockLayout);
      expect(state.loading).toBe(false);
    });

    it('should achieve target space utilization (>= 92%)', () => {
      const state = gardenReducer(initialState, {
        type: GardenActionTypes.GENERATE_LAYOUT_SUCCESS,
        payload: mockLayout
      });

      expect(state.currentLayout?.spaceUtilization).toBeGreaterThanOrEqual(92);
    });
  });

  // Error Handling and Recovery Tests
  describe('Error Handling', () => {
    it('should handle create garden failure with retry mechanism', () => {
      let state = gardenReducer(initialState, {
        type: GardenActionTypes.CREATE_GARDEN_FAILURE,
        payload: 'Network error'
      });

      expect(state.error).not.toBeNull();
      expect(state.retryCount).toBe(1);
      expect(state.error?.retryable).toBe(true);

      // Test max retry limit
      for (let i = 0; i < 3; i++) {
        state = gardenReducer(state, {
          type: GardenActionTypes.CREATE_GARDEN_FAILURE,
          payload: 'Network error'
        });
      }

      expect(state.retryCount).toBe(3);
      expect(state.error?.retryable).toBe(false);
    });

    it('should clear error state on successful operation', () => {
      // First set an error
      let state = gardenReducer(initialState, {
        type: GardenActionTypes.CREATE_GARDEN_FAILURE,
        payload: 'Test error'
      });

      // Then clear it with successful operation
      state = gardenReducer(state, {
        type: GardenActionTypes.CREATE_GARDEN_SUCCESS,
        payload: mockGarden
      });

      expect(state.error).toBeNull();
      expect(state.retryCount).toBe(0);
    });
  });

  // Garden Creation Flow Tests
  describe('Garden Creation Flow', () => {
    it('should handle successful garden creation', () => {
      const state = gardenReducer(initialState, {
        type: GardenActionTypes.CREATE_GARDEN_SUCCESS,
        payload: mockGarden
      });

      expect(state.gardens).toHaveLength(1);
      expect(state.currentGarden).toEqual(mockGarden);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should update gardens array while maintaining immutability', () => {
      let state = gardenReducer(initialState, {
        type: GardenActionTypes.CREATE_GARDEN_SUCCESS,
        payload: mockGarden
      });

      const originalGardens = [...state.gardens];

      const secondGarden = {
        ...mockGarden,
        id: 'test-garden-2'
      };

      state = gardenReducer(state, {
        type: GardenActionTypes.CREATE_GARDEN_SUCCESS,
        payload: secondGarden
      });

      expect(state.gardens).toHaveLength(2);
      expect(originalGardens).toHaveLength(1);
      expect(state.gardens).not.toBe(originalGardens);
    });
  });

  // Layout Management Tests
  describe('Layout Management', () => {
    it('should handle layout generation request with no current garden', () => {
      const state = gardenReducer(initialState, {
        type: GardenActionTypes.GENERATE_LAYOUT_REQUEST
      });

      expect(state.error?.code).toBe('E004');
      expect(state.loading).toBe(false);
    });

    it('should reset layout when changing current garden', () => {
      // First set a layout
      let state = gardenReducer(initialState, {
        type: GardenActionTypes.GENERATE_LAYOUT_SUCCESS,
        payload: mockLayout
      });

      // Then change garden
      state = gardenReducer(state, {
        type: GardenActionTypes.SET_CURRENT_GARDEN,
        payload: { ...mockGarden, id: 'different-garden' }
      });

      expect(state.currentLayout).toBeNull();
      expect(state.currentGarden?.id).toBe('different-garden');
    });
  });
});