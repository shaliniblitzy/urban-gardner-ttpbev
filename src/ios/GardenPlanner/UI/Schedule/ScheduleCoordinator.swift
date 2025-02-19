//
// ScheduleCoordinator.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit
import os.log // iOS 14.0+

/// A thread-safe coordinator managing navigation flow and dependency injection for schedule management screens
/// with comprehensive error handling and performance monitoring.
@available(iOS 14.0, *)
final class ScheduleCoordinator: Coordinator {
    
    // MARK: - Properties
    
    var navigationController: UINavigationController
    var childCoordinators: [Coordinator] = []
    weak var parentCoordinator: Coordinator?
    
    private let scheduleService: ScheduleService
    private let coordinatorLock = NSLock()
    private let logger = Logger(subsystem: "com.gardenplanner", category: "ScheduleCoordinator")
    private let performanceMonitor = PerformanceMonitor()
    
    // MARK: - Initialization
    
    /// Initializes the schedule coordinator with required dependencies
    /// - Parameters:
    ///   - navigationController: The navigation controller for managing view hierarchy
    ///   - scheduleService: Service for schedule management operations
    init(navigationController: UINavigationController, scheduleService: ScheduleService) {
        self.navigationController = navigationController
        self.scheduleService = scheduleService
        
        setupPerformanceMonitoring()
    }
    
    // MARK: - Coordinator Protocol
    
    /// Starts the schedule management flow with performance tracking
    func start() {
        let startTime = Date()
        
        // Create and configure view model
        let viewModel = ScheduleViewModel(scheduleService: scheduleService)
        
        // Initialize main schedule view controller
        let scheduleViewController = ScheduleViewController(viewModel: viewModel)
        scheduleViewController.title = "Maintenance Schedule"
        
        // Configure navigation callbacks
        configureNavigationCallbacks(for: scheduleViewController)
        
        // Push view controller with animation
        navigationController.pushViewController(scheduleViewController, animated: true) { [weak self] in
            // Log performance metrics
            let duration = Date().timeIntervalSince(startTime)
            self?.performanceMonitor.logMetric("navigation_push", duration)
        }
    }
    
    func finish() {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        // Clean up any resources
        childCoordinators.removeAll()
        
        // Notify parent coordinator
        parentCoordinator?.removeChildCoordinator(self)
    }
    
    // MARK: - Navigation Methods
    
    /// Shows notification preferences screen with thread safety
    /// - Returns: Result indicating success or error
    func showNotificationPreferences() -> Result<Void, Error> {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        let startTime = Date()
        
        do {
            // Create preferences view controller
            let preferencesViewController = try NotificationPreferencesViewController(
                scheduleService: scheduleService
            )
            
            // Configure completion handler
            preferencesViewController.onPreferencesSaved = { [weak self] in
                self?.navigationController.popViewController(animated: true)
            }
            
            // Push with animation
            navigationController.pushViewController(preferencesViewController, animated: true) { [weak self] in
                let duration = Date().timeIntervalSince(startTime)
                self?.performanceMonitor.logMetric("preferences_push", duration)
            }
            
            return .success(())
            
        } catch {
            logger.error("Failed to show notification preferences: \(error.localizedDescription)")
            return .failure(error)
        }
    }
    
    /// Shows schedule details screen with retry mechanism
    /// - Parameter schedule: The schedule to display
    /// - Returns: Result indicating success or error
    func showScheduleDetails(_ schedule: Schedule) -> Result<Void, Error> {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        let startTime = Date()
        
        do {
            // Create details view controller
            let detailsViewController = try ScheduleDetailsViewController(
                schedule: schedule,
                scheduleService: scheduleService
            )
            
            // Configure completion handler
            detailsViewController.onScheduleUpdated = { [weak self] in
                self?.navigationController.popViewController(animated: true)
            }
            
            // Push with animation and performance tracking
            navigationController.pushViewController(detailsViewController, animated: true) { [weak self] in
                let duration = Date().timeIntervalSince(startTime)
                self?.performanceMonitor.logMetric("details_push", duration)
            }
            
            return .success(())
            
        } catch {
            logger.error("Failed to show schedule details: \(error.localizedDescription)")
            return .failure(error)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupPerformanceMonitoring() {
        performanceMonitor.setThreshold("navigation_push", threshold: 1.0)
        performanceMonitor.setThreshold("preferences_push", threshold: 1.0)
        performanceMonitor.setThreshold("details_push", threshold: 1.0)
        
        performanceMonitor.onThresholdExceeded = { [weak self] (metric, value, threshold) in
            self?.logger.error("Performance threshold exceeded for \(metric): \(value)s (threshold: \(threshold)s)")
        }
    }
    
    private func configureNavigationCallbacks(for viewController: ScheduleViewController) {
        // Handle notification preferences navigation
        viewController.onShowNotificationPreferences = { [weak self] in
            guard let self = self else { return }
            
            switch self.showNotificationPreferences() {
            case .failure(let error):
                self.handleError(error)
            default:
                break
            }
        }
        
        // Handle schedule details navigation
        viewController.onShowScheduleDetails = { [weak self] schedule in
            guard let self = self else { return }
            
            switch self.showScheduleDetails(schedule) {
            case .failure(let error):
                self.handleError(error)
            default:
                break
            }
        }
    }
    
    private func handleError(_ error: Error) {
        logger.error("Coordinator error: \(error.localizedDescription)")
        
        // Show error alert on main thread
        DispatchQueue.main.async {
            AlertManager.shared.showError(error, from: self.navigationController)
        }
    }
}

// MARK: - Performance Monitoring

private final class PerformanceMonitor {
    private var thresholds: [String: TimeInterval] = [:]
    var onThresholdExceeded: ((String, TimeInterval, TimeInterval) -> Void)?
    
    func setThreshold(_ metric: String, threshold: TimeInterval) {
        thresholds[metric] = threshold
    }
    
    func logMetric(_ metric: String, _ value: TimeInterval) {
        if let threshold = thresholds[metric], value > threshold {
            onThresholdExceeded?(metric, value, threshold)
        }
    }
}