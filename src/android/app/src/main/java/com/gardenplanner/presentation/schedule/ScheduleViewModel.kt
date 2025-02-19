package com.gardenplanner.presentation.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import com.gardenplanner.domain.models.Schedule
import com.gardenplanner.domain.usecases.ManageScheduleUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import timber.log.Timber
import java.util.Date
import javax.inject.Inject

/**
 * ViewModel for managing garden maintenance schedule UI state and user interactions.
 * Implements comprehensive error handling and performance monitoring.
 *
 * @property manageScheduleUseCase Use case for schedule management operations
 * @property savedStateHandle Handle for preserving state during configuration changes
 */
@HiltViewModel
class ScheduleViewModel @Inject constructor(
    private val manageScheduleUseCase: ManageScheduleUseCase,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow<ScheduleUiState>(ScheduleUiState.Loading)
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    private val operationTimeout = 2000L // 2 seconds timeout as per requirements
    private var lastFailedOperation: (suspend () -> Unit)? = null
    private var retryCount = 0
    private val maxRetries = 3

    init {
        loadSchedules()
    }

    /**
     * Loads all maintenance schedules including overdue ones.
     * Implements timeout and error handling as per requirements.
     */
    fun loadSchedules() {
        viewModelScope.launch {
            try {
                _uiState.value = ScheduleUiState.Loading
                withTimeout(operationTimeout) {
                    manageScheduleUseCase.getOverdueSchedules()
                        .catch { e ->
                            handleError("Failed to load schedules", e)
                        }
                        .collect { result ->
                            result.fold(
                                onSuccess = { schedules ->
                                    _uiState.value = ScheduleUiState.Success(schedules)
                                },
                                onFailure = { e ->
                                    handleError("Failed to process schedules", e)
                                }
                            )
                        }
                }
            } catch (e: Exception) {
                handleError("Schedule loading error", e)
            }
        }
    }

    /**
     * Creates a new maintenance schedule with validation.
     *
     * @param schedule Schedule to create
     */
    fun createSchedule(schedule: Schedule) {
        viewModelScope.launch {
            try {
                _uiState.value = ScheduleUiState.Loading
                withTimeout(operationTimeout) {
                    val result = manageScheduleUseCase.createSchedule(schedule)
                    result.fold(
                        onSuccess = { 
                            loadSchedules() // Reload schedules after successful creation
                        },
                        onFailure = { e ->
                            handleError("Failed to create schedule", e)
                            lastFailedOperation = { createSchedule(schedule) }
                        }
                    )
                }
            } catch (e: Exception) {
                handleError("Schedule creation error", e)
                lastFailedOperation = { createSchedule(schedule) }
            }
        }
    }

    /**
     * Updates an existing schedule with error handling.
     *
     * @param schedule Schedule to update
     */
    fun updateSchedule(schedule: Schedule) {
        viewModelScope.launch {
            try {
                _uiState.value = ScheduleUiState.Loading
                withTimeout(operationTimeout) {
                    val result = manageScheduleUseCase.updateSchedule(schedule)
                    result.fold(
                        onSuccess = { 
                            loadSchedules()
                        },
                        onFailure = { e ->
                            handleError("Failed to update schedule", e)
                            lastFailedOperation = { updateSchedule(schedule) }
                        }
                    )
                }
            } catch (e: Exception) {
                handleError("Schedule update error", e)
                lastFailedOperation = { updateSchedule(schedule) }
            }
        }
    }

    /**
     * Marks a schedule as completed.
     *
     * @param schedule Schedule to mark as completed
     */
    fun completeSchedule(schedule: Schedule) {
        viewModelScope.launch {
            try {
                _uiState.value = ScheduleUiState.Loading
                withTimeout(operationTimeout) {
                    val result = manageScheduleUseCase.completeSchedule(schedule)
                    result.fold(
                        onSuccess = { 
                            loadSchedules()
                        },
                        onFailure = { e ->
                            handleError("Failed to complete schedule", e)
                            lastFailedOperation = { completeSchedule(schedule) }
                        }
                    )
                }
            } catch (e: Exception) {
                handleError("Schedule completion error", e)
                lastFailedOperation = { completeSchedule(schedule) }
            }
        }
    }

    /**
     * Deletes a schedule with cleanup.
     *
     * @param schedule Schedule to delete
     */
    fun deleteSchedule(schedule: Schedule) {
        viewModelScope.launch {
            try {
                _uiState.value = ScheduleUiState.Loading
                withTimeout(operationTimeout) {
                    val result = manageScheduleUseCase.deleteSchedule(schedule)
                    result.fold(
                        onSuccess = { 
                            loadSchedules()
                        },
                        onFailure = { e ->
                            handleError("Failed to delete schedule", e)
                            lastFailedOperation = { deleteSchedule(schedule) }
                        }
                    )
                }
            } catch (e: Exception) {
                handleError("Schedule deletion error", e)
                lastFailedOperation = { deleteSchedule(schedule) }
            }
        }
    }

    /**
     * Retries the last failed operation with exponential backoff.
     */
    fun retryFailedOperation() {
        lastFailedOperation?.let { operation ->
            if (retryCount < maxRetries) {
                viewModelScope.launch {
                    try {
                        val backoffDelay = (1L shl retryCount) * 1000L // Exponential backoff
                        kotlinx.coroutines.delay(backoffDelay)
                        retryCount++
                        operation.invoke()
                    } catch (e: Exception) {
                        handleError("Retry failed", e)
                    }
                }
            } else {
                _uiState.value = ScheduleUiState.Error(
                    "Maximum retry attempts exceeded. Please try again later."
                )
                resetRetryState()
            }
        }
    }

    private fun handleError(message: String, error: Throwable) {
        Timber.e(error, message)
        _uiState.value = ScheduleUiState.Error("$message: ${error.message}")
    }

    private fun resetRetryState() {
        retryCount = 0
        lastFailedOperation = null
    }
}

/**
 * Sealed class representing different states of the schedule UI.
 */
sealed class ScheduleUiState {
    object Loading : ScheduleUiState()
    data class Success(val schedules: List<Schedule>) : ScheduleUiState()
    data class Error(val message: String) : ScheduleUiState()
}