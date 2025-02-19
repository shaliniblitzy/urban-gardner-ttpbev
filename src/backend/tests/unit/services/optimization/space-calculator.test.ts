import { SpaceCalculatorService } from '../../../../src/services/optimization/space-calculator.service';
import { GARDEN_AREA_LIMITS } from '../../../../src/constants/garden.constants';
import { IGarden, IGardenZone, IGardenLayout, IGardenOptimizationParams } from '../../../../src/interfaces/garden.interface';
import { PLANT_TYPES, SUNLIGHT_REQUIREMENTS } from '../../../../src/constants/plant.constants';

describe('SpaceCalculatorService', () => {
    let spaceCalculatorService: SpaceCalculatorService;
    let mockGarden: IGarden;
    let mockOptimizationParams: IGardenOptimizationParams;

    beforeEach(() => {
        spaceCalculatorService = new SpaceCalculatorService();

        // Initialize mock garden data
        mockGarden = {
            id: 'test-garden-1',
            area: 500,
            zones: [
                {
                    id: 'zone-1',
                    area: 300,
                    sunlightCondition: 'FULL_SUN',
                    plants: [
                        {
                            id: 'plant-1',
                            type: PLANT_TYPES.TOMATOES,
                            spacing: 24,
                            sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN
                        }
                    ]
                },
                {
                    id: 'zone-2',
                    area: 200,
                    sunlightCondition: 'PARTIAL_SHADE',
                    plants: [
                        {
                            id: 'plant-2',
                            type: PLANT_TYPES.LETTUCE,
                            spacing: 12,
                            sunlightNeeds: SUNLIGHT_REQUIREMENTS.PARTIAL_SHADE
                        }
                    ]
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Initialize optimization parameters
        mockOptimizationParams = {
            targetUtilization: 92,
            minZoneSize: 25,
            defaultSpacing: 12,
            maxZoneCount: 3,
            companionPlantingEnabled: true,
            zoneBalancing: 'optimal',
            seasonalAdjustments: false
        };
    });

    describe('calculateOptimalLayout', () => {
        it('should calculate optimal layout for valid garden area', async () => {
            const startTime = Date.now();
            const layout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);

            // Verify performance requirement (<3s)
            expect(Date.now() - startTime).toBeLessThan(3000);

            // Verify layout structure and content
            expect(layout).toBeDefined();
            expect(layout.gardenId).toBe(mockGarden.id);
            expect(layout.spaceUtilization).toBeGreaterThanOrEqual(92);
            expect(layout.zones).toHaveLength(mockGarden.zones.length);
            expect(layout.generatedAt).toBeInstanceOf(Date);
        });

        it('should throw error for invalid garden area', async () => {
            const invalidGarden = { ...mockGarden, area: 0 };
            await expect(
                spaceCalculatorService.calculateOptimalLayout(invalidGarden, mockOptimizationParams)
            ).rejects.toThrow(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`);
        });

        it('should maintain minimum zone sizes', async () => {
            const layout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            
            layout.zones.forEach(zone => {
                expect(zone.area).toBeGreaterThanOrEqual(mockOptimizationParams.minZoneSize);
            });
        });

        it('should optimize space utilization above target threshold', async () => {
            const layout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            expect(layout.spaceUtilization).toBeGreaterThanOrEqual(mockOptimizationParams.targetUtilization);
        });

        it('should cache layout results', async () => {
            // First call should calculate and cache
            const firstLayout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            
            // Second call should return cached result
            const startTime = Date.now();
            const secondLayout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            
            expect(Date.now() - startTime).toBeLessThan(100); // Cache retrieval should be fast
            expect(secondLayout).toEqual(firstLayout);
        });
    });

    describe('calculateZoneDistribution', () => {
        it('should distribute zones proportionally', async () => {
            const layout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            const totalZoneArea = layout.zones.reduce((sum, zone) => sum + zone.area, 0);
            
            // Account for maintenance paths (10% of total area)
            expect(totalZoneArea).toBeLessThanOrEqual(mockGarden.area);
            expect(totalZoneArea).toBeGreaterThanOrEqual(mockGarden.area * 0.9);
        });

        it('should respect sunlight conditions in zone distribution', async () => {
            const layout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            
            // Full sun zones should be larger for better utilization
            const fullSunZone = layout.zones.find(zone => zone.sunlightCondition === 'FULL_SUN');
            const partialShadeZone = layout.zones.find(zone => zone.sunlightCondition === 'PARTIAL_SHADE');
            
            expect(fullSunZone.area).toBeGreaterThan(partialShadeZone.area);
        });
    });

    describe('space requirement validations', () => {
        it('should validate garden area against limits', async () => {
            const oversizedGarden = { ...mockGarden, area: GARDEN_AREA_LIMITS.MAX_AREA + 1 };
            await expect(
                spaceCalculatorService.calculateOptimalLayout(oversizedGarden, mockOptimizationParams)
            ).rejects.toThrow();
        });

        it('should validate plant spacing requirements', async () => {
            const layout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            
            layout.zones.forEach(zone => {
                zone.plants.forEach(plant => {
                    expect(plant.spacing).toBeGreaterThan(0);
                    if (plant.type === PLANT_TYPES.TOMATOES) {
                        expect(plant.spacing).toBeGreaterThanOrEqual(24);
                    }
                });
            });
        });

        it('should handle companion planting optimization', async () => {
            mockOptimizationParams.companionPlantingEnabled = true;
            const layout = await spaceCalculatorService.calculateOptimalLayout(mockGarden, mockOptimizationParams);
            
            // Verify companion plants are placed in compatible zones
            const tomatoZone = layout.zones.find(zone => 
                zone.plants.some(plant => plant.type === PLANT_TYPES.TOMATOES)
            );
            
            expect(tomatoZone.plants.some(plant => 
                plant.type === PLANT_TYPES.LETTUCE
            )).toBeTruthy();
        });

        it('should meet performance requirements under load', async () => {
            const largeGarden = { 
                ...mockGarden, 
                area: GARDEN_AREA_LIMITS.MAX_AREA,
                zones: Array(mockOptimizationParams.maxZoneCount).fill(mockGarden.zones[0])
            };
            
            const startTime = Date.now();
            await spaceCalculatorService.calculateOptimalLayout(largeGarden, mockOptimizationParams);
            
            expect(Date.now() - startTime).toBeLessThan(3000);
        });
    });
});