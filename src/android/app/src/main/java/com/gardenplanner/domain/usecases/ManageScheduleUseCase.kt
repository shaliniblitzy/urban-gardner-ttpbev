package com.gardenplanner.domain.usecases

import com.gardenplanner.data.repositories.ScheduleRepository
import com.gardenplanner.domain.models.Schedule
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case implementing business logic for managing garden maintenance schedules.
 * Provides enhanced error handling, performance optimization, and offline support.
 *
 * @property scheduleRepository Repository for schedule data operations
 */
@Singleton
class ManageScheduleUseCase @Inject constructor(
    private val scheduleRepository: ScheduleRepository
) {
    /**
     * Creates a new maintenance schedule with enhanced validation.
     *
     * @param schedule Schedule to create
     * @return Result containing created schedule ID or detailed failure
     */
    suspend fun createSchedule(schedule: Schedule): Result<Long> {
        return try {
            require(schedule.validate()) { "Invalid schedule data" }
            scheduleRepository.createSchedule(schedule)
        } catch (e: Exception) {
            Result.failure(IllegalArgumentException("Failed to create schedule: ${e.message}"))
        }
    }

    /**
     * Updates an existing maintenance schedule with feedback handling.
     *
     * @param schedule Schedule to update
     * @return Result containing update status or detailed failure
     */
    suspend fun updateSchedule(schedule: Schedule): Result<Int> {
        return try {
            require(schedule.validate()) { "Invalid schedule data" }
            scheduleRepository.updateSchedule(schedule)
        } catch (e: Exception) {
            Result.failure(IllegalArgumentException("Failed to update schedule: ${e.message}"))
        }
    }

    /**
     * Marks a schedule as completed with state preservation.
     *
     * @param schedule Schedule to mark as completed
     * @return Result containing update status or detailed failure
     */
    suspend fun completeSchedule(schedule: Schedule): Result<Int> {
        return try {
            val completedSchedule = schedule.markCompleted()
            scheduleRepository.updateSchedule(completedSchedule)
        } catch (e: Exception) {
            Result.failure(IllegalArgumentException("Failed to complete schedule: ${e.message}"))
        }
    }

    /**
     * Deletes an existing maintenance schedule with cleanup.
     *
     * @param schedule Schedule to delete
     * @return Result containing deletion status or detailed failure
     */
    suspend fun deleteSchedule(schedule: Schedule): Result<Int> {
        return try {
            scheduleRepository.deleteSchedule(schedule)
        } catch (e: Exception) {
            Result.failure(IllegalArgumentException("Failed to delete schedule: ${e.message}"))
        }
    }

    /**
     * Retrieves all overdue maintenance schedules with priority sorting.
     * Implements optimized flow emission with error handling.
     *
     * @return Flow emitting Result containing sorted list of overdue schedules
     */
    fun getOverdueSchedules(): Flow<Result<List<Schedule>>> {
        return scheduleRepository.getOverdueSchedules()
            .map { result ->
                result.map { schedules ->
                    schedules.sortedWith(
                        compareBy<Schedule> { it.priority }
                            .thenBy { it.dueDate }
                    )
                }
            }
            .catch { e ->
                emit(Result.failure(IllegalStateException("Failed to retrieve overdue schedules: ${e.message}")))
            }
    }

    /**
     * Retrieves upcoming schedules for a specific plant.
     *
     * @param plantId Identifier of the plant
     * @return Flow emitting Result containing list of upcoming schedules
     */
    fun getSchedulesForPlant(plantId: String): Flow<Result<List<Schedule>>> {
        return scheduleRepository.getSchedulesForPlant(plantId)
            .catch { e ->
                emit(Result.failure(IllegalStateException("Failed to retrieve plant schedules: ${e.message}")))
            }
    }

    /**
     * Retrieves paginated list of all schedules.
     *
     * @param page Page number (0-based)
     * @param pageSize Number of items per page
     * @return Flow emitting Result containing paginated list of schedules
     */
    fun getAllSchedules(page: Int = 0, pageSize: Int = 20): Flow<Result<List<Schedule>>> {
        require(page >= 0) { "Page number must be non-negative" }
        require(pageSize > 0) { "Page size must be positive" }
        
        return scheduleRepository.getAllSchedules(page, pageSize)
            .catch { e ->
                emit(Result.failure(IllegalStateException("Failed to retrieve schedules: ${e.message}")))
            }
    }

    /**
     * Retrieves priority schedules requiring immediate attention.
     *
     * @return Flow emitting Result containing list of priority schedules
     */
    fun getPrioritySchedules(): Flow<Result<List<Schedule>>> {
        return scheduleRepository.getPrioritySchedules()
            .catch { e ->
                emit(Result.failure(IllegalStateException("Failed to retrieve priority schedules: ${e.message}")))
            }
    }

    /**
     * Performs cleanup of old schedules based on retention policy.
     *
     * @return Result containing number of cleaned up schedules or error
     */
    suspend fun cleanupOldSchedules(): Result<Int> {
        return try {
            scheduleRepository.cleanupOldSchedules()
        } catch (e: Exception) {
            Result.failure(IllegalStateException("Failed to cleanup old schedules: ${e.message}"))
        }
    }
}