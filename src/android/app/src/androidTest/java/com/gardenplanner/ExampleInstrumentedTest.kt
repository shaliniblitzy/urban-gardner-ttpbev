package com.gardenplanner

import android.content.Context
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import android.os.SystemClock
import com.gardenplanner.domain.models.Garden
import com.gardenplanner.domain.models.Plant
import com.gardenplanner.domain.models.Schedule
import com.gardenplanner.core.notifications.NotificationManager
import java.util.Date
import java.util.UUID

/**
 * Comprehensive instrumented test class for validating Android-specific functionality,
 * performance, and core features of the Garden Planner application.
 */
class ExampleInstrumentedTest {

    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    /**
     * Verifies the correct application package context.
     */
    @Test
    fun useAppContext() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.gardenplanner", appContext.packageName)
        assertNotNull("Application context should not be null", appContext)
    }

    /**
     * Validates MainActivity launches correctly with all components initialized.
     */
    @Test
    fun testMainActivityLaunch() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                // Verify activity is created
                assertNotNull("Activity should not be null", activity)

                // Verify essential components are initialized
                assertNotNull("NavController should be initialized", activity.findViewById(R.id.nav_host_fragment))
                assertNotNull("ActionBar should be initialized", activity.supportActionBar)

                // Verify garden setup UI elements
                assertTrue("Garden setup fragment should be accessible",
                    activity.supportFragmentManager.findFragmentById(R.id.nav_host_fragment) != null)
            }
        }
    }

    /**
     * Tests garden optimization performance against 3-second requirement.
     * Validates layout generation time and results.
     */
    @Test
    fun testGardenOptimizationPerformance() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                // Set up test garden parameters
                val testGarden = Garden(
                    id = UUID.randomUUID().toString(),
                    area = 100f,
                    plants = listOf(
                        Plant(
                            id = "tomato1",
                            name = "Tomato",
                            spacing = 2f,
                            quantity = 4,
                            sunlightHours = 6,
                            daysToMaturity = 80,
                            wateringFrequency = "DAILY",
                            companionPlants = listOf("basil1"),
                            incompatiblePlants = listOf()
                        ),
                        Plant(
                            id = "lettuce1",
                            name = "Lettuce",
                            spacing = 1f,
                            quantity = 6,
                            sunlightHours = 4,
                            daysToMaturity = 45,
                            wateringFrequency = "DAILY",
                            companionPlants = listOf(),
                            incompatiblePlants = listOf()
                        )
                    ),
                    zones = listOf(
                        Garden.Zone(
                            id = "zone1",
                            name = "Full Sun",
                            area = 50f,
                            sunlightHours = 6,
                            plants = listOf("tomato1")
                        ),
                        Garden.Zone(
                            id = "zone2",
                            name = "Partial Shade",
                            area = 50f,
                            sunlightHours = 4,
                            plants = listOf("lettuce1")
                        )
                    ),
                    schedules = emptyList(),
                    createdAt = Date()
                )

                // Measure layout generation time
                val startTime = SystemClock.elapsedRealtime()
                val layout = activity.generateGardenLayout(testGarden)
                val endTime = SystemClock.elapsedRealtime()
                val duration = endTime - startTime

                // Verify performance requirements
                assertTrue("Layout generation should complete within 3 seconds",
                    duration <= 3000)

                // Verify layout results
                assertNotNull("Generated layout should not be null", layout)
                assertTrue("Layout should include all plants",
                    layout.plants.size == testGarden.plants.size)
                assertTrue("Space utilization should be calculated",
                    layout.spaceUtilization > 0f)
                assertTrue("Zones should be properly assigned",
                    layout.zones.all { zone -> zone.plants.isNotEmpty() })
            }
        }
    }

    /**
     * Validates notification delivery timing and content.
     * Verifies notifications are delivered within 1 second.
     */
    @Test
    fun testNotificationDelivery() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                // Create test schedule
                val testSchedule = Schedule(
                    id = UUID.randomUUID().toString(),
                    plantId = "tomato1",
                    taskType = "WATERING",
                    dueDate = Date(System.currentTimeMillis() + 1000), // Due in 1 second
                    priority = 1,
                    estimatedDuration = 15
                )

                // Measure notification delivery time
                val startTime = SystemClock.elapsedRealtime()
                activity.scheduleNotification(
                    NotificationManager.NotificationData(
                        id = 1,
                        title = "Water Tomatoes",
                        message = "Time to water your tomatoes",
                        taskType = "WATER",
                        importance = 4
                    ),
                    System.currentTimeMillis() + 500 // Schedule for 500ms from now
                )
                
                // Wait for notification
                SystemClock.sleep(1500) // Wait slightly longer than schedule
                val endTime = SystemClock.elapsedRealtime()
                val deliveryTime = endTime - startTime

                // Verify timing requirements
                assertTrue("Notification should be delivered within 1 second",
                    deliveryTime <= 1000)

                // Verify notification content
                val notificationManager = NotificationManager(activity)
                val activeNotifications = notificationManager
                    .getActiveNotifications()
                assertTrue("Notification should be active",
                    activeNotifications.any { it.id == 1 })
            }
        }
    }
}