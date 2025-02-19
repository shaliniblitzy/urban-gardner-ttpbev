package com.gardenplanner.presentation.layout

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.gardenplanner.R
import com.gardenplanner.databinding.FragmentLayoutBinding
import com.gardenplanner.presentation.components.GardenGridView
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.system.measureTimeMillis

/**
 * Fragment responsible for displaying and managing the optimized garden layout.
 * Implements comprehensive error handling and performance monitoring to ensure
 * < 3 seconds response time for layout generation.
 */
@AndroidEntryPoint
class LayoutFragment : Fragment() {

    private val viewModel: LayoutViewModel by viewModels()
    private var _binding: FragmentLayoutBinding? = null
    private val binding get() = _binding!!
    
    private lateinit var gardenGridView: GardenGridView
    private var isZoneVisible = true
    private var isLabelsVisible = true
    private var spaceUtilization = 0f

    companion object {
        private const val MAX_RENDER_TIME_MS = 3000L
        private const val MIN_SPACE_UTILIZATION = 70f
        private const val KEY_ZONE_VISIBLE = "zone_visible"
        private const val KEY_LABELS_VISIBLE = "labels_visible"
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLayoutBinding.inflate(inflater, container, false)
        
        // Initialize garden grid view with accessibility support
        gardenGridView = binding.gardenGridView.apply {
            contentDescription = getString(R.string.garden_layout_grid_description)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }

        // Restore saved state
        savedInstanceState?.let { bundle ->
            isZoneVisible = bundle.getBoolean(KEY_ZONE_VISIBLE, true)
            isLabelsVisible = bundle.getBoolean(KEY_LABELS_VISIBLE, true)
        }

        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupVisibilityControls()
        setupErrorHandling()
        observeViewState()
        initializeGardenGrid()
    }

    private fun observeViewState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.viewState.collect { state ->
                    val renderTime = measureTimeMillis {
                        handleViewState(state)
                    }

                    // Monitor performance
                    if (renderTime > MAX_RENDER_TIME_MS) {
                        // Log performance issue for analytics
                        logPerformanceIssue(renderTime)
                    }
                }
            }
        }
    }

    private fun handleViewState(state: LayoutViewState) {
        when (state) {
            is LayoutViewState.Initial -> {
                binding.progressBar.isVisible = false
                binding.errorView.isVisible = false
            }
            
            is LayoutViewState.Loading -> {
                binding.progressBar.isVisible = true
                binding.errorView.isVisible = false
                binding.gardenGridView.isVisible = false
            }
            
            is LayoutViewState.Success -> {
                binding.progressBar.isVisible = false
                binding.errorView.isVisible = false
                binding.gardenGridView.isVisible = true

                // Update garden grid with optimized layout
                gardenGridView.apply {
                    setGarden(state.garden)
                    
                    // Update space utilization display
                    spaceUtilization = state.garden.spaceUtilization
                    binding.utilizationText.text = 
                        getString(R.string.space_utilization_format, spaceUtilization)
                    
                    // Handle low space utilization warning
                    if (spaceUtilization < MIN_SPACE_UTILIZATION) {
                        showUtilizationWarning()
                    }
                }

                // Apply visual settings
                state.visualSettings.let { settings ->
                    binding.toggleZones.isChecked = settings.showZones
                    binding.toggleLabels.isChecked = settings.showLabels
                    updateLayoutVisibility(
                        showGrid = settings.showGrid,
                        showLabels = settings.showLabels,
                        showZones = settings.showZones
                    )
                }
            }
            
            is LayoutViewState.Error -> {
                binding.progressBar.isVisible = false
                binding.gardenGridView.isVisible = false
                binding.errorView.isVisible = true
                
                // Show error with retry option if recoverable
                binding.errorView.apply {
                    setText(state.message)
                    if (state.isRecoverable) {
                        binding.retryButton.isVisible = true
                        binding.retryButton.setOnClickListener {
                            viewModel.retryLayoutGeneration()
                        }
                    } else {
                        binding.retryButton.isVisible = false
                    }
                }
            }
        }
    }

    private fun setupVisibilityControls() {
        // Zone visibility toggle
        binding.toggleZones.apply {
            isChecked = isZoneVisible
            setOnCheckedChangeListener { _, isChecked ->
                isZoneVisible = isChecked
                updateLayoutVisibility(
                    showGrid = true,
                    showLabels = isLabelsVisible,
                    showZones = isZoneVisible
                )
            }
        }

        // Labels visibility toggle
        binding.toggleLabels.apply {
            isChecked = isLabelsVisible
            setOnCheckedChangeListener { _, isChecked ->
                isLabelsVisible = isChecked
                updateLayoutVisibility(
                    showGrid = true,
                    showLabels = isLabelsVisible,
                    showZones = isZoneVisible
                )
            }
        }
    }

    private fun initializeGardenGrid() {
        gardenGridView.apply {
            // Handle plant selection
            onPlantSelected = { plant ->
                viewModel.handlePlantSelection(plant.id)
            }

            // Monitor space utilization changes
            onSpaceUtilizationChanged = { utilization ->
                spaceUtilization = utilization
                binding.utilizationText.text = 
                    getString(R.string.space_utilization_format, utilization)
            }
        }
    }

    private fun setupErrorHandling() {
        binding.retryButton.setOnClickListener {
            viewModel.retryLayoutGeneration()
        }
    }

    private fun updateLayoutVisibility(
        showGrid: Boolean,
        showLabels: Boolean,
        showZones: Boolean
    ) {
        viewModel.updateLayoutVisibility(showGrid, showLabels, showZones)
    }

    private fun showUtilizationWarning() {
        Toast.makeText(
            requireContext(),
            getString(R.string.low_utilization_warning),
            Toast.LENGTH_LONG
        ).show()
    }

    private fun logPerformanceIssue(renderTime: Long) {
        // Implementation for performance logging
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_ZONE_VISIBLE, isZoneVisible)
        outState.putBoolean(KEY_LABELS_VISIBLE, isLabelsVisible)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}