package com.gardenplanner.presentation.schedule

import android.os.Bundle
import android.view.View
import android.view.accessibility.AccessibilityEvent
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DividerItemDecoration
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.gardenplanner.R
import com.gardenplanner.databinding.FragmentScheduleBinding
import com.gardenplanner.domain.models.Schedule
import com.gardenplanner.presentation.components.ScheduleItem
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.Date

/**
 * Fragment for displaying and managing garden maintenance schedules.
 * Implements comprehensive state management, accessibility support,
 * and optimized performance for schedule operations.
 */
@AndroidEntryPoint
class ScheduleFragment : Fragment(R.layout.fragment_schedule) {

    private val viewModel: ScheduleViewModel by viewModels()
    private var _binding: FragmentScheduleBinding? = null
    private val binding get() = _binding!!

    private lateinit var scheduleAdapter: ScheduleAdapter
    private var pendingScheduleUpdate: Schedule? = null
    private var snackbar: Snackbar? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        _binding = FragmentScheduleBinding.bind(view)

        setupRecyclerView()
        setupSwipeRefresh()
        setupAccessibility()
        observeUiState()
        setupErrorHandling()
    }

    private fun setupRecyclerView() {
        scheduleAdapter = ScheduleAdapter(
            onItemClick = { schedule -> handleScheduleClick(schedule) },
            onCompletedChanged = { schedule, completed -> 
                handleScheduleCompletion(schedule, completed)
            }
        )

        binding.recyclerView.apply {
            adapter = scheduleAdapter
            layoutManager = LinearLayoutManager(requireContext())
            addItemDecoration(
                DividerItemDecoration(requireContext(), DividerItemDecoration.VERTICAL)
            )
            setHasFixedSize(true)

            // Optimize recycler view performance
            recycledViewPool.setMaxRecycledViews(
                R.layout.view_schedule_item,
                20
            )
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.apply {
            setColorSchemeResources(
                R.color.refresh_progress_1,
                R.color.refresh_progress_2,
                R.color.refresh_progress_3
            )
            setOnRefreshListener {
                viewModel.loadSchedules()
            }
        }
    }

    private fun setupAccessibility() {
        binding.recyclerView.accessibilityDelegate = object : View.AccessibilityDelegate() {
            override fun onInitializeAccessibilityEvent(host: View, event: AccessibilityEvent) {
                super.onInitializeAccessibilityEvent(host, event)
                if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
                    val itemCount = scheduleAdapter.itemCount
                    event.itemCount = itemCount
                    event.fromIndex = 0
                    event.toIndex = itemCount
                }
            }
        }
    }

    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collectLatest { state ->
                when (state) {
                    is ScheduleUiState.Loading -> {
                        binding.swipeRefreshLayout.isRefreshing = true
                        binding.emptyStateView.isVisible = false
                    }
                    is ScheduleUiState.Success -> {
                        binding.swipeRefreshLayout.isRefreshing = false
                        handleSuccessState(state.schedules)
                    }
                    is ScheduleUiState.Error -> {
                        binding.swipeRefreshLayout.isRefreshing = false
                        showError(state.message)
                    }
                }
            }
        }
    }

    private fun handleSuccessState(schedules: List<Schedule>) {
        binding.emptyStateView.isVisible = schedules.isEmpty()
        scheduleAdapter.submitList(schedules) {
            // Announce updates for accessibility
            if (schedules.isNotEmpty()) {
                val message = getString(
                    R.string.schedule_list_updated,
                    schedules.size
                )
                binding.recyclerView.announceForAccessibility(message)
            }
        }
    }

    private fun handleScheduleClick(schedule: Schedule) {
        // Navigate to schedule details with shared element transition
        val scheduleItem = binding.recyclerView
            .findViewHolderForItemId(schedule.id.hashCode().toLong())
            ?.itemView as? ScheduleItem

        scheduleItem?.let {
            navigateToDetails(schedule, it)
        } ?: navigateToDetails(schedule)
    }

    private fun handleScheduleCompletion(schedule: Schedule, completed: Boolean) {
        pendingScheduleUpdate = schedule
        
        // Optimistic update
        scheduleAdapter.updateScheduleCompletion(schedule.id, completed)

        // Show undo snackbar
        snackbar?.dismiss()
        snackbar = Snackbar.make(
            binding.root,
            if (completed) R.string.task_marked_complete
            else R.string.task_marked_incomplete,
            Snackbar.LENGTH_LONG
        ).setAction(R.string.undo) {
            // Revert the change
            scheduleAdapter.updateScheduleCompletion(schedule.id, !completed)
            pendingScheduleUpdate = null
        }.addCallback(object : Snackbar.Callback() {
            override fun onDismissed(snackbar: Snackbar, event: Int) {
                if (event != DISMISS_EVENT_ACTION) {
                    pendingScheduleUpdate?.let {
                        viewModel.completeSchedule(it)
                    }
                }
                pendingScheduleUpdate = null
            }
        })
        snackbar?.show()
    }

    private fun setupErrorHandling() {
        binding.retryButton.setOnClickListener {
            viewModel.retryFailedOperation()
        }
    }

    private fun showError(message: String) {
        snackbar?.dismiss()
        snackbar = Snackbar.make(
            binding.root,
            message,
            Snackbar.LENGTH_INDEFINITE
        ).setAction(R.string.retry) {
            viewModel.retryFailedOperation()
        }
        snackbar?.show()

        // Announce error for accessibility
        binding.root.announceForAccessibility(
            getString(R.string.error_loading_schedules)
        )
    }

    private fun navigateToDetails(schedule: Schedule, sharedElement: View? = null) {
        // Implementation of navigation with shared element transition
        // would go here based on the navigation architecture
    }

    override fun onDestroyView() {
        super.onDestroyView()
        snackbar?.dismiss()
        _binding = null
    }

    companion object {
        fun newInstance() = ScheduleFragment()
    }
}