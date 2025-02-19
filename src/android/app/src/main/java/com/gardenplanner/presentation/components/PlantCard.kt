package com.gardenplanner.presentation.components

import android.content.Context
import android.os.Bundle
import android.util.AttributeSet
import android.view.LayoutInflater
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import androidx.savedstate.SavedStateRegistry
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.request.RequestOptions
import com.google.android.material.card.MaterialCardView
import com.gardenplanner.R
import com.gardenplanner.databinding.ItemPlantBinding
import com.gardenplanner.domain.models.Plant
import java.lang.IllegalStateException

/**
 * A production-ready Material Design 3 card component for displaying plant information.
 * Features comprehensive accessibility support, state preservation, and performance optimizations.
 *
 * @property binding View binding for the plant card layout
 * @property plant Current plant data being displayed
 * @property onPlantClick Callback for plant selection events
 * @property savedStateRegistry Registry for preserving state across configuration changes
 */
class PlantCard @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = com.google.android.material.R.attr.materialCardViewStyle
) : MaterialCardView(context, attrs, defStyleAttr) {

    private var binding: ItemPlantBinding
    private var plant: Plant? = null
    private var onPlantClick: ((Plant) -> Unit)? = null
    private var savedStateRegistry: SavedStateRegistry? = null

    companion object {
        private const val KEY_PLANT_STATE = "plant_state"
        private const val FADE_ANIMATION_DURATION = 150L
        private const val IMAGE_CACHE_SIZE_BYTES = 1024 * 1024 * 10 // 10MB
    }

    init {
        // Initialize view binding
        binding = ItemPlantBinding.inflate(LayoutInflater.from(context), this, true)

        // Configure card styling and behavior
        elevation = resources.getDimension(R.dimen.card_elevation)
        radius = resources.getDimension(R.dimen.card_corner_radius)
        
        // Set up accessibility defaults
        ViewCompat.setAccessibilityHeading(binding.plantNameTextView, true)
        
        // Ensure minimum touch target sizes
        minimumHeight = resources.getDimensionPixelSize(R.dimen.min_touch_target_size)
        minimumWidth = resources.getDimensionPixelSize(R.dimen.min_touch_target_size)

        // Configure RTL support
        ViewCompat.setLayoutDirection(this, ViewCompat.LAYOUT_DIRECTION_INHERIT)
    }

    /**
     * Updates the card with plant information using null safety and error handling.
     *
     * @param newPlant The plant data to display
     * @throws IllegalStateException if the plant data is invalid
     */
    fun setPlant(newPlant: Plant) {
        try {
            require(newPlant.validate()) { "Invalid plant data provided" }
            
            plant = newPlant
            
            with(binding) {
                // Update text content with null safety
                plantNameTextView.text = newPlant.name
                quantityTextView.text = context.getString(
                    R.string.plant_quantity_format,
                    newPlant.quantity
                )
                spacingTextView.text = context.getString(
                    R.string.plant_spacing_format,
                    newPlant.spacing
                )

                // Load and cache image with error handling
                Glide.with(context)
                    .load(newPlant.imageUrl)
                    .apply(RequestOptions()
                        .diskCacheStrategy(DiskCacheStrategy.ALL)
                        .error(R.drawable.ic_plant_placeholder)
                        .fallback(R.drawable.ic_plant_placeholder)
                        .centerCrop()
                        .override(
                            resources.getDimensionPixelSize(R.dimen.icon_size_large),
                            resources.getDimensionPixelSize(R.dimen.icon_size_large)
                        )
                    )
                    .transition(com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions.withCrossFade(FADE_ANIMATION_DURATION))
                    .into(plantImageView)

                // Configure accessibility
                ViewCompat.setAccessibilityDelegate(root, object : ViewCompat.AccessibilityDelegate() {
                    override fun onInitializeAccessibilityNodeInfo(
                        host: android.view.View,
                        info: AccessibilityNodeInfoCompat
                    ) {
                        super.onInitializeAccessibilityNodeInfo(host, info)
                        info.contentDescription = context.getString(
                            R.string.plant_card_description,
                            newPlant.name,
                            newPlant.quantity,
                            newPlant.spacing
                        )
                        info.addAction(AccessibilityNodeInfoCompat.AccessibilityActionCompat.ACTION_CLICK)
                    }
                })
            }

            // Save state
            savedStateRegistry?.let { registry ->
                registry.registerSavedStateProvider(KEY_PLANT_STATE) {
                    Bundle().apply {
                        putParcelable(KEY_PLANT_STATE, plant)
                    }
                }
            }

        } catch (e: Exception) {
            // Log error and show fallback UI
            android.util.Log.e("PlantCard", "Error setting plant data", e)
            showErrorState()
        }
    }

    /**
     * Sets click listener with accessibility and error handling.
     *
     * @param listener Callback to invoke when the card is clicked
     */
    fun setOnPlantClickListener(listener: (Plant) -> Unit) {
        onPlantClick = listener
        
        binding.root.setOnClickListener { view ->
            plant?.let { currentPlant ->
                try {
                    // Provide haptic feedback for touch
                    view.performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY)
                    listener(currentPlant)
                } catch (e: Exception) {
                    android.util.Log.e("PlantCard", "Error handling click", e)
                }
            }
        }
    }

    /**
     * Preserves state during configuration changes.
     *
     * @param outState Bundle to save state into
     */
    override fun onSaveInstanceState(): Bundle {
        return Bundle().apply {
            putParcelable(KEY_PLANT_STATE, plant)
        }
    }

    /**
     * Restores state after configuration changes.
     *
     * @param state Bundle containing saved state
     */
    override fun onRestoreInstanceState(state: Bundle) {
        super.onRestoreInstanceState(state)
        state.getParcelable<Plant>(KEY_PLANT_STATE)?.let { savedPlant ->
            setPlant(savedPlant)
        }
    }

    /**
     * Cleans up resources when view is detached.
     */
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        // Clear image loading
        Glide.with(context).clear(binding.plantImageView)
        // Clear click listeners
        binding.root.setOnClickListener(null)
        // Clear saved state
        savedStateRegistry?.unregisterSavedStateProvider(KEY_PLANT_STATE)
        // Clear references
        onPlantClick = null
        savedStateRegistry = null
    }

    /**
     * Shows error state when plant data cannot be displayed.
     */
    private fun showErrorState() {
        with(binding) {
            plantNameTextView.setText(R.string.error_loading_plant)
            plantImageView.setImageResource(R.drawable.ic_error_placeholder)
            quantityTextView.text = ""
            spacingTextView.text = ""
        }
    }
}