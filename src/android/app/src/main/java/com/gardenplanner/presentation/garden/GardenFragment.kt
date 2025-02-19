package com.gardenplanner.presentation.garden

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.gardenplanner.R
import com.gardenplanner.domain.models.Garden
import com.gardenplanner.domain.models.Plant
import com.gardenplanner.presentation.components.GardenGridView
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject
import kotlin.math.roundToInt

@AndroidEntryPoint
class GardenFragment : Fragment() {

    @Inject
    lateinit var viewModel: GardenViewModel

    private lateinit var gardenGridView: GardenGridView
    private lateinit var areaInput: TextInputEditText
    private lateinit var areaInputLayout: TextInputLayout
    private lateinit var sunlightSpinner: Spinner
    private lateinit var plantList: RecyclerView
    private lateinit var loadingIndicator: ProgressBar
    private lateinit var errorMessage: TextView
    private lateinit var spaceUtilization: TextView
    private lateinit var generateButton: Button
    private lateinit var retryButton: Button

    private var currentGarden: Garden? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return inflater.inflate(R.layout.fragment_garden, container, false).apply {
            // Initialize view references
            gardenGridView = findViewById(R.id.garden_grid_view)
            areaInput = findViewById(R.id.area_input)
            areaInputLayout = findViewById(R.id.area_input_layout)
            sunlightSpinner = findViewById(R.id.sunlight_spinner)
            plantList = findViewById(R.id.plant_list)
            loadingIndicator = findViewById(R.id.loading_indicator)
            errorMessage = findViewById(R.id.error_message)
            spaceUtilization = findViewById(R.id.space_utilization)
            generateButton = findViewById(R.id.generate_button)
            retryButton = findViewById(R.id.retry_button)

            // Setup accessibility
            setupAccessibility()
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupInputValidation()
        setupSunlightSpinner()
        setupPlantList()
        setupGardenGridView()
        setupButtons()
        setupStateObserver()
    }

