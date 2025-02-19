package com.gardenplanner.core.database.dao

import androidx.room.Dao // v2.5.0
import androidx.room.Query // v2.5.0
import androidx.room.Insert // v2.5.0
import androidx.room.Update // v2.5.0
import androidx.room.Delete // v2.5.0
import androidx.room.Transaction // v2.5.0
import kotlinx.coroutines.flow.Flow // v1.7.0
import com.gardenplanner.core.database.entities.GardenEntity

/**
 * Data Access Object (DAO) interface for garden-related database operations.
 * Provides optimized queries for garden layout management and space utilization tracking.
 * All operations are designed to complete within 3 seconds per performance requirements.
 */
@Dao
interface GardenDao {

    /**
     * Retrieves a specific garden by its ID with reactive updates.
     * Uses indexed query for optimal performance.
     *
     * @param gardenId Unique identifier of the garden
     * @return Flow emitting the garden entity or null if not found
     */
    @Query("""
        SELECT * FROM gardens 
        WHERE id = :gardenId
    """)
    fun getGardenById(gardenId: String): Flow<GardenEntity?>

    /**
     * Retrieves all gardens ordered by creation date.
     * Supports real-time updates for garden list displays.
     *
     * @return Flow emitting list of all garden entities
     */
    @Query("""
        SELECT * FROM gardens 
        ORDER BY created_at DESC
    """)
    fun getAllGardens(): Flow<List<GardenEntity>>

    /**
     * Retrieves gardens with optimized layouts, sorted by space utilization.
     * Uses compound index on isOptimized and spaceUtilization for performance.
     *
     * @return Flow emitting list of optimized garden entities
     */
    @Query("""
        SELECT * FROM gardens 
        WHERE is_optimized = 1 
        ORDER BY space_utilization DESC
    """)
    fun getOptimizedGardens(): Flow<List<GardenEntity>>

    /**
     * Retrieves gardens requiring optimization (space utilization below threshold).
     *
     * @param threshold Minimum acceptable space utilization percentage
     * @return Flow emitting list of gardens needing optimization
     */
    @Query("""
        SELECT * FROM gardens 
        WHERE is_optimized = 0 
        OR space_utilization < :threshold 
        ORDER BY space_utilization ASC
    """)
    fun getGardensNeedingOptimization(threshold: Float = 70.0f): Flow<List<GardenEntity>>

    /**
     * Inserts a new garden with atomic transaction guarantee.
     *
     * @param garden Garden entity to insert
     * @return Row ID of the inserted garden
     */
    @Insert
    @Transaction
    suspend fun insertGarden(garden: GardenEntity): Long

    /**
     * Updates an existing garden with atomic transaction guarantee.
     *
     * @param garden Garden entity to update
     * @return Number of rows updated (should be 1)
     */
    @Update
    @Transaction
    suspend fun updateGarden(garden: GardenEntity): Int

    /**
     * Deletes a garden with atomic transaction guarantee.
     *
     * @param garden Garden entity to delete
     * @return Number of rows deleted (should be 1)
     */
    @Delete
    @Transaction
    suspend fun deleteGarden(garden: GardenEntity): Int

    /**
     * Updates optimization status and space utilization for a garden.
     *
     * @param gardenId Garden identifier
     * @param isOptimized New optimization status
     * @param spaceUtilization New space utilization percentage
     * @return Number of rows updated
     */
    @Query("""
        UPDATE gardens 
        SET is_optimized = :isOptimized, 
            space_utilization = :spaceUtilization,
            last_modified_at = :lastModifiedAt
        WHERE id = :gardenId
    """)
    @Transaction
    suspend fun updateGardenOptimization(
        gardenId: String,
        isOptimized: Boolean,
        spaceUtilization: Float,
        lastModifiedAt: Long = System.currentTimeMillis()
    ): Int

    /**
     * Retrieves gardens created within a specific date range.
     *
     * @param startDate Start of date range in milliseconds
     * @param endDate End of date range in milliseconds
     * @return Flow emitting list of gardens within date range
     */
    @Query("""
        SELECT * FROM gardens 
        WHERE created_at BETWEEN :startDate AND :endDate 
        ORDER BY created_at DESC
    """)
    fun getGardensByDateRange(startDate: Long, endDate: Long): Flow<List<GardenEntity>>

    /**
     * Retrieves gardens with space utilization within specified range.
     *
     * @param minUtilization Minimum space utilization percentage
     * @param maxUtilization Maximum space utilization percentage
     * @return Flow emitting list of gardens within utilization range
     */
    @Query("""
        SELECT * FROM gardens 
        WHERE space_utilization BETWEEN :minUtilization AND :maxUtilization 
        ORDER BY space_utilization DESC
    """)
    fun getGardensByUtilization(
        minUtilization: Float,
        maxUtilization: Float
    ): Flow<List<GardenEntity>>
}