package com.gardenplanner.presentation.layout

import androidx.lifecycle.ViewModel // v2.6.1
import androidx.lifecycle.viewModelScope // v2.6.1
import kotlinx.coroutines.flow.StateFlow // v1.7.0
import kotlinx.coroutines.flow.MutableStateFlow // v1.7.0
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import javax.inject.Inject // v1
import com.gardenplanner.domain.models.Garden
import com.gardenplanner.domain.usecases.GenerateLayoutUseCase
import java.util.Date
import kotlin.system.measureTimeMillis

/**
 * ViewModel responsible for managing garden layout optimization state and user interactions.
 * Implements performance monitoring to ensure < 3s response time and comprehensive error handling.
 */
class LayoutViewModel @Inject constructor(
    private val generateLayoutUseCase: GenerateLayoutUseCase
) : ViewModel() {

    private val _viewState = MutableStateFlow<LayoutViewState>(LayoutViewState.Initial)
    val viewState: StateFlow<LayoutViewState> = _viewState

    companion object {
        private const val LAYOUT_GENERATION_TIMEOUT = 3000L // 3 seconds
        private const val MIN_SPACE_UTILIZATION = 70f
        private const val MAX_RETRY_ATTEMPTS = 3
    }

    /**
     * Generates optimized garden layout with performance monitoring and error handling.
     *
     * @param garden Garden configuration to optimize
     */
    fun generateLayout(garden: Garden) {
        viewModelScope.launch {
            try {
                _viewState.value = LayoutViewState.Loading

                // Validate input garden
                require(garden.validate()) {
                    "Invalid garden configuration"
                }

                var executionTime = 0L
                var optimizedGarden: Garden? = null

                // Execute with timeout and performance monitoring
                withTimeout(LAYOUT_GENERATION_TIMEOUT) {
                    executionTime = measureTimeMillis {
                        generateLayoutUseCase.execute(garden).collect { result ->
                            optimizedGarden = result
                        }
                    }
                }

                // Validate optimization results
                optimizedGarden?.let { result ->
                    if (result.spaceUtilization < MIN_SPACE_UTILIZATION) {
                        _viewState.value = LayoutViewState.Error(
                            "Insufficient space utilization: ${result.spaceUtilization}%"
                        )
                        return@launch
                    }

                    _viewState.value = LayoutViewState.Success(
                        garden = result,
                        metrics = LayoutMetrics(
                            executionTime = executionTime,
                            spaceUtilization = result.spaceUtilization,
                            timestamp = Date()
                        )
                    )
                } ?: throw IllegalStateException("Layout generation produced no result")

            } catch (e: Exception) {
                _viewState.value = LayoutViewState.Error(
                    message = "Failed to generate layout: ${e.message}"
                )
            }
        }
    }

    /**
     * Updates layout visualization settings with state preservation.
     */
    fun updateLayoutVisibility(
        showGrid: Boolean,
        showLabels: Boolean,
        showZones: Boolean
    ) {
        val currentState = _viewState.value
        if (currentState is LayoutViewState.Success) {
            _viewState.value = currentState.copy(
                visualSettings = LayoutVisualSettings(
                    showGrid = showGrid,
                    showLabels = showLabels,
                    showZones = showZones
                )
            )
        }
    }

    /**
     * Handles interactive plant selection in the layout.
     */
    fun handlePlantSelection(plantId: String) {
        val currentState = _viewState.value
        if (currentState is LayoutViewState.Success) {
            val garden = currentState.garden
            val selectedPlant = garden.plants.find { it.id == plantId }

            selectedPlant?.let { plant ->
                // Find zones containing the selected plant
                val affectedZones = garden.zones.filter { zone ->
                    zone.plants.contains(plantId)
                }

                _viewState.value = currentState.copy(
                    selectedPlantId = plantId,
                    highlightedZones = affectedZones.map { it.id }
                )
            }
        }
    }

    /**
     * Retries failed layout generation with error recovery.
     */
    fun retryLayoutGeneration() {
        val currentState = _viewState.value
        if (currentState is LayoutViewState.Error) {
            val retryCount = currentState.retryCount
            if (retryCount < MAX_RETRY_ATTEMPTS) {
                _viewState.value = LayoutViewState.Error(
                    message = currentState.message,
                    retryCount = retryCount + 1
                )
                currentState.lastValidGarden?.let { garden ->
                    generateLayout(garden)
                }
            } else {
                _viewState.value = LayoutViewState.Error(
                    message = "Maximum retry attempts exceeded",
                    retryCount = retryCount,
                    isRecoverable = false
                )
            }
        }
    }
}

/**
 * Sealed class representing the various states of layout generation.
 */
sealed class LayoutViewState {
    object Initial : LayoutViewState()
    object Loading : LayoutViewState()
    
    data class Success(
        val garden: Garden,
        val metrics: LayoutMetrics,
        val selectedPlantId: String? = null,
        val highlightedZones: List<String> = emptyList(),
        val visualSettings: LayoutVisualSettings = LayoutVisualSettings()
    ) : LayoutViewState()
    
    data class Error(
        val message: String,
        val retryCount: Int = 0,
        val isRecoverable: Boolean = true,
        val lastValidGarden: Garden? = null
    ) : LayoutViewState()
}

/**
 * Data class containing layout generation performance metrics.
 */
data class LayoutMetrics(
    val executionTime: Long,
    val spaceUtilization: Float,
    val timestamp: Date
)

/**
 * Data class containing layout visualization settings.
 */
data class LayoutVisualSettings(
    val showGrid: Boolean = true,
    val showLabels: Boolean = true,
    val showZones: Boolean = true
)