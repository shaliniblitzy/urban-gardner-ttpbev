package com.gardenplanner.core.database.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import androidx.room.TypeConverters
import androidx.room.Index
import com.gardenplanner.domain.models.Schedule
import java.util.Date

/**
 * Room database entity representing a maintenance schedule record.
 * Includes enhanced tracking capabilities and notification support.
 * Uses indices for optimized query performance on frequently accessed columns.
 */
@Entity(
    tableName = "schedules",
    indices = [
        Index(value = ["due_date", "completed"]),
        Index(value = ["plant_id"]),
        Index(value = ["notification_enabled"])
    ]
)
@TypeConverters(DateConverter::class)
data class ScheduleEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "plant_id")
    val plantId: String,

    @ColumnInfo(name = "task_type")
    val taskType: String,

    @ColumnInfo(name = "due_date")
    val dueDate: Date,

    @ColumnInfo(name = "completed")
    val completed: Boolean,

    @ColumnInfo(name = "notes")
    val notes: String?,

    @ColumnInfo(name = "notification_enabled")
    val notificationEnabled: Boolean,

    @ColumnInfo(name = "completed_date")
    val completedDate: Date?,

    @ColumnInfo(name = "retry_count")
    val retryCount: Int = 0,

    @ColumnInfo(name = "last_modified")
    val lastModified: Date = Date(),

    @ColumnInfo(name = "priority")
    val priority: Int,

    @ColumnInfo(name = "estimated_duration")
    val estimatedDuration: Int
) {

    /**
     * Converts the database entity to a domain model instance.
     * Includes validation of data integrity and handling of null values.
     *
     * @return Schedule domain model instance
     * @throws IllegalStateException if data validation fails
     */
    fun toDomainModel(): Schedule {
        require(id.isNotBlank()) { "Schedule ID cannot be blank" }
        require(plantId.isNotBlank()) { "Plant ID cannot be blank" }
        require(taskType in Schedule.VALID_TASK_TYPES) { "Invalid task type: $taskType" }
        require(priority in Schedule.MIN_PRIORITY..Schedule.MAX_PRIORITY) { 
            "Invalid priority: $priority" 
        }
        require(estimatedDuration >= Schedule.MIN_DURATION) {
            "Invalid duration: $estimatedDuration"
        }

        return Schedule(
            id = id,
            plantId = plantId,
            taskType = taskType,
            dueDate = dueDate,
            completed = completed,
            notes = notes,
            notificationEnabled = notificationEnabled,
            completedDate = completedDate,
            priority = priority,
            estimatedDuration = estimatedDuration
        )
    }

    /**
     * Checks if the schedule record should be archived based on retention policy.
     * Completed schedules are retained for 1 year, uncompleted for 30 days past due date.
     *
     * @return true if the schedule should be archived
     */
    fun isExpired(): Boolean {
        val currentDate = Date()
        val retentionPeriod = if (completed) {
            365L * 24 * 60 * 60 * 1000 // 1 year in milliseconds
        } else {
            30L * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        }

        val expirationDate = if (completed && completedDate != null) {
            Date(completedDate.time + retentionPeriod)
        } else {
            Date(dueDate.time + retentionPeriod)
        }

        return currentDate.after(expirationDate)
    }

    companion object {
        /**
         * Creates a ScheduleEntity from a domain model instance.
         * Preserves existing tracking data if provided.
         *
         * @param schedule Domain model instance
         * @param retryCount Optional retry count (defaults to 0)
         * @param lastModified Optional last modified date (defaults to current time)
         * @return ScheduleEntity instance
         */
        fun fromDomainModel(
            schedule: Schedule,
            retryCount: Int = 0,
            lastModified: Date = Date()
        ): ScheduleEntity {
            return ScheduleEntity(
                id = schedule.id,
                plantId = schedule.plantId,
                taskType = schedule.taskType,
                dueDate = schedule.dueDate,
                completed = schedule.completed,
                notes = schedule.notes,
                notificationEnabled = schedule.notificationEnabled,
                completedDate = schedule.completedDate,
                retryCount = retryCount,
                lastModified = lastModified,
                priority = schedule.priority,
                estimatedDuration = schedule.estimatedDuration
            )
        }
    }
}