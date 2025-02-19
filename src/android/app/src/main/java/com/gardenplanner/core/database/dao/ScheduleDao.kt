package com.gardenplanner.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.gardenplanner.core.database.entities.ScheduleEntity
import kotlinx.coroutines.flow.Flow

/**
 * Room Database Data Access Object (DAO) for garden maintenance schedule operations.
 * Provides reactive, transactional, and optimized database access with comprehensive error handling.
 * Implements retention policies and performance monitoring for production usage.
 */
@Dao
interface ScheduleDao {

    /**
     * Retrieves a specific schedule by its unique identifier.
     * Uses indexed query for optimal performance.
     *
     * @param id Unique identifier of the schedule
     * @return Flow emitting the schedule entity or null if not found
     */
    @Query("SELECT * FROM schedules WHERE id = :id")
    fun getScheduleById(id: String): Flow<ScheduleEntity?>

    /**
     * Retrieves all maintenance schedules with pagination support.
     * Orders results by due date for logical presentation.
     *
     * @param limit Maximum number of records to retrieve
     * @param offset Number of records to skip
     * @return Flow emitting list of schedule entities
     */
    @Query("""
        SELECT * FROM schedules 
        ORDER BY due_date DESC 
        LIMIT :limit OFFSET :offset
    """)
    fun getAllSchedules(limit: Int, offset: Int): Flow<List<ScheduleEntity>>

    /**
     * Retrieves all schedules for a specific plant.
     * Uses indexed query on plant_id for performance.
     *
     * @param plantId Identifier of the plant
     * @return Flow emitting list of schedules for the plant
     */
    @Query("""
        SELECT * FROM schedules 
        WHERE plant_id = :plantId 
        ORDER BY due_date ASC
    """)
    fun getSchedulesForPlant(plantId: String): Flow<List<ScheduleEntity>>

    /**
     * Retrieves overdue and incomplete schedules requiring notification.
     * Uses composite index on due_date and completed columns.
     *
     * @param currentDate Current timestamp for comparison
     * @return Flow emitting list of overdue schedules
     */
    @Query("""
        SELECT * FROM schedules 
        WHERE due_date < :currentDate 
        AND completed = 0 
        AND notification_enabled = 1 
        AND retry_count < 3
        ORDER BY priority ASC, due_date ASC
    """)
    fun getOverdueSchedules(currentDate: Long): Flow<List<ScheduleEntity>>

    /**
     * Retrieves upcoming schedules within specified date range.
     * Supports notification scheduling and task planning.
     *
     * @param startDate Start of date range
     * @param endDate End of date range
     * @return Flow emitting list of upcoming schedules
     */
    @Query("""
        SELECT * FROM schedules 
        WHERE due_date BETWEEN :startDate AND :endDate 
        AND completed = 0 
        AND notification_enabled = 1
        ORDER BY due_date ASC, priority ASC
    """)
    fun getUpcomingSchedules(startDate: Long, endDate: Long): Flow<List<ScheduleEntity>>

    /**
     * Inserts a new schedule with conflict resolution.
     * Uses REPLACE strategy to handle potential duplicates.
     *
     * @param schedule Schedule entity to insert
     * @return Row ID of inserted schedule
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    @Transaction
    suspend fun insertSchedule(schedule: ScheduleEntity): Long

    /**
     * Batch inserts multiple schedules atomically.
     * Useful for bulk schedule creation.
     *
     * @param schedules List of schedule entities to insert
     * @return List of inserted row IDs
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    @Transaction
    suspend fun insertSchedules(schedules: List<ScheduleEntity>): List<Long>

    /**
     * Updates an existing schedule with completion tracking.
     * Maintains atomicity for consistent data state.
     *
     * @param schedule Updated schedule entity
     * @return Number of rows updated
     */
    @Update
    @Transaction
    suspend fun updateSchedule(schedule: ScheduleEntity): Int

    /**
     * Deletes a specific schedule.
     * Maintains referential integrity through transaction.
     *
     * @param schedule Schedule entity to delete
     * @return Number of rows deleted
     */
    @Delete
    @Transaction
    suspend fun deleteSchedule(schedule: ScheduleEntity): Int

    /**
     * Implements retention policy by deleting old schedules.
     * Handles completed and incomplete schedules differently.
     *
     * @param completedCutoffDate Cutoff date for completed schedules (1 year)
     * @param incompleteCutoffDate Cutoff date for incomplete schedules (30 days)
     * @return Number of rows deleted
     */
    @Query("""
        DELETE FROM schedules 
        WHERE (completed = 1 AND due_date < :completedCutoffDate) 
        OR (completed = 0 AND due_date < :incompleteCutoffDate)
    """)
    @Transaction
    suspend fun deleteOldSchedules(
        completedCutoffDate: Long,
        incompleteCutoffDate: Long
    ): Int

    /**
     * Updates notification retry count for failed notifications.
     * Supports notification retry logic with limit tracking.
     *
     * @param scheduleId Schedule identifier
     * @return Number of rows updated
     */
    @Query("""
        UPDATE schedules 
        SET retry_count = retry_count + 1 
        WHERE id = :scheduleId AND retry_count < 3
    """)
    @Transaction
    suspend fun incrementNotificationRetryCount(scheduleId: String): Int

    /**
     * Retrieves schedules requiring immediate attention.
     * Prioritizes high-priority and overdue tasks.
     *
     * @param currentDate Current timestamp for comparison
     * @return Flow emitting list of priority schedules
     */
    @Query("""
        SELECT * FROM schedules 
        WHERE completed = 0 
        AND (
            (priority <= 2 AND due_date <= :currentDate) 
            OR (due_date < :currentDate)
        )
        ORDER BY priority ASC, due_date ASC 
        LIMIT 10
    """)
    fun getPrioritySchedules(currentDate: Long): Flow<List<ScheduleEntity>>
}