    private fun setupInputValidation() {
        areaInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                validateAreaInput(s?.toString())
            }
        })
    }

    private fun validateAreaInput(input: String?) {
        try {
            val area = input?.toFloatOrNull()
            when {
                input.isNullOrEmpty() -> {
                    areaInputLayout.error = "Garden area is required"
                    generateButton.isEnabled = false
                }
                area == null -> {
                    areaInputLayout.error = "Invalid number format"
                    generateButton.isEnabled = false
                }
                area !in 1f..1000f -> {
                    areaInputLayout.error = "Area must be between 1 and 1000 sq ft"
                    generateButton.isEnabled = false
                }
                else -> {
                    areaInputLayout.error = null
                    generateButton.isEnabled = true
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Error validating area input")
            areaInputLayout.error = "Invalid input"
            generateButton.isEnabled = false
        }
    }

    private fun setupSunlightSpinner() {
        ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_item,
            listOf("Full Sun", "Partial Shade", "Full Shade")
        ).also { adapter ->
            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            sunlightSpinner.adapter = adapter
        }
    }

    private fun setupPlantList() {
        plantList.layoutManager = LinearLayoutManager(context)
        plantList.adapter = PlantListAdapter { plant ->
            handlePlantSelection(plant)
        }
    }

    private fun setupGardenGridView() {
        gardenGridView.apply {
            onPlantSelected = { plant ->
                showPlantDetails(plant)
            }
            onSpaceUtilizationChanged = { utilization ->
                updateSpaceUtilization(utilization)
            }
        }
    }

    private fun setupButtons() {
        generateButton.setOnClickListener {
            handleGardenCreation()
        }

        retryButton.setOnClickListener {
            handleGardenCreation()
        }
    }

    private fun setupStateObserver() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    handleUiState(state)
                }
            }
        }
    }

    private fun handleUiState(state: GardenViewModel.GardenUiState) {
        when (state) {
            is GardenViewModel.GardenUiState.Initial -> {
                showInitialState()
            }
            is GardenViewModel.GardenUiState.Loading -> {
                showLoadingState()
            }
            is GardenViewModel.GardenUiState.Success -> {
                handleSuccess(state.gardenId)
            }
            is GardenViewModel.GardenUiState.LayoutGenerated -> {
                handleLayoutGenerated(state.garden)
            }
            is GardenViewModel.GardenUiState.Error -> {
                handleError(state.message)
            }
        }
    }

    private fun handleGardenCreation() {
        try {
            val area = areaInput.text.toString().toFloatOrNull()
            if (area == null || area !in 1f..1000f) {
                showError("Invalid garden area")
                return
            }

            val sunlightHours = when (sunlightSpinner.selectedItemPosition) {
                0 -> 8 // Full Sun
                1 -> 4 // Partial Shade
                2 -> 2 // Full Shade
                else -> 6 // Default
            }

            val zone = Garden.Zone(
                id = "zone_1",
                name = "Main Zone",
                area = area,
                sunlightHours = sunlightHours,
                plants = emptyList()
            )

            val plants = (plantList.adapter as? PlantListAdapter)?.getSelectedPlants() ?: emptyList()
            
            if (plants.isEmpty()) {
                showError("Please select at least one plant")
                return
            }

            viewModel.createGarden(area, listOf(zone), plants)

        } catch (e: Exception) {
            Timber.e(e, "Error creating garden")
            showError("Failed to create garden: ${e.message}")
        }
    }

    private fun handleLayoutGenerated(garden: Garden) {
        currentGarden = garden
        gardenGridView.setGarden(garden)
        updateSpaceUtilization(garden.spaceUtilization)
        showContent()
    }

    private fun updateSpaceUtilization(utilization: Float) {
        val utilizationText = "Space Utilization: ${utilization.roundToInt()}%"
        spaceUtilization.text = utilizationText
        spaceUtilization.setTextColor(
            when {
                utilization >= 80 -> resources.getColor(R.color.green_700, null)
                utilization >= 60 -> resources.getColor(R.color.yellow_700, null)
                else -> resources.getColor(R.color.red_700, null)
            }
        )
    }

    private fun showInitialState() {
        loadingIndicator.isVisible = false
        errorMessage.isVisible = false
        gardenGridView.isVisible = true
        generateButton.isEnabled = true
        retryButton.isVisible = false
    }

    private fun showLoadingState() {
        loadingIndicator.isVisible = true
        errorMessage.isVisible = false
        generateButton.isEnabled = false
        retryButton.isVisible = false
    }

    private fun showContent() {
        loadingIndicator.isVisible = false
        errorMessage.isVisible = false
        gardenGridView.isVisible = true
        generateButton.isEnabled = true
        retryButton.isVisible = false
    }

    private fun handleError(message: String) {
        loadingIndicator.isVisible = false
        errorMessage.isVisible = true
        errorMessage.text = message
        retryButton.isVisible = true
        generateButton.isEnabled = true
        Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
    }

    private fun showError(message: String) {
        Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
    }

    private fun handlePlantSelection(plant: Plant) {
        // Update plant list selection
        (plantList.adapter as? PlantListAdapter)?.togglePlantSelection(plant)
    }

    private fun showPlantDetails(plant: Plant) {
        // Show plant details dialog
        PlantDetailsDialog.newInstance(plant).show(
            childFragmentManager,
            "plant_details"
        )
    }

    private fun setupAccessibility() {
        areaInput.contentDescription = "Garden area input in square feet"
        sunlightSpinner.contentDescription = "Sunlight condition selector"
        generateButton.contentDescription = "Generate garden layout"
        retryButton.contentDescription = "Retry garden generation"
        gardenGridView.contentDescription = "Garden layout visualization"
    }

    companion object {
        fun newInstance() = GardenFragment()
    }
}