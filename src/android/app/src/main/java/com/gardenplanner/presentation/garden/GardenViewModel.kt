package com.gardenplanner.presentation.garden

import androidx.lifecycle.ViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.gardenplanner.domain.models.Garden
import com.gardenplanner.domain.usecases.CreateGardenUseCase
import com.gardenplanner.domain.usecases.GenerateLayoutUseCase
import timber.log.Timber // v5.0.1
import io.github.performance-monitor.PerformanceMonitor // v1.0.0
import java.util.concurrent.ConcurrentHashMap
import kotlin.system.measureTimeMillis

/**
 * ViewModel that manages garden-related UI state and business logic with enhanced
 * state management, performance monitoring, and error handling.
 */
@HiltViewModel
class GardenViewModel @Inject constructor(
    private val createGardenUseCase: CreateGardenUseCase,
    private val generateLayoutUseCase: GenerateLayoutUseCase,
    private val savedStateHandle: SavedStateHandle,
    private val performanceMonitor: PerformanceMonitor
) : ViewModel() {

    companion object {
        private const val KEY_UI_STATE = "garden_ui_state"
        private const val OPERATION_TIMEOUT = 3000L // 3 seconds
        private const val PERFORMANCE_TAG = "GardenViewModel"
    }

    // UI State management
    private val _uiState = MutableStateFlow<GardenUiState>(
        savedStateHandle.get<GardenUiState>(KEY_UI_STATE) ?: GardenUiState.Initial
    )
    val uiState: StateFlow<GardenUiState> = _uiState.asStateFlow()

    // Layout cache for performance optimization
    private val layoutCache = ConcurrentHashMap<String, CachedLayout>()

    /**
     * Creates a new garden with comprehensive validation and performance monitoring.
     */
    fun createGarden(area: Float, zones: List<Garden.Zone>, plants: List<Plant>) {
        viewModelScope.launch {
            try {
                performanceMonitor.startOperation(PERFORMANCE_TAG)
                _uiState.value = GardenUiState.Loading

                val operationTime = measureTimeMillis {
                    // Validate input parameters
                    validateInput(area, zones, plants)

                    // Create garden instance
                    val garden = Garden(
                        id = java.util.UUID.randomUUID().toString(),
                        area = area,
                        zones = zones,
                        plants = plants,
                        schedules = emptyList(),
                        createdAt = java.util.Date()
                    )

                    // Execute creation use case
                    createGardenUseCase.execute(garden).fold(
                        onSuccess = { gardenId ->
                            _uiState.value = GardenUiState.Success(gardenId)
                            savedStateHandle[KEY_UI_STATE] = _uiState.value
                        },
                        onFailure = { error ->
                            throw error
                        }
                    )
                }

                // Log performance metrics
                if (operationTime > OPERATION_TIMEOUT) {
                    Timber.w("Garden creation exceeded time limit: $operationTime ms")
                }
                performanceMonitor.recordSuccess()

            } catch (e: Exception) {
                Timber.e(e, "Failed to create garden")
                _uiState.value = GardenUiState.Error(e.message ?: "Unknown error")
                performanceMonitor.recordError(e)
            } finally {
                performanceMonitor.endOperation(PERFORMANCE_TAG)
            }
        }
    }

    /**
     * Generates optimized garden layout with caching and performance monitoring.
     */
    fun generateLayout(garden: Garden) {
        viewModelScope.launch {
            try {
                performanceMonitor.startOperation("${PERFORMANCE_TAG}_Layout")
                _uiState.value = GardenUiState.Loading

                // Check cache first
                getCachedLayout(garden.id)?.let { cached ->
                    _uiState.value = GardenUiState.LayoutGenerated(cached.garden)
                    return@launch
                }

                val operationTime = measureTimeMillis {
                    generateLayoutUseCase.execute(garden).collect { optimizedGarden ->
                        // Cache successful result
                        cacheLayout(optimizedGarden)
                        _uiState.value = GardenUiState.LayoutGenerated(optimizedGarden)
                        savedStateHandle[KEY_UI_STATE] = _uiState.value
                    }
                }

                // Log performance metrics
                if (operationTime > OPERATION_TIMEOUT) {
                    Timber.w("Layout generation exceeded time limit: $operationTime ms")
                }
                performanceMonitor.recordSuccess()

            } catch (e: Exception) {
                Timber.e(e, "Failed to generate layout")
                _uiState.value = GardenUiState.Error(e.message ?: "Unknown error")
                performanceMonitor.recordError(e)
            } finally {
                performanceMonitor.endOperation("${PERFORMANCE_TAG}_Layout")
            }
        }
    }

    /**
     * Validates garden input parameters with comprehensive checks.
     */
    private fun validateInput(area: Float, zones: List<Garden.Zone>, plants: List<Plant>) {
        require(area in 1f..1000f) {
            "Garden area must be between 1 and 1000 square feet"
        }
        require(zones.isNotEmpty()) {
            "Garden must have at least one zone"
        }
        require(plants.isNotEmpty()) {
            "Garden must have at least one plant"
        }

        // Validate zones
        zones.forEach { zone ->
            require(zone.validate()) {
                "Invalid zone configuration: ${zone.id}"
            }
        }

        // Validate total zone area
        val totalZoneArea = zones.sumOf { it.area.toDouble() }
        require(totalZoneArea <= area) {
            "Total zone area cannot exceed garden area"
        }

        // Validate plants
        plants.forEach { plant ->
            require(plant.validate()) {
                "Invalid plant configuration: ${plant.name}"
            }
        }

        // Check plant compatibility
        plants.forEach { plant ->
            val incompatiblePairs = plants.filter { other ->
                plant.id != other.id && !plant.isCompatibleWith(other)
            }
            require(incompatiblePairs.isEmpty()) {
                "Incompatible plants detected: ${plant.name}"
            }
        }
    }

    /**
     * Retrieves cached layout if valid.
     */
    private fun getCachedLayout(gardenId: String): CachedLayout? {
        return layoutCache[gardenId]?.takeIf { it.isValid() }
    }

    /**
     * Caches optimized garden layout.
     */
    private fun cacheLayout(garden: Garden) {
        layoutCache[garden.id] = CachedLayout(
            garden = garden,
            timestamp = System.currentTimeMillis()
        )
    }

    /**
     * Cleans up resources when ViewModel is destroyed.
     */
    override fun onCleared() {
        super.onCleared()
        layoutCache.clear()
        savedStateHandle[KEY_UI_STATE] = _uiState.value
    }

    /**
     * Sealed class representing UI state with all possible states.
     */
    sealed class GardenUiState {
        object Initial : GardenUiState()
        object Loading : GardenUiState()
        data class Success(val gardenId: String) : GardenUiState()
        data class LayoutGenerated(val garden: Garden) : GardenUiState()
        data class Error(val message: String) : GardenUiState()
    }

    /**
     * Data class for cached layout with validity checking.
     */
    private data class CachedLayout(
        val garden: Garden,
        val timestamp: Long
    ) {
        fun isValid(): Boolean {
            val age = System.currentTimeMillis() - timestamp
            return age <= 24 * 3600 * 1000 // 24 hours validity
        }
    }
}