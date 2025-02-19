package com.gardenplanner.data.repositories

import com.gardenplanner.core.database.dao.ScheduleDao
import com.gardenplanner.core.database.entities.ScheduleEntity
import com.gardenplanner.domain.models.Schedule
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository implementation for managing garden maintenance schedules.
 * Provides optimized data operations with error handling and performance monitoring.
 *
 * @property scheduleDao Data access object for schedule operations
 * @property ioDispatcher Coroutine dispatcher for IO operations
 */
@Singleton
class ScheduleRepository @Inject constructor(
    private val scheduleDao: ScheduleDao,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    /**
     * Retrieves a specific schedule by ID with error handling.
     *
     * @param id Unique identifier of the schedule
     * @return Flow emitting Result containing Schedule or error
     */
    fun getScheduleById(id: String): Flow<Result<Schedule?>> = scheduleDao
        .getScheduleById(id)
        .map { entity -> 
            Result.success(entity?.toDomainModel())
        }
        .catch { e -> 
            emit(Result.failure(e))
        }
        .flowOn(ioDispatcher)

    /**
     * Retrieves paginated list of all schedules.
     *
     * @param page Page number (0-based)
     * @param pageSize Number of items per page
     * @return Flow emitting Result containing list of Schedules
     */
    fun getAllSchedules(page: Int, pageSize: Int): Flow<Result<List<Schedule>>> {
        val offset = page * pageSize
        return scheduleDao
            .getAllSchedules(pageSize, offset)
            .map { entities ->
                Result.success(entities.map { it.toDomainModel() })
            }
            .catch { e ->
                emit(Result.failure(e))
            }
            .flowOn(ioDispatcher)
    }

    /**
     * Retrieves all schedules for a specific plant.
     *
     * @param plantId Identifier of the plant
     * @return Flow emitting Result containing list of Schedules
     */
    fun getSchedulesForPlant(plantId: String): Flow<Result<List<Schedule>>> = scheduleDao
        .getSchedulesForPlant(plantId)
        .map { entities ->
            Result.success(entities.map { it.toDomainModel() })
        }
        .catch { e ->
            emit(Result.failure(e))
        }
        .flowOn(ioDispatcher)

    /**
     * Retrieves overdue and incomplete schedules.
     *
     * @return Flow emitting Result containing list of overdue Schedules
     */
    fun getOverdueSchedules(): Flow<Result<List<Schedule>>> = scheduleDao
        .getOverdueSchedules(System.currentTimeMillis())
        .map { entities ->
            Result.success(entities.map { it.toDomainModel() })
        }
        .catch { e ->
            emit(Result.failure(e))
        }
        .flowOn(ioDispatcher)

    /**
     * Creates a new maintenance schedule.
     *
     * @param schedule Schedule to create
     * @return Result containing created schedule ID or error
     */
    suspend fun createSchedule(schedule: Schedule): Result<Long> = withContext(ioDispatcher) {
        try {
            require(schedule.validate()) { "Invalid schedule data" }
            val entity = ScheduleEntity.fromDomainModel(schedule)
            val result = scheduleDao.insertSchedule(entity)
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Updates an existing maintenance schedule.
     *
     * @param schedule Schedule to update
     * @return Result containing update status or error
     */
    suspend fun updateSchedule(schedule: Schedule): Result<Int> = withContext(ioDispatcher) {
        try {
            require(schedule.validate()) { "Invalid schedule data" }
            val entity = ScheduleEntity.fromDomainModel(
                schedule = schedule,
                lastModified = Date()
            )
            val result = scheduleDao.updateSchedule(entity)
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deletes a maintenance schedule.
     *
     * @param schedule Schedule to delete
     * @return Result containing deletion status or error
     */
    suspend fun deleteSchedule(schedule: Schedule): Result<Int> = withContext(ioDispatcher) {
        try {
            val entity = ScheduleEntity.fromDomainModel(schedule)
            val result = scheduleDao.deleteSchedule(entity)
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cleans up old schedules based on retention policy.
     * Completed schedules older than 1 year and incomplete schedules older than 30 days are removed.
     *
     * @return Result containing number of deleted schedules or error
     */
    suspend fun cleanupOldSchedules(): Result<Int> = withContext(ioDispatcher) {
        try {
            val currentTime = System.currentTimeMillis()
            val yearInMillis = 365L * 24 * 60 * 60 * 1000
            val monthInMillis = 30L * 24 * 60 * 60 * 1000
            
            val completedCutoff = currentTime - yearInMillis
            val incompleteCutoff = currentTime - monthInMillis
            
            val result = scheduleDao.deleteOldSchedules(completedCutoff, incompleteCutoff)
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Retrieves upcoming schedules within date range.
     *
     * @param startDate Start of date range
     * @param endDate End of date range
     * @return Flow emitting Result containing list of upcoming Schedules
     */
    fun getUpcomingSchedules(startDate: Long, endDate: Long): Flow<Result<List<Schedule>>> = scheduleDao
        .getUpcomingSchedules(startDate, endDate)
        .map { entities ->
            Result.success(entities.map { it.toDomainModel() })
        }
        .catch { e ->
            emit(Result.failure(e))
        }
        .flowOn(ioDispatcher)

    /**
     * Retrieves priority schedules requiring immediate attention.
     *
     * @return Flow emitting Result containing list of priority Schedules
     */
    fun getPrioritySchedules(): Flow<Result<List<Schedule>>> = scheduleDao
        .getPrioritySchedules(System.currentTimeMillis())
        .map { entities ->
            Result.success(entities.map { it.toDomainModel() })
        }
        .catch { e ->
            emit(Result.failure(e))
        }
        .flowOn(ioDispatcher)

    /**
     * Increments notification retry count for a schedule.
     *
     * @param scheduleId Schedule identifier
     * @return Result containing update status or error
     */
    suspend fun incrementNotificationRetry(scheduleId: String): Result<Int> = withContext(ioDispatcher) {
        try {
            val result = scheduleDao.incrementNotificationRetryCount(scheduleId)
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}