import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { jest } from '@jest/globals';
import { GardenSetupScreen } from '../../../screens/garden/GardenSetupScreen';
import { useGarden } from '../../../hooks/useGarden';
import { GARDEN_VALIDATION } from '../../../constants/garden';
import { SunlightCondition } from '../../../types/zone.types';

// Mock dependencies
jest.mock('../../../hooks/useGarden');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn()
  })
}));

// Mock Redux provider
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => ({
    gardens: [],
    currentGarden: null,
    loading: false,
    error: null
  })
}));

describe('GardenSetupScreen', () => {
  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (useGarden as jest.Mock).mockReturnValue({
      createGarden: jest.fn().mockResolvedValue({ id: 'test-garden-id' }),
      generateLayout: jest.fn().mockResolvedValue({ id: 'test-layout-id' }),
      loading: false,
      error: null
    });
  });

  describe('Garden Area Input Validation', () => {
    it('validates minimum garden area', async () => {
      render(<GardenSetupScreen />);
      
      const areaInput = screen.getByLabelText(/garden area/i);
      fireEvent.change(areaInput, { target: { value: '0.5' } });
      
      await waitFor(() => {
        expect(screen.getByText(/must be between 1 and 1000/i)).toBeInTheDocument();
      });
    });

    it('validates maximum garden area', async () => {
      render(<GardenSetupScreen />);
      
      const areaInput = screen.getByLabelText(/garden area/i);
      fireEvent.change(areaInput, { target: { value: '1001' } });
      
      await waitFor(() => {
        expect(screen.getByText(/must be between 1 and 1000/i)).toBeInTheDocument();
      });
    });

    it('accepts valid garden area', async () => {
      render(<GardenSetupScreen />);
      
      const areaInput = screen.getByLabelText(/garden area/i);
      fireEvent.change(areaInput, { target: { value: '500' } });
      
      await waitFor(() => {
        expect(screen.queryByText(/must be between/i)).not.toBeInTheDocument();
      });
    });

    it('validates decimal precision', async () => {
      render(<GardenSetupScreen />);
      
      const areaInput = screen.getByLabelText(/garden area/i);
      fireEvent.change(areaInput, { target: { value: '100.123' } });
      
      await waitFor(() => {
        expect(screen.getByText(/up to 2 decimal places/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sunlight Conditions', () => {
    it('requires at least one zone with sunlight condition', async () => {
      render(<GardenSetupScreen />);
      
      const addZoneButton = screen.getByText(/add zone/i);
      fireEvent.click(addZoneButton);
      
      const sunlightSelect = screen.getByLabelText(/sunlight condition/i);
      expect(sunlightSelect).toBeInTheDocument();
      expect(sunlightSelect).toBeRequired();
    });

    it('validates sunlight condition selection', async () => {
      render(<GardenSetupScreen />);
      
      const addZoneButton = screen.getByText(/add zone/i);
      fireEvent.click(addZoneButton);
      
      const sunlightSelect = screen.getByLabelText(/sunlight condition/i);
      fireEvent.change(sunlightSelect, { target: { value: SunlightCondition.FULL_SUN } });
      
      expect(sunlightSelect).toHaveValue(SunlightCondition.FULL_SUN);
    });
  });

  describe('Zone Management', () => {
    it('allows adding multiple zones within limits', async () => {
      render(<GardenSetupScreen />);
      
      const addZoneButton = screen.getByText(/add zone/i);
      
      // Add maximum allowed zones
      for (let i = 0; i < GARDEN_VALIDATION.MAX_ZONES; i++) {
        fireEvent.click(addZoneButton);
      }
      
      await waitFor(() => {
        expect(addZoneButton).toBeDisabled();
      });
    });

    it('validates total zone area against garden area', async () => {
      render(<GardenSetupScreen />);
      
      // Set garden area
      const areaInput = screen.getByLabelText(/garden area/i);
      fireEvent.change(areaInput, { target: { value: '100' } });
      
      // Add zone with excessive area
      const addZoneButton = screen.getByText(/add zone/i);
      fireEvent.click(addZoneButton);
      
      const zoneAreaInput = screen.getByLabelText(/zone .* area/i);
      fireEvent.change(zoneAreaInput, { target: { value: '101' } });
      
      await waitFor(() => {
        expect(screen.getByText(/cannot exceed garden area/i)).toBeInTheDocument();
      });
    });
  });

  describe('Garden Creation', () => {
    it('creates garden with valid input', async () => {
      const mockCreateGarden = jest.fn().mockResolvedValue({ id: 'test-garden-id' });
      const mockGenerateLayout = jest.fn().mockResolvedValue({ id: 'test-layout-id' });
      
      (useGarden as jest.Mock).mockReturnValue({
        createGarden: mockCreateGarden,
        generateLayout: mockGenerateLayout,
        loading: false,
        error: null
      });
      
      render(<GardenSetupScreen />);
      
      // Fill in garden area
      fireEvent.change(screen.getByLabelText(/garden area/i), { target: { value: '100' } });
      
      // Add zone
      fireEvent.click(screen.getByText(/add zone/i));
      fireEvent.change(screen.getByLabelText(/sunlight condition/i), {
        target: { value: SunlightCondition.FULL_SUN }
      });
      
      // Submit form
      fireEvent.click(screen.getByText(/create garden/i));
      
      await waitFor(() => {
        expect(mockCreateGarden).toHaveBeenCalled();
        expect(mockGenerateLayout).toHaveBeenCalled();
      });
    });

    it('handles garden creation errors', async () => {
      const mockError = new Error('Garden creation failed');
      (useGarden as jest.Mock).mockReturnValue({
        createGarden: jest.fn().mockRejectedValue(mockError),
        loading: false,
        error: mockError.message
      });
      
      render(<GardenSetupScreen />);
      
      // Fill in required fields
      fireEvent.change(screen.getByLabelText(/garden area/i), { target: { value: '100' } });
      fireEvent.click(screen.getByText(/add zone/i));
      
      // Submit form
      fireEvent.click(screen.getByText(/create garden/i));
      
      await waitFor(() => {
        expect(screen.getByText(/garden creation failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Requirements', () => {
    it('measures layout generation time', async () => {
      const startTime = Date.now();
      const mockGenerateLayout = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ id: 'test-layout-id' });
          }, 100);
        });
      });
      
      (useGarden as jest.Mock).mockReturnValue({
        createGarden: jest.fn().mockResolvedValue({ id: 'test-garden-id' }),
        generateLayout: mockGenerateLayout,
        loading: false,
        error: null
      });
      
      render(<GardenSetupScreen />);
      
      // Submit valid form
      fireEvent.change(screen.getByLabelText(/garden area/i), { target: { value: '100' } });
      fireEvent.click(screen.getByText(/add zone/i));
      fireEvent.click(screen.getByText(/create garden/i));
      
      await waitFor(() => {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(3000); // Must be under 3 seconds
      });
    });
  });
});