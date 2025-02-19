package com.gardenplanner.data.repositories

import com.gardenplanner.core.database.dao.PlantDao
import com.gardenplanner.core.database.entities.PlantEntity
import com.gardenplanner.domain.models.Plant
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Thread-safe repository implementation for managing plant data with reactive streams,
 * caching, and comprehensive error handling.
 *
 * @property plantDao Data access object for plant database operations
 * @property plantCache Thread-safe cache for frequently accessed plants
 * @property repositoryScope Coroutine scope for repository operations
 */
@Singleton
class PlantRepository @Inject constructor(
    private val plantDao: PlantDao,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    private val plantCache = ConcurrentHashMap<String, CacheEntry>()
    private val cacheTimeout = TimeUnit.MINUTES.toMillis(15)
    
    private val repositoryScope = CoroutineScope(
        SupervisorJob() + dispatcher + CoroutineExceptionHandler { _, throwable ->
            Timber.e(throwable, "Error in PlantRepository scope")
        }
    )

    private data class CacheEntry(
        val plant: Plant,
        val timestamp: Long = System.currentTimeMillis()
    )

    /**
     * Retrieves all plants with caching and reactive updates.
     * @return Flow of plant list with error handling
     */
    fun getAllPlants(): Flow<List<Plant>> = flow {
        try {
            val plants = plantDao.getAllPlants().map { entity ->
                getCachedOrTransform(entity)
            }
            emit(plants)
        } catch (e: Exception) {
            Timber.e(e, "Error retrieving all plants")
            throw e
        }
    }.flowOn(dispatcher)
        .catch { e -> 
            Timber.e(e, "Error in getAllPlants flow")
            emit(emptyList())
        }

    /**
     * Retrieves a specific plant with cache support.
     * @param plantId Unique identifier of the plant
     * @return Plant if found, null otherwise
     */
    suspend fun getPlantById(plantId: String): Plant? = withContext(dispatcher) {
        try {
            // Check cache first
            plantCache[plantId]?.let { entry ->
                if (System.currentTimeMillis() - entry.timestamp < cacheTimeout) {
                    return@withContext entry.plant
                }
            }

            // Cache miss or expired, query database
            val entity = plantDao.getPlantById(plantId)
            return@withContext entity?.let { getCachedOrTransform(it) }
        } catch (e: Exception) {
            Timber.e(e, "Error retrieving plant by ID: $plantId")
            null
        }
    }

    /**
     * Saves plant with validation and cache update.
     * @param plant Plant to save
     * @return Success status with error details
     */
    suspend fun savePlant(plant: Plant): Boolean = withContext(dispatcher) {
        try {
            require(plant.validate()) { "Invalid plant data" }
            
            val entity = PlantEntity.fromDomainModel(plant)
            val result = if (plantDao.getPlantById(plant.id) != null) {
                plantDao.updatePlant(entity) > 0
            } else {
                plantDao.insertPlant(entity) > 0
            }

            if (result) {
                plantCache[plant.id] = CacheEntry(plant)
            }
            result
        } catch (e: Exception) {
            Timber.e(e, "Error saving plant: ${plant.id}")
            false
        }
    }

    /**
     * Removes plant with cache invalidation.
     * @param plant Plant to delete
     * @return Success status with error details
     */
    suspend fun deletePlant(plant: Plant): Boolean = withContext(dispatcher) {
        try {
            val entity = PlantEntity.fromDomainModel(plant)
            val result = plantDao.deletePlant(entity) > 0
            if (result) {
                plantCache.remove(plant.id)
            }
            result
        } catch (e: Exception) {
            Timber.e(e, "Error deleting plant: ${plant.id}")
            false
        }
    }

    /**
     * Finds compatible plants with reactive updates.
     * @param plant Plant to find companions for
     * @return Flow of compatible plants
     */
    fun getCompatiblePlants(plant: Plant): Flow<List<Plant>> = flow {
        try {
            val compatiblePlants = plantDao.getCompatiblePlants(plant.id)
                .filter { entity -> 
                    val domainModel = getCachedOrTransform(entity)
                    plant.isCompatibleWith(domainModel)
                }
                .map { entity -> getCachedOrTransform(entity) }
            emit(compatiblePlants)
        } catch (e: Exception) {
            Timber.e(e, "Error retrieving compatible plants for: ${plant.id}")
            emit(emptyList())
        }
    }.flowOn(dispatcher)
        .catch { e ->
            Timber.e(e, "Error in getCompatiblePlants flow")
            emit(emptyList())
        }

    /**
     * Helper function to get cached plant or transform entity.
     * @param entity Plant entity from database
     * @return Transformed and cached plant domain model
     */
    private fun getCachedOrTransform(entity: PlantEntity): Plant {
        val cached = plantCache[entity.id]
        if (cached != null && System.currentTimeMillis() - cached.timestamp < cacheTimeout) {
            return cached.plant
        }

        val plant = entity.toDomainModel()
        plantCache[entity.id] = CacheEntry(plant)
        return plant
    }

    /**
     * Clears expired cache entries.
     */
    private suspend fun cleanCache() = withContext(dispatcher) {
        val currentTime = System.currentTimeMillis()
        plantCache.entries.removeIf { (_, entry) ->
            currentTime - entry.timestamp > cacheTimeout
        }
    }

    companion object {
        private const val TAG = "PlantRepository"
    }
}