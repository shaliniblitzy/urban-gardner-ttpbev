package com.gardenplanner.core.notifications

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.gardenplanner.core.notifications.NotificationManager
import com.gardenplanner.domain.models.Schedule
import com.gardenplanner.core.utils.Constants.SCHEDULE.NOTIFICATION_CHANNEL_ID
import com.gardenplanner.core.utils.Constants.SCHEDULE.ERROR_CODES
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import timber.log.Timber
import java.text.SimpleDateFormat
import java.util.*

/**
 * Worker class that handles background processing of garden maintenance notifications
 * with optimized performance and comprehensive error handling.
 *
 * @property context Application context for notification management
 * @property params Worker parameters containing schedule data
 */
class NotificationWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    private val notificationManager = NotificationManager(context)
    private val workerScope = CoroutineScope(Dispatchers.Default)
    private val dateFormatter = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())

    init {
        Timber.plant(Timber.DebugTree())
    }

    override fun doWork(): Result {
        Timber.d("Starting notification work execution")
        val startTime = System.currentTimeMillis()

        try {
            // Extract schedule data from input
            val scheduleId = inputData.getString("schedule_id") ?: return handleError(
                IllegalArgumentException("Missing schedule ID")
            )

            val taskType = inputData.getString("task_type") ?: return handleError(
                IllegalArgumentException("Missing task type")
            )

            val dueDate = inputData.getLong("due_date", 0).let {
                if (it == 0L) return handleError(IllegalArgumentException("Invalid due date"))
                Date(it)
            }

            val plantName = inputData.getString("plant_name") ?: return handleError(
                IllegalArgumentException("Missing plant name")
            )

            val zoneId = inputData.getString("zone_id") ?: return handleError(
                IllegalArgumentException("Missing zone ID")
            )

            // Create schedule object
            val schedule = Schedule(
                id = scheduleId,
                plantId = "", // Not needed for notification
                taskType = taskType,
                dueDate = dueDate,
                completed = false
            )

            // Create and show notification
            val (title, message) = createNotificationContent(schedule, plantName, zoneId)
            
            val notificationData = NotificationManager.NotificationData(
                id = scheduleId.hashCode(),
                title = title,
                message = message,
                taskType = taskType,
                importance = determineNotificationImportance(taskType),
                groupKey = "maintenance_${schedule.dueDate.time}"
            )

            val notificationSuccess = notificationManager.showNotification(notificationData)
            
            if (!notificationSuccess) {
                return handleError(Exception("Failed to show notification"))
            }

            // Log execution metrics
            val executionTime = System.currentTimeMillis() - startTime
            Timber.i("Notification work completed in ${executionTime}ms")

            return Result.success()

        } catch (e: Exception) {
            return handleError(e)
        } finally {
            workerScope.cancel() // Clean up coroutine scope
        }
    }

    /**
     * Creates optimized notification content from schedule data
     */
    private fun createNotificationContent(
        schedule: Schedule,
        plantName: String,
        zoneId: String
    ): Pair<String, String> {
        val title = when (schedule.taskType) {
            "WATER" -> "Time to water your plants!"
            "FERTILIZE" -> "Fertilizer application due"
            "HARVEST" -> "Ready for harvesting"
            else -> "Garden maintenance reminder"
        }

        val message = buildString {
            append(plantName)
            append(" in Zone ")
            append(zoneId)
            append(" needs ")
            append(schedule.taskType.toLowerCase())
            append(" (Due: ")
            append(dateFormatter.format(schedule.dueDate))
            append(")")
        }

        return Pair(title, message)
    }

    /**
     * Determines notification importance based on task type
     */
    private fun determineNotificationImportance(taskType: String): Int {
        return when (taskType) {
            "WATER", "FERTILIZE" -> NotificationManager.NotificationData.IMPORTANCE_HIGH
            "HARVEST" -> NotificationManager.NotificationData.IMPORTANCE_DEFAULT
            else -> NotificationManager.NotificationData.IMPORTANCE_LOW
        }
    }

    /**
     * Handles notification processing errors with proper logging and retry logic
     */
    private fun handleError(error: Throwable): Result {
        Timber.e(error, "Error processing notification: ${error.message}")

        return when {
            error is IllegalArgumentException -> {
                // Data validation errors - don't retry
                Result.failure()
            }
            error.message?.contains("network", ignoreCase = true) == true -> {
                // Network errors - retry with backoff
                Result.retry()
            }
            runAttemptCount < MAX_RETRY_ATTEMPTS -> {
                // Other recoverable errors - retry with backoff
                Result.retry()
            }
            else -> {
                // Max retries exceeded or unrecoverable error
                Result.failure()
            }
        }
    }

    companion object {
        private const val MAX_RETRY_ATTEMPTS = 3
    }
}