package com.gardenplanner.core.notifications

import android.app.NotificationChannel
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.WorkManager
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Data
import androidx.work.WorkRequest
import com.google.firebase.messaging.FirebaseMessaging
import com.gardenplanner.core.utils.Constants.SCHEDULE.NOTIFICATION_CHANNEL_ID
import com.gardenplanner.core.utils.Constants.SCHEDULE.NOTIFICATION_CHANNEL_NAME
import com.gardenplanner.core.utils.Constants.SCHEDULE.TASK_TYPES
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Manages garden maintenance notifications with support for offline operation,
 * notification grouping, and task-specific importance levels.
 * 
 * @property context Application context for system service access
 * @version 1.0
 * @since 2024-01
 */
class NotificationManager(private val context: Context) {

    private val notificationManager: NotificationManagerCompat = NotificationManagerCompat.from(context)
    private val firebaseMessaging: FirebaseMessaging = FirebaseMessaging.getInstance()
    private val workManager: WorkManager = WorkManager.getInstance(context)
    private val appContext: Context = context.applicationContext

    /**
     * Data class representing notification content and metadata
     */
    data class NotificationData(
        val id: Int,
        val title: String,
        val message: String,
        val taskType: String,
        val importance: Int = NotificationManagerCompat.IMPORTANCE_DEFAULT,
        val groupKey: String? = null
    )

    init {
        createNotificationChannels()
        registerFCMToken()
    }

    /**
     * Creates notification channels for different task types with appropriate importance levels
     * for Android O and above.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            TASK_TYPES.forEach { taskType ->
                val importance = when (taskType) {
                    "WATER", "FERTILIZE" -> NotificationManagerCompat.IMPORTANCE_HIGH
                    "HARVEST" -> NotificationManagerCompat.IMPORTANCE_DEFAULT
                    else -> NotificationManagerCompat.IMPORTANCE_LOW
                }

                val channel = NotificationChannel(
                    "${NOTIFICATION_CHANNEL_ID}_${taskType.toLowerCase()}",
                    "$NOTIFICATION_CHANNEL_NAME - ${taskType.capitalize()}",
                    importance
                ).apply {
                    enableVibration(true)
                    enableLights(true)
                    setShowBadge(true)
                }

                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    /**
     * Registers or refreshes FCM token for cloud messaging
     */
    private fun registerFCMToken() {
        firebaseMessaging.token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                // Store token for server communication
                // Implementation depends on app's token management strategy
            }
        }
    }

    /**
     * Schedules a notification for future delivery using WorkManager
     * 
     * @param data Notification content and metadata
     * @param deliveryTime Timestamp for notification delivery
     * @return UUID Unique identifier for the scheduled notification
     */
    fun scheduleNotification(data: NotificationData, deliveryTime: Long): UUID {
        val workData = Data.Builder()
            .putInt("notification_id", data.id)
            .putString("title", data.title)
            .putString("message", data.message)
            .putString("task_type", data.taskType)
            .putInt("importance", data.importance)
            .putString("group_key", data.groupKey)
            .build()

        val currentTime = System.currentTimeMillis()
        val delay = deliveryTime - currentTime

        val notificationWork = OneTimeWorkRequestBuilder<NotificationWorker>()
            .setInputData(workData)
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .setBackoffCriteria(
                WorkRequest.BackoffPolicy.LINEAR,
                WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .build()

        workManager.enqueue(notificationWork)
        return notificationWork.id
    }

    /**
     * Displays a garden maintenance notification with appropriate styling and actions
     * 
     * @param data Notification content and metadata
     * @return Boolean True if notification was shown successfully
     */
    fun showNotification(data: NotificationData): Boolean {
        try {
            val builder = NotificationCompat.Builder(
                appContext,
                "${NOTIFICATION_CHANNEL_ID}_${data.taskType.toLowerCase()}"
            )
                .setSmallIcon(android.R.drawable.ic_dialog_info) // Replace with app icon
                .setContentTitle(data.title)
                .setContentText(data.message)
                .setPriority(data.importance)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)

            // Add group if specified
            data.groupKey?.let {
                builder.setGroup(it)
            }

            // Add action buttons based on task type
            when (data.taskType) {
                "WATER", "FERTILIZE", "HARVEST" -> {
                    builder.addAction(
                        android.R.drawable.ic_menu_done,
                        "Mark Complete",
                        createActionPendingIntent(data.id, "complete")
                    )
                }
            }

            notificationManager.notify(data.id, builder.build())
            return true
        } catch (e: Exception) {
            // Log error and return false
            return false
        }
    }

    /**
     * Processes user interaction with notification
     * 
     * @param notificationId Identifier of the notification
     * @param action User action performed
     */
    fun handleNotificationResponse(notificationId: Int, action: String) {
        when (action) {
            "complete" -> {
                // Update task completion status
                notificationManager.cancel(notificationId)
            }
            "dismiss" -> {
                notificationManager.cancel(notificationId)
            }
        }
    }

    /**
     * Creates PendingIntent for notification actions
     */
    private fun createActionPendingIntent(notificationId: Int, action: String): android.app.PendingIntent {
        val intent = android.content.Intent(appContext, NotificationActionReceiver::class.java).apply {
            action = action
            putExtra("notification_id", notificationId)
        }

        return android.app.PendingIntent.getBroadcast(
            appContext,
            notificationId,
            intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        private const val TAG = "NotificationManager"
    }
}