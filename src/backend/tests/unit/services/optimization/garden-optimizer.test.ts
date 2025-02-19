import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

import { GardenOptimizerService } from '../../../../src/services/optimization/garden-optimizer.service';
import { SpaceCalculatorService } from '../../../../src/services/optimization/space-calculator.service';
import { CompanionPlantingService } from '../../../../src/services/optimization/companion-planting.service';
import { SunlightAnalyzerService } from '../../../../src/services/optimization/sunlight-analyzer.service';
import { IGarden, IGardenLayout, IGardenZone } from '../../../../src/interfaces/garden.interface';
import { PLANT_TYPES } from '../../../../src/constants/plant.constants';
import { SUNLIGHT_CONDITIONS, SPACE_UTILIZATION_TARGET } from '../../../../src/constants/garden.constants';

describe('GardenOptimizerService', () => {
    let service: GardenOptimizerService;
    let spaceCalculatorService: jest.Mocked<SpaceCalculatorService>;
    let companionPlantingService: jest.Mocked<CompanionPlantingService>;
    let sunlightAnalyzerService: jest.Mocked<SunlightAnalyzerService>;

    beforeEach(async () => {
        // Create mock services
        const mockSpaceCalculator = {
            calculateOptimalLayout: jest.fn(),
            validateGardenArea: jest.fn()
        };

        const mockCompanionPlanting = {
            optimizePlantPlacement: jest.fn(),
            checkCompatibility: jest.fn()
        };

        const mockSunlightAnalyzer = {
            analyzeSunlightDistribution: jest.fn(),
            validateZoneSunlight: jest.fn()
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GardenOptimizerService,
                { provide: SpaceCalculatorService, useValue: mockSpaceCalculator },
                { provide: CompanionPlantingService, useValue: mockCompanionPlanting },
                { provide: SunlightAnalyzerService, useValue: mockSunlightAnalyzer }
            ],
        }).compile();

        service = module.get<GardenOptimizerService>(GardenOptimizerService);
        spaceCalculatorService = module.get(SpaceCalculatorService);
        companionPlantingService = module.get(CompanionPlantingService);
        sunlightAnalyzerService = module.get(SunlightAnalyzerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const createMockGarden = (overrides: Partial<IGarden> = {}): IGarden => ({
        id: 'test-garden-1',
        area: 100,
        zones: [
            {
                id: 'zone-1',
                area: 60,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: [
                    {
                        id: 'plant-1',
                        type: PLANT_TYPES.TOMATOES,
                        spacing: 24,
                        sunlightNeeds: SUNLIGHT_CONDITIONS.FULL_SUN
                    }
                ]
            },
            {
                id: 'zone-2',
                area: 40,
                sunlightCondition: SUNLIGHT_CONDITIONS.PARTIAL_SHADE,
                plants: [
                    {
                        id: 'plant-2',
                        type: PLANT_TYPES.LETTUCE,
                        spacing: 12,
                        sunlightNeeds: SUNLIGHT_CONDITIONS.PARTIAL_SHADE
                    }
                ]
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    });

    describe('optimizeGardenLayout', () => {
        it('should successfully optimize garden layout within performance requirements', async () => {
            // Arrange
            const mockGarden = createMockGarden();
            const startTime = Date.now();
            
            sunlightAnalyzerService.analyzeSunlightDistribution.mockResolvedValue({
                isValid: true
            });

            spaceCalculatorService.calculateOptimalLayout.mockResolvedValue({
                gardenId: mockGarden.id,
                spaceUtilization: 95,
                zones: mockGarden.zones,
                generatedAt: new Date()
            });

            // Act
            const result = await service.optimizeGardenLayout(mockGarden);
            const executionTime = Date.now() - startTime;

            // Assert
            expect(result).toBeDefined();
            expect(result.spaceUtilization).toBeGreaterThanOrEqual(SPACE_UTILIZATION_TARGET);
            expect(executionTime).toBeLessThanOrEqual(3000); // 3-second requirement
            expect(sunlightAnalyzerService.analyzeSunlightDistribution).toHaveBeenCalledWith(mockGarden);
            expect(spaceCalculatorService.calculateOptimalLayout).toHaveBeenCalled();
        });

        it('should handle minimum garden area requirements', async () => {
            // Arrange
            const mockGarden = createMockGarden({ area: 1 });

            // Act & Assert
            await expect(service.optimizeGardenLayout(mockGarden)).resolves.toBeDefined();
        });

        it('should handle maximum garden area requirements', async () => {
            // Arrange
            const mockGarden = createMockGarden({ area: 1000 });

            // Act & Assert
            await expect(service.optimizeGardenLayout(mockGarden)).resolves.toBeDefined();
        });

        it('should throw error for invalid garden area', async () => {
            // Arrange
            const mockGarden = createMockGarden({ area: 0 });

            // Act & Assert
            await expect(service.optimizeGardenLayout(mockGarden))
                .rejects
                .toThrow('Garden area must be between 1 and 1000 sq ft');
        });

        it('should throw error for invalid sunlight conditions', async () => {
            // Arrange
            const mockGarden = createMockGarden();
            sunlightAnalyzerService.analyzeSunlightDistribution.mockResolvedValue({
                isValid: false,
                recommendations: ['Invalid sunlight distribution']
            });

            // Act & Assert
            await expect(service.optimizeGardenLayout(mockGarden))
                .rejects
                .toThrow('Invalid sunlight distribution');
        });
    });

    describe('validateOptimization', () => {
        it('should validate successful optimization results', async () => {
            // Arrange
            const mockLayout: IGardenLayout = {
                gardenId: 'test-garden-1',
                spaceUtilization: 95,
                zones: createMockGarden().zones,
                generatedAt: new Date()
            };

            // Act & Assert
            expect(service['validateOptimization'](mockLayout)).toBeTruthy();
        });

        it('should reject invalid space utilization', async () => {
            // Arrange
            const mockLayout: IGardenLayout = {
                gardenId: 'test-garden-1',
                spaceUtilization: 50, // Below target
                zones: createMockGarden().zones,
                generatedAt: new Date()
            };

            // Act & Assert
            expect(service['validateOptimization'](mockLayout)).toBeFalsy();
        });

        it('should validate plant spacing requirements', async () => {
            // Arrange
            const mockZones: IGardenZone[] = [{
                id: 'zone-1',
                area: 100,
                sunlightCondition: SUNLIGHT_CONDITIONS.FULL_SUN,
                plants: [
                    {
                        id: 'plant-1',
                        type: PLANT_TYPES.TOMATOES,
                        spacing: 0, // Invalid spacing
                        sunlightNeeds: SUNLIGHT_CONDITIONS.FULL_SUN
                    }
                ]
            }];

            const mockLayout: IGardenLayout = {
                gardenId: 'test-garden-1',
                spaceUtilization: 95,
                zones: mockZones,
                generatedAt: new Date()
            };

            // Act & Assert
            expect(service['validateOptimization'](mockLayout)).toBeFalsy();
        });
    });

    describe('recalculateLayout', () => {
        it('should successfully update existing layout', async () => {
            // Arrange
            const mockGarden = createMockGarden();
            const mockLayout: IGardenLayout = {
                gardenId: mockGarden.id,
                spaceUtilization: 95,
                zones: mockGarden.zones,
                generatedAt: new Date()
            };

            spaceCalculatorService.calculateOptimalLayout.mockResolvedValue(mockLayout);

            // Act
            const result = await service['recalculateLayout'](mockGarden, mockLayout);

            // Assert
            expect(result).toBeDefined();
            expect(result.spaceUtilization).toBeGreaterThanOrEqual(SPACE_UTILIZATION_TARGET);
            expect(spaceCalculatorService.calculateOptimalLayout).toHaveBeenCalled();
        });

        it('should handle partial layout updates', async () => {
            // Arrange
            const mockGarden = createMockGarden();
            const partialLayout: Partial<IGardenLayout> = {
                zones: [mockGarden.zones[0]]
            };

            spaceCalculatorService.calculateOptimalLayout.mockResolvedValue({
                gardenId: mockGarden.id,
                spaceUtilization: 95,
                zones: mockGarden.zones,
                generatedAt: new Date()
            });

            // Act
            const result = await service['recalculateLayout'](mockGarden, partialLayout as IGardenLayout);

            // Assert
            expect(result).toBeDefined();
            expect(result.zones).toHaveLength(mockGarden.zones.length);
        });

        it('should handle errors during layout update', async () => {
            // Arrange
            const mockGarden = createMockGarden();
            spaceCalculatorService.calculateOptimalLayout.mockRejectedValue(new Error('Optimization failed'));

            // Act & Assert
            await expect(service['recalculateLayout'](mockGarden, {} as IGardenLayout))
                .rejects
                .toThrow('Optimization failed');
        });
    });
});