package com.gardenplanner

import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.navigateUp
import androidx.navigation.ui.setupActionBarWithNavController
import com.gardenplanner.core.database.AppDatabase
import com.gardenplanner.core.notifications.NotificationManager
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.logEvent
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Main activity that serves as the entry point for the Garden Planner application.
 * Handles navigation setup, lifecycle management, and deep link handling.
 *
 * Features:
 * - Navigation component integration with custom transitions
 * - State preservation during configuration changes
 * - Deep link handling for notifications
 * - Performance monitoring with Firebase Analytics
 * - Accessibility support
 *
 * @version 1.0
 * @since 2024-01
 */
@AndroidEntryPoint
class MainActivity : AppCompatActivity(), NavController.OnDestinationChangedListener {

    private lateinit var navController: NavController
    private lateinit var appBarConfiguration: AppBarConfiguration
    private lateinit var analytics: FirebaseAnalytics

    @Inject
    lateinit var database: AppDatabase

    @Inject
    lateinit var notificationManager: NotificationManager

    private var savedState: Bundle? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // Apply splash screen
        installSplashScreen()

        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize Firebase Analytics
        analytics = FirebaseAnalytics.getInstance(this)
        logAppOpen()

        // Set up navigation
        setupNavigation(savedInstanceState)

        // Handle deep links
        handleIntent(intent)

        // Restore saved state if available
        savedState = savedInstanceState
        savedInstanceState?.let { restoreState(it) }

        // Set up accessibility
        setupAccessibility()

        // Initialize back press handling
        setupBackPressHandling()
    }

    private fun setupNavigation(savedInstanceState: Bundle?) {
        try {
            // Find the navigation host fragment
            val navHostFragment = supportFragmentManager
                .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
            navController = navHostFragment.navController

            // Configure the action bar
            appBarConfiguration = AppBarConfiguration(
                setOf(
                    R.id.gardenSetupFragment,
                    R.id.layoutViewFragment,
                    R.id.scheduleViewFragment,
                    R.id.settingsFragment
                )
            )
            setupActionBarWithNavController(navController, appBarConfiguration)

            // Set up destination change listener
            navController.addOnDestinationChangedListener(this)

            // Restore navigation state if available
            savedInstanceState?.let {
                navController.restoreState(it.getBundle(NAV_STATE_KEY))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Navigation setup failed", e)
            // Fallback to basic navigation if setup fails
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        logNavigationEvent("up_navigation")
        return navController.navigateUp(appBarConfiguration) || super.onSupportNavigateUp()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        // Save navigation state
        navController.saveState()?.let {
            outState.putBundle(NAV_STATE_KEY, it)
        }
        // Save any additional state
        outState.putBundle(SAVED_STATE_KEY, savedState)
    }

    override fun onDestinationChanged(
        controller: NavController,
        destination: NavDestination,
        arguments: Bundle?
    ) {
        // Log navigation for analytics
        logNavigationEvent(destination.label?.toString() ?: "unknown")
        
        // Update UI based on destination
        updateUIForDestination(destination.id)
    }

    override fun onDestroy() {
        // Clean up navigation listeners
        navController.removeOnDestinationChangedListener(this)
        
        // Clean up any resources
        savedState = null
        
        super.onDestroy()
    }

    private fun setupAccessibility() {
        // Set content descriptions
        findViewById<View>(R.id.nav_host_fragment)?.apply {
            contentDescription = getString(R.string.navigation_content_description)
        }

        // Configure accessibility services
        lifecycleScope.launch {
            try {
                // Set up TalkBack support
                setupTalkBackSupport()
                
                // Configure navigation announcements
                setupAccessibilityAnnouncements()
            } catch (e: Exception) {
                Log.e(TAG, "Accessibility setup failed", e)
            }
        }
    }

    private fun setupBackPressHandling() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    navController.currentDestination?.id == R.id.gardenSetupFragment -> {
                        // Show exit confirmation dialog
                        showExitConfirmationDialog()
                    }
                    navController.previousBackStackEntry != null -> {
                        // Navigate back
                        navController.navigateUp()
                    }
                    else -> {
                        // Allow activity to finish
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    private fun logAppOpen() {
        analytics.logEvent(FirebaseAnalytics.Event.APP_OPEN) {
            param(FirebaseAnalytics.Param.SCREEN_NAME, "MainActivity")
            param(FirebaseAnalytics.Param.SCREEN_CLASS, "MainActivity")
        }
    }

    private fun logNavigationEvent(destination: String) {
        analytics.logEvent(ANALYTICS_EVENT_NAVIGATION) {
            param(FirebaseAnalytics.Param.SCREEN_NAME, destination)
            param(FirebaseAnalytics.Param.SUCCESS, true)
        }
    }

    private fun restoreState(savedInstanceState: Bundle) {
        try {
            savedState = savedInstanceState.getBundle(SAVED_STATE_KEY)
            // Restore any additional state as needed
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restore state", e)
        }
    }

    private fun updateUIForDestination(destinationId: Int) {
        // Update UI elements based on current destination
        when (destinationId) {
            R.id.gardenSetupFragment -> {
                supportActionBar?.setDisplayHomeAsUpEnabled(false)
            }
            else -> {
                supportActionBar?.setDisplayHomeAsUpEnabled(true)
            }
        }
    }

    companion object {
        private const val TAG = "MainActivity"
        private const val NAV_STATE_KEY = "nav_state"
        private const val SAVED_STATE_KEY = "saved_state"
        private const val ANALYTICS_EVENT_NAVIGATION = "navigation_event"
    }
}