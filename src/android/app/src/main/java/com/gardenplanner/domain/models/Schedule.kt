package com.gardenplanner.domain.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import java.util.Date

/**
 * Domain model representing a maintenance schedule for plant care activities.
 * Implements Parcelable for efficient data transfer between Android components.
 *
 * @property id Unique identifier for the schedule
 * @property plantId Reference to the associated plant
 * @property taskType Type of maintenance task required
 * @property dueDate When the task should be completed
 * @property completed Whether the task has been completed
 * @property notes Optional notes about the task
 * @property notificationEnabled Whether notifications are enabled for this task
 * @property completedDate When the task was completed (if applicable)
 * @property priority Task priority (1-5, where 1 is highest)
 * @property estimatedDuration Estimated time to complete in minutes
 */
@Parcelize
data class Schedule(
    val id: String,
    val plantId: String,
    val taskType: String,
    val dueDate: Date,
    val completed: Boolean = false,
    val notes: String? = null,
    val notificationEnabled: Boolean = true,
    val completedDate: Date? = null,
    val priority: Int = 3,
    val estimatedDuration: Int = 15
) : Parcelable {

    /**
     * Supported maintenance task types
     */
    companion object {
        val VALID_TASK_TYPES = setOf(
            "WATERING",
            "FERTILIZING",
            "PRUNING",
            "HARVESTING",
            "PEST_CONTROL",
            "WEEDING",
            "SOIL_AMENDMENT",
            "SUPPORT_ADJUSTMENT"
        )

        const val MIN_PRIORITY = 1
        const val MAX_PRIORITY = 5
        const val MIN_DURATION = 5
    }

    /**
     * Validates schedule data according to business rules.
     *
     * @return true if schedule data is valid, false otherwise
     */
    fun validate(): Boolean {
        return id.isNotBlank() &&
                plantId.isNotBlank() &&
                taskType in VALID_TASK_TYPES &&
                priority in MIN_PRIORITY..MAX_PRIORITY &&
                estimatedDuration >= MIN_DURATION &&
                validateCompletionStatus()
    }

    /**
     * Marks the schedule as completed with current timestamp.
     * Updates completion status and sets completion date.
     */
    fun markCompleted() {
        if (!completed) {
            val updatedSchedule = this.copy(
                completed = true,
                completedDate = Date()
            )
            // Return a new instance with updated completion status
            return updatedSchedule
        }
    }

    /**
     * Checks if the schedule is overdue based on current date and completion status.
     *
     * @return true if schedule is overdue, false otherwise
     */
    fun isOverdue(): Boolean {
        if (completed) return false
        
        val currentDate = Date()
        val overdueDays = when (priority) {
            1 -> 1 // High priority tasks are overdue after 1 day
            2 -> 2
            3 -> 3
            4 -> 5
            5 -> 7 // Low priority tasks are overdue after 7 days
            else -> 3 // Default to 3 days for invalid priority
        }

        val overdueThreshold = Date(dueDate.time + (overdueDays * 24 * 60 * 60 * 1000L))
        return currentDate.after(overdueThreshold)
    }

    /**
     * Validates the completion status and date consistency.
     *
     * @return true if completion status is valid, false otherwise
     */
    private fun validateCompletionStatus(): Boolean {
        return if (completed) {
            completedDate != null && completedDate.after(dueDate)
        } else {
            completedDate == null
        }
    }

    /**
     * Creates a rescheduled version of this task.
     *
     * @param newDueDate The new due date for the rescheduled task
     * @return A new Schedule instance with updated due date and reset completion status
     */
    fun reschedule(newDueDate: Date): Schedule {
        return this.copy(
            dueDate = newDueDate,
            completed = false,
            completedDate = null
        )
    }

    /**
     * Updates the priority of the schedule.
     *
     * @param newPriority The new priority level (1-5)
     * @return A new Schedule instance with updated priority if valid, null otherwise
     */
    fun updatePriority(newPriority: Int): Schedule? {
        return if (newPriority in MIN_PRIORITY..MAX_PRIORITY) {
            this.copy(priority = newPriority)
        } else null
    }

    /**
     * Toggles notification settings for this schedule.
     *
     * @return A new Schedule instance with toggled notification setting
     */
    fun toggleNotifications(): Schedule {
        return this.copy(notificationEnabled = !notificationEnabled)
    }
}