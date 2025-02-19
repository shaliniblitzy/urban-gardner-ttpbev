package com.gardenplanner.presentation.components

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import androidx.core.content.ContextCompat
import androidx.core.view.GestureDetectorCompat
import com.gardenplanner.domain.models.Garden
import com.gardenplanner.domain.models.Plant
import kotlin.math.max
import kotlin.math.min

/**
 * Custom View component that renders an interactive grid representation of the garden layout.
 * Supports zone-based visualization, plant placement, and space utilization indicators.
 */
class GardenGridView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private var garden: Garden? = null
    private var gridScale = 1f
    private var translateX = 0f
    private var translateY = 0f
    private var cellSize = 50f
    private var gridRows = 0
    private var gridColumns = 0

    // Paint objects for different drawing elements
    private val gridPaint = Paint().apply {
        color = Color.GRAY
        strokeWidth = 1f
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    private val plantPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val zonePaint = Paint().apply {
        style = Paint.Style.FILL
        alpha = 70
        isAntiAlias = true
    }

    private val textPaint = Paint().apply {
        color = Color.BLACK
        textSize = 24f
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
    }

    private val utilizationPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    // Zone color mapping
    private val zoneColorMap = mutableMapOf<String, Int>()

    // Gesture detectors
    private val scaleDetector = ScaleGestureDetector(context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                gridScale *= detector.scaleFactor
                gridScale = gridScale.coerceIn(0.5f, 3f)
                invalidate()
                return true
            }
        })

    private val gestureDetector = GestureDetectorCompat(context,
        object : GestureDetector.SimpleOnGestureListener() {
            override fun onScroll(
                e1: MotionEvent?,
                e2: MotionEvent,
                distanceX: Float,
                distanceY: Float
            ): Boolean {
                translateX -= distanceX
                translateY -= distanceY
                // Limit translation to keep grid visible
                val maxTranslateX = width * (gridScale - 1)
                val maxTranslateY = height * (gridScale - 1)
                translateX = translateX.coerceIn(-maxTranslateX, maxTranslateX)
                translateY = translateY.coerceIn(-maxTranslateY, maxTranslateY)
                invalidate()
                return true
            }

            override fun onSingleTapUp(e: MotionEvent): Boolean {
                handleTap(e.x, e.y)
                return true
            }
        })

    // Callbacks
    var onPlantSelected: ((Plant) -> Unit)? = null
    var onSpaceUtilizationChanged: ((Float) -> Unit)? = null

    /**
     * Updates the garden data and triggers layout recalculation
     */
    fun setGarden(garden: Garden) {
        this.garden = garden
        calculateGridDimensions()
        setupZoneColors()
        invalidate()
        onSpaceUtilizationChanged?.invoke(garden.spaceUtilization)
    }

    private fun calculateGridDimensions() {
        garden?.let { garden ->
            val sqrtArea = kotlin.math.sqrt(garden.area)
            gridColumns = kotlin.math.ceil(sqrtArea).toInt()
            gridRows = kotlin.math.ceil(garden.area / gridColumns).toInt()
            cellSize = min(
                width.toFloat() / gridColumns,
                height.toFloat() / gridRows
            )
        }
    }

    private fun setupZoneColors() {
        garden?.zones?.forEachIndexed { index, zone ->
            zoneColorMap[zone.id] = when (index % 4) {
                0 -> Color.rgb(200, 230, 200) // Light green
                1 -> Color.rgb(230, 200, 200) // Light red
                2 -> Color.rgb(200, 200, 230) // Light blue
                else -> Color.rgb(230, 230, 200) // Light yellow
            }
        }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        calculateGridDimensions()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        
        garden?.let { garden ->
            // Apply transformations
            canvas.save()
            canvas.translate(translateX, translateY)
            canvas.scale(gridScale, gridScale)

            // Draw zones
            garden.zones.forEach { zone ->
                zonePaint.color = zoneColorMap[zone.id] ?: Color.LTGRAY
                val zoneArea = zone.area
                val zoneWidth = kotlin.math.sqrt(zoneArea) * cellSize
                val zoneHeight = zoneArea / zoneWidth * cellSize
                canvas.drawRect(0f, 0f, zoneWidth, zoneHeight, zonePaint)
            }

            // Draw grid
            for (i in 0..gridColumns) {
                val x = i * cellSize
                canvas.drawLine(x, 0f, x, height.toFloat(), gridPaint)
            }
            for (i in 0..gridRows) {
                val y = i * cellSize
                canvas.drawLine(0f, y, width.toFloat(), y, gridPaint)
            }

            // Draw plants
            garden.plants.forEach { plant ->
                val plantX = (plant.spacing * cellSize)
                val plantY = (plant.spacing * cellSize)
                plantPaint.color = zoneColorMap[plant.zoneId] ?: Color.DKGRAY
                
                // Draw plant circle
                canvas.drawCircle(
                    plantX,
                    plantY,
                    plant.spacing * cellSize / 2,
                    plantPaint
                )
                
                // Draw plant label
                textPaint.textSize = cellSize * 0.3f
                canvas.drawText(
                    plant.name,
                    plantX,
                    plantY + textPaint.textSize / 3,
                    textPaint
                )
            }

            // Draw utilization indicator
            val utilizationGradient = LinearGradient(
                0f, 0f, width.toFloat(), 0f,
                intArrayOf(Color.RED, Color.YELLOW, Color.GREEN),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )
            utilizationPaint.shader = utilizationGradient
            val utilizationHeight = height * 0.05f
            canvas.drawRect(
                0f,
                height - utilizationHeight,
                width * (garden.spaceUtilization / 100f),
                height.toFloat(),
                utilizationPaint
            )

            canvas.restore()
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)
        return true
    }

    private fun handleTap(x: Float, y: Float) {
        garden?.let { garden ->
            // Convert tap coordinates to grid coordinates
            val gridX = (x - translateX) / (cellSize * gridScale)
            val gridY = (y - translateY) / (cellSize * gridScale)

            // Find tapped plant
            garden.plants.firstOrNull { plant ->
                val plantX = plant.spacing * cellSize
                val plantY = plant.spacing * cellSize
                val radius = plant.spacing * cellSize / 2
                
                val dx = gridX - plantX
                val dy = gridY - plantY
                (dx * dx + dy * dy) <= radius * radius
            }?.let { plant ->
                onPlantSelected?.invoke(plant)
            }
        }
    }

    companion object {
        private const val MIN_SCALE = 0.5f
        private const val MAX_SCALE = 3.0f
        private const val DEFAULT_CELL_SIZE = 50f
    }
}