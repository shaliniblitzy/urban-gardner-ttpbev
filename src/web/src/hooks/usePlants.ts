import { useEffect, useState, useCallback, useMemo } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { Plant, PlantType, GrowthStage, PlantHealth, MaintenanceType } from '../types/plant.types';
import { plantService } from '../services/plant.service';

// Constants for performance optimization
const DEBOUNCE_DELAY = 300;
const BATCH_SIZE = 50;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Types for hook state and errors
interface PlantError {
    code: string;
    message: string;
    context?: Record<string, unknown>;
}

interface PlantCache {
    data: Plant[];
    timestamp: number;
}

interface PlantState {
    plants: Plant[];
    loading: boolean;
    error: PlantError | null;
}

/**
 * Custom hook for managing plant-related operations with enhanced performance
 * and comprehensive error handling
 */
export const usePlants = () => {
    // Local state management
    const [state, setState] = useState<PlantState>({
        plants: [],
        loading: false,
        error: null
    });

    // Cache management
    const [cache, setCache] = useState<PlantCache | null>(null);

    // Redux integration
    const dispatch = useDispatch();
    const reduxPlants = useSelector((state: any) => state.plants.items);

    // Cleanup and abort controller
    const abortController = useMemo(() => new AbortController(), []);

    /**
     * Fetches all plants with caching and error handling
     */
    const fetchPlants = useCallback(async () => {
        // Check cache validity
        if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
            setState(prev => ({ ...prev, plants: cache.data }));
            return;
        }

        setState(prev => ({ ...prev, loading: true }));
        try {
            const response = await plantService.getAllPlants({
                page: 1,
                limit: BATCH_SIZE,
                sortBy: 'plantedDate',
                sortOrder: 'desc'
            });
            
            const newCache: PlantCache = {
                data: response.items,
                timestamp: Date.now()
            };
            setCache(newCache);
            setState(prev => ({
                ...prev,
                plants: response.items,
                loading: false
            }));
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: {
                    code: error.code || 'FETCH_ERROR',
                    message: error.message,
                    context: error.context
                },
                loading: false
            }));
        }
    }, [cache]);

    /**
     * Adds a new plant with optimistic updates
     */
    const addPlant = useCallback(async (plantData: Omit<Plant, 'id'>) => {
        const optimisticId = `temp-${Date.now()}`;
        const optimisticPlant = { ...plantData, id: optimisticId };

        // Optimistic update
        setState(prev => ({
            ...prev,
            plants: [...prev.plants, optimisticPlant]
        }));

        try {
            const newPlant = await plantService.createPlant(plantData);
            setState(prev => ({
                ...prev,
                plants: prev.plants.map(p => 
                    p.id === optimisticId ? newPlant : p
                )
            }));
            return newPlant;
        } catch (error: any) {
            // Rollback optimistic update
            setState(prev => ({
                ...prev,
                plants: prev.plants.filter(p => p.id !== optimisticId),
                error: {
                    code: error.code || 'CREATE_ERROR',
                    message: error.message,
                    context: error.context
                }
            }));
            throw error;
        }
    }, []);

    /**
     * Updates plant with optimistic updates and batching
     */
    const updatePlant = useCallback(async (id: string, updates: Partial<Plant>) => {
        // Optimistic update
        setState(prev => ({
            ...prev,
            plants: prev.plants.map(p => 
                p.id === id ? { ...p, ...updates } : p
            )
        }));

        try {
            const updatedPlant = await plantService.updatePlant(id, updates);
            return updatedPlant;
        } catch (error: any) {
            // Rollback optimistic update
            setState(prev => ({
                ...prev,
                plants: prev.plants.map(p => 
                    p.id === id ? { ...p, ...reduxPlants.find((rp: Plant) => rp.id === id) } : p
                ),
                error: {
                    code: error.code || 'UPDATE_ERROR',
                    message: error.message,
                    context: error.context
                }
            }));
            throw error;
        }
    }, [reduxPlants]);

    /**
     * Deletes plant with optimistic deletion
     */
    const deletePlant = useCallback(async (id: string) => {
        const plantToDelete = state.plants.find(p => p.id === id);
        
        // Optimistic deletion
        setState(prev => ({
            ...prev,
            plants: prev.plants.filter(p => p.id !== id)
        }));

        try {
            await plantService.deletePlant(id);
        } catch (error: any) {
            // Rollback optimistic deletion
            setState(prev => ({
                ...prev,
                plants: plantToDelete ? [...prev.plants, plantToDelete] : prev.plants,
                error: {
                    code: error.code || 'DELETE_ERROR',
                    message: error.message,
                    context: error.context
                }
            }));
            throw error;
        }
    }, [state.plants]);

    /**
     * Retrieves plant growth information with caching
     */
    const getPlantGrowthInfo = useCallback(async (id: string) => {
        try {
            const response = await plantService.getPlantById(id);
            return {
                growthStage: response.growthStage,
                daysToMaturity: response.daysToMaturity,
                healthStatus: response.healthStatus
            };
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: {
                    code: error.code || 'GROWTH_INFO_ERROR',
                    message: error.message,
                    context: error.context
                }
            }));
            throw error;
        }
    }, []);

    /**
     * Retrieves plants needing maintenance
     */
    const getPlantsNeedingMaintenance = useCallback(async () => {
        try {
            const plants = state.plants.filter(plant => {
                const lastWatered = new Date(plant.lastWateredDate);
                const lastFertilized = new Date(plant.lastFertilizedDate);
                const now = new Date();
                
                return (
                    now.getTime() - lastWatered.getTime() > 2 * 24 * 60 * 60 * 1000 || // 2 days
                    now.getTime() - lastFertilized.getTime() > 7 * 24 * 60 * 60 * 1000 // 7 days
                );
            });
            return plants;
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: {
                    code: error.code || 'MAINTENANCE_ERROR',
                    message: error.message,
                    context: error.context
                }
            }));
            throw error;
        }
    }, [state.plants]);

    /**
     * Checks zone compatibility for plants
     */
    const checkZoneCompatibility = useCallback(async (plantType: PlantType, zoneId: string) => {
        try {
            const zoneData = await plantService.getPlantZones(zoneId);
            return zoneData.compatiblePlants.includes(plantType);
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                error: {
                    code: error.code || 'COMPATIBILITY_ERROR',
                    message: error.message,
                    context: error.context
                }
            }));
            throw error;
        }
    }, []);

    /**
     * Performs batch updates for multiple plants
     */
    const batchUpdatePlants = useCallback(async (updates: Array<{ id: string; data: Partial<Plant> }>) => {
        // Optimistic update
        setState(prev => ({
            ...prev,
            plants: prev.plants.map(plant => {
                const update = updates.find(u => u.id === plant.id);
                return update ? { ...plant, ...update.data } : plant;
            })
        }));

        try {
            const updatedPlants = await plantService.batchUpdatePlants(updates);
            return updatedPlants;
        } catch (error: any) {
            // Rollback optimistic updates
            setState(prev => ({
                ...prev,
                plants: reduxPlants,
                error: {
                    code: error.code || 'BATCH_UPDATE_ERROR',
                    message: error.message,
                    context: error.context
                }
            }));
            throw error;
        }
    }, [reduxPlants]);

    /**
     * Clears the plant cache
     */
    const clearCache = useCallback(() => {
        setCache(null);
    }, []);

    // Initial data fetch and cleanup
    useEffect(() => {
        fetchPlants();
        
        return () => {
            abortController.abort();
        };
    }, [fetchPlants, abortController]);

    return {
        plants: state.plants,
        loading: state.loading,
        error: state.error,
        addPlant,
        updatePlant,
        deletePlant,
        getPlantGrowthInfo,
        getPlantsNeedingMaintenance,
        checkZoneCompatibility,
        batchUpdatePlants,
        clearCache
    };
};