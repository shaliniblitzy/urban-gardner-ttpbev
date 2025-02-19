package com.gardenplanner.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.gardenplanner.core.database.entities.PlantEntity

/**
 * Data Access Object (DAO) interface for plant-related database operations.
 * Provides optimized queries and transaction support for managing plant data
 * in the local SQLite database.
 */
@Dao
interface PlantDao {

    /**
     * Retrieves all plants from the database, sorted by name.
     * Uses index on name column for optimized query execution.
     *
     * @return List of all plants in alphabetical order
     */
    @Query("SELECT * FROM plants ORDER BY name ASC")
    suspend fun getAllPlants(): List<PlantEntity>

    /**
     * Retrieves a specific plant by its ID.
     * Uses primary key index for efficient lookup.
     *
     * @param plantId Unique identifier of the plant
     * @return The plant entity if found, null otherwise
     */
    @Query("SELECT * FROM plants WHERE id = :plantId")
    suspend fun getPlantById(plantId: String): PlantEntity?

    /**
     * Searches for plants by name pattern with case-insensitive matching.
     * Uses index on name column for optimized search.
     *
     * @param namePattern Pattern to match against plant names
     * @return List of plants matching the name pattern
     */
    @Query("SELECT * FROM plants WHERE LOWER(name) LIKE '%' || LOWER(:namePattern) || '%'")
    suspend fun getPlantsByName(namePattern: String): List<PlantEntity>

    /**
     * Retrieves plants based on sunlight requirements.
     * Useful for garden zone planning.
     *
     * @param minHours Minimum sunlight hours required
     * @param maxHours Maximum sunlight hours required
     * @return List of plants matching the sunlight criteria
     */
    @Query("SELECT * FROM plants WHERE sunlight_hours BETWEEN :minHours AND :maxHours")
    suspend fun getPlantsBySunlightNeeds(minHours: Int, maxHours: Int): List<PlantEntity>

    /**
     * Retrieves plants that require maintenance within specified days.
     *
     * @param daysToMaturity Maximum days to maturity to filter by
     * @return List of plants needing attention within the specified period
     */
    @Query("SELECT * FROM plants WHERE days_to_maturity <= :daysToMaturity ORDER BY days_to_maturity ASC")
    suspend fun getPlantsNeedingMaintenance(daysToMaturity: Int): List<PlantEntity>

    /**
     * Inserts a new plant with conflict resolution.
     * Uses REPLACE strategy to handle unique constraint violations.
     *
     * @param plant Plant entity to insert
     * @return Row ID of the inserted plant
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    @Transaction
    suspend fun insertPlant(plant: PlantEntity): Long

    /**
     * Inserts multiple plants in a single transaction.
     * Useful for bulk data operations.
     *
     * @param plants List of plant entities to insert
     * @return List of inserted row IDs
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    @Transaction
    suspend fun insertPlants(plants: List<PlantEntity>): List<Long>

    /**
     * Updates an existing plant with transaction support.
     *
     * @param plant Plant entity to update
     * @return Number of rows updated (0 or 1)
     */
    @Update
    @Transaction
    suspend fun updatePlant(plant: PlantEntity): Int

    /**
     * Deletes a plant and its related data.
     *
     * @param plant Plant entity to delete
     * @return Number of rows deleted (0 or 1)
     */
    @Delete
    @Transaction
    suspend fun deletePlant(plant: PlantEntity): Int

    /**
     * Retrieves compatible plants for companion planting.
     * Uses optimized join query with indices.
     *
     * @param plantId ID of the plant to find companions for
     * @return List of compatible plants
     */
    @Query("""
        SELECT p.* FROM plants p 
        INNER JOIN plants p2 ON p2.id = :plantId 
        WHERE p.id IN (
            SELECT unnest(p2.companion_plants)
        )
    """)
    @Transaction
    suspend fun getCompatiblePlants(plantId: String): List<PlantEntity>

    /**
     * Retrieves incompatible plants to avoid planting nearby.
     * Uses optimized join query with indices.
     *
     * @param plantId ID of the plant to find incompatible plants for
     * @return List of incompatible plants
     */
    @Query("""
        SELECT p.* FROM plants p 
        INNER JOIN plants p2 ON p2.id = :plantId 
        WHERE p.id IN (
            SELECT unnest(p2.incompatible_plants)
        )
    """)
    @Transaction
    suspend fun getIncompatiblePlants(plantId: String): List<PlantEntity>

    /**
     * Retrieves plants by watering frequency.
     * Useful for maintenance scheduling.
     *
     * @param frequency Watering frequency to filter by
     * @return List of plants with the specified watering frequency
     */
    @Query("SELECT * FROM plants WHERE watering_frequency = :frequency")
    suspend fun getPlantsByWateringFrequency(frequency: String): List<PlantEntity>
}