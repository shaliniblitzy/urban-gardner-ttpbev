package com.gardenplanner.presentation.components

import android.content.Context
import android.content.res.TypedArray
import android.os.Parcelable
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.CheckBox
import android.widget.TextView
import androidx.cardview.widget.CardView // version: 1.0.0
import androidx.constraintlayout.widget.ConstraintLayout // version: 2.1.4
import androidx.core.content.ContextCompat
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import com.gardenplanner.R
import com.gardenplanner.domain.models.Schedule
import com.gardenplanner.core.utils.toDisplayFormat
import kotlinx.parcelize.Parcelize
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * A custom view component that displays a single maintenance schedule item
 * with material design styling, accessibility support, and state preservation.
 */
class ScheduleItem @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ConstraintLayout(context, attrs, defStyleAttr) {

    private var schedule: Schedule? = null
    private val taskTypeTextView: TextView
    private val dueDateTextView: TextView
    private val completedCheckBox: CheckBox
    private val containerView: CardView
    private var onItemClick: ((Schedule) -> Unit)? = null
    private var onCompletedChanged: ((Schedule, Boolean) -> Unit)? = null
    private val dateFormatter = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())

    init {
        LayoutInflater.from(context).inflate(R.layout.view_schedule_item, this, true)

        // Initialize view references
        taskTypeTextView = findViewById(R.id.taskTypeTextView)
        dueDateTextView = findViewById(R.id.dueDateTextView)
        completedCheckBox = findViewById(R.id.completedCheckBox)
        containerView = findViewById(R.id.containerView)

        // Set up click listeners with ripple effect
        containerView.apply {
            isClickable = true
            isFocusable = true
            foreground = ContextCompat.getDrawable(context, R.drawable.ripple_effect)
        }

        // Set up accessibility
        setupAccessibility()

        // Apply custom attributes if provided
        attrs?.let { applyCustomAttributes(it, defStyleAttr) }

        // Configure RTL support
        layoutDirection = View.LAYOUT_DIRECTION_LOCALE
    }

    /**
     * Binds schedule data to the view components with error handling
     * and state preservation.
     */
    fun bind(schedule: Schedule) {
        this.schedule = schedule

        // Set task type with accessibility
        taskTypeTextView.text = formatTaskType(schedule.taskType)
        taskTypeTextView.contentDescription = 
            context.getString(R.string.task_type_description, schedule.taskType)

        // Set due date with formatting
        dueDateTextView.text = schedule.dueDate.toDisplayFormat()
        dueDateTextView.contentDescription = 
            context.getString(R.string.due_date_description, schedule.dueDate.toDisplayFormat())

        // Update completion status
        updateCompletionStatus(schedule.completed)

        // Apply overdue styling if applicable
        if (schedule.isOverdue()) {
            applyOverdueStyling()
        } else {
            clearOverdueStyling()
        }

        // Set up click handlers
        setupClickListeners(schedule)

        // Update container accessibility
        containerView.contentDescription = buildContainerDescription(schedule)
    }

    /**
     * Updates the visual state for task completion with animation
     * and accessibility announcement.
     */
    fun updateCompletionStatus(completed: Boolean) {
        completedCheckBox.isChecked = completed
        
        // Animate checkbox state change
        completedCheckBox.animate()
            .alpha(if (completed) 1f else 0.6f)
            .setDuration(200)
            .start()

        // Apply completed styling
        containerView.alpha = if (completed) 0.8f else 1f
        
        // Update accessibility state
        ViewCompat.setStateDescription(
            containerView,
            context.getString(
                if (completed) R.string.task_completed
                else R.string.task_pending
            )
        )

        // Announce state change
        announceForAccessibility(
            context.getString(
                if (completed) R.string.task_marked_complete
                else R.string.task_marked_incomplete
            )
        )
    }

    /**
     * Preserves component state during configuration changes.
     */
    override fun onSaveInstanceState(): Parcelable {
        return SavedState(super.onSaveInstanceState()).apply {
            schedule = this@ScheduleItem.schedule
            isCompleted = completedCheckBox.isChecked
        }
    }

    /**
     * Restores component state after configuration changes.
     */
    override fun onRestoreInstanceState(state: Parcelable?) {
        when (state) {
            is SavedState -> {
                super.onRestoreInstanceState(state.superState)
                state.schedule?.let { bind(it) }
                updateCompletionStatus(state.isCompleted)
            }
            else -> super.onRestoreInstanceState(state)
        }
    }

    private fun setupAccessibility() {
        ViewCompat.setAccessibilityDelegate(containerView, object : AccessibilityDelegateCompat() {
            override fun onInitializeAccessibilityNodeInfo(
                host: View,
                info: AccessibilityNodeInfoCompat
            ) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.addAction(
                    AccessibilityNodeInfoCompat.AccessibilityActionCompat(
                        AccessibilityNodeInfo.ACTION_CLICK,
                        context.getString(R.string.view_task_details)
                    )
                )
            }
        })

        completedCheckBox.setAccessibilityDelegate(object : View.AccessibilityDelegate() {
            override fun onInitializeAccessibilityEvent(host: View, event: AccessibilityEvent) {
                super.onInitializeAccessibilityEvent(host, event)
                if (event.eventType == AccessibilityEvent.TYPE_VIEW_CLICKED) {
                    val description = if (completedCheckBox.isChecked) {
                        R.string.task_marked_complete
                    } else {
                        R.string.task_marked_incomplete
                    }
                    event.text.add(context.getString(description))
                }
            }
        })
    }

    private fun setupClickListeners(schedule: Schedule) {
        containerView.setOnClickListener {
            onItemClick?.invoke(schedule)
        }

        completedCheckBox.setOnCheckedChangeListener { _, isChecked ->
            onCompletedChanged?.invoke(schedule, isChecked)
            updateCompletionStatus(isChecked)
        }
    }

    private fun applyOverdueStyling() {
        containerView.setCardBackgroundColor(
            ContextCompat.getColor(context, R.color.overdue_background)
        )
        dueDateTextView.setTextColor(
            ContextCompat.getColor(context, R.color.overdue_text)
        )
    }

    private fun clearOverdueStyling() {
        containerView.setCardBackgroundColor(
            ContextCompat.getColor(context, R.color.card_background)
        )
        dueDateTextView.setTextColor(
            ContextCompat.getColor(context, R.color.text_primary)
        )
    }

    private fun formatTaskType(taskType: String): String {
        return taskType.replace("_", " ")
            .split(" ")
            .joinToString(" ") { it.capitalize(Locale.getDefault()) }
    }

    private fun buildContainerDescription(schedule: Schedule): String {
        return context.getString(
            R.string.schedule_item_description,
            formatTaskType(schedule.taskType),
            schedule.dueDate.toDisplayFormat(),
            if (schedule.completed) {
                context.getString(R.string.status_completed)
            } else {
                context.getString(R.string.status_pending)
            }
        )
    }

    private fun applyCustomAttributes(attrs: AttributeSet, defStyleAttr: Int) {
        context.theme.obtainStyledAttributes(
            attrs,
            R.styleable.ScheduleItem,
            defStyleAttr,
            0
        ).apply {
            try {
                // Apply custom styling attributes
                val cardElevation = getDimension(R.styleable.ScheduleItem_cardElevation, 4f)
                containerView.cardElevation = cardElevation
            } finally {
                recycle()
            }
        }
    }

    @Parcelize
    private class SavedState(
        val superState: Parcelable?,
        var schedule: Schedule? = null,
        var isCompleted: Boolean = false
    ) : Parcelable
}