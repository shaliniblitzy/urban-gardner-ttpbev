//
// NotificationService.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation

/// High-level service that coordinates notification management and scheduling for garden maintenance tasks
/// with enhanced thread safety, performance monitoring, and robust error handling.
final class NotificationService {
    
    // MARK: - Constants
    
    private let DELIVERY_TIMEOUT: TimeInterval = 1.0
    private let MAX_RETRY_ATTEMPTS = RetryConfiguration.maxAttempts
    private let RETRY_INTERVAL = RetryConfiguration.retryInterval
    private let PERFORMANCE_THRESHOLD: TimeInterval = 0.5
    
    // MARK: - Properties
    
    private let notificationManager: NotificationManager
    private let notificationScheduler: NotificationScheduler
    private let scheduleLock: NSLock
    private let notificationQueue: DispatchQueue
    private var activeSchedules: [String: Schedule]
    private let logger: Logger
    
    // Performance monitoring
    private var deliveryMetrics: [String: TimeInterval] = [:]
    private let metricsLock = NSLock()
    
    // MARK: - Initialization
    
    init() {
        notificationManager = NotificationManager.shared
        notificationScheduler = NotificationScheduler()
        scheduleLock = NSLock()
        notificationQueue = DispatchQueue(
            label: "com.gardenplanner.notification.service",
            qos: .userInitiated,
            attributes: .concurrent
        )
        activeSchedules = [:]
        logger = Logger.shared
        
        setupDeliveryMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Sets up notification permissions and initial configuration with enhanced error handling
    /// - Parameter completion: Callback with setup result and potential error
    func setupNotifications(completion: @escaping (Result<Bool, GardenPlannerError>) -> Void) {
        notificationManager.requestAuthorization { [weak self] granted, error in
            guard let self = self else { return }
            
            if let error = error {
                self.logger.error(GardenPlannerError.customError(.notificationDeliveryFailed, error.localizedDescription))
                completion(.failure(.customError(.notificationDeliveryFailed, error.localizedDescription)))
                return
            }
            
            if granted {
                self.logger.debug("Notification authorization granted")
                completion(.success(true))
            } else {
                self.logger.error(GardenPlannerError.customError(.notificationDeliveryFailed, "Notification authorization denied"))
                completion(.failure(.customError(.notificationDeliveryFailed, "Notification authorization denied")))
            }
        }
    }
    
    /// Schedules a notification for a maintenance task with delivery confirmation and performance monitoring
    /// - Parameters:
    ///   - schedule: The schedule to create a notification for
    ///   - completion: Callback with scheduling result and potential error
    func scheduleNotification(_ schedule: Schedule, completion: @escaping (Result<Bool, GardenPlannerError>) -> Void) {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        // Validate schedule
        guard schedule.dueDate > Date() else {
            completion(.failure(.invalidInput(.scheduleGenerationFailed)))
            return
        }
        
        let startTime = Date()
        
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Schedule notification with performance tracking
            let success = self.notificationScheduler.scheduleNotificationForTask(schedule)
            
            if success {
                self.activeSchedules[schedule.id] = schedule
                self.trackPerformanceMetrics(schedule.id, startTime: startTime)
                self.logger.debug("Successfully scheduled notification for task: \(schedule.id)")
                completion(.success(true))
            } else {
                self.logger.error(GardenPlannerError.customError(.notificationDeliveryFailed,
                                                             "Failed to schedule notification for task: \(schedule.id)"))
                completion(.failure(.customError(.notificationDeliveryFailed,
                                              "Failed to schedule notification")))
            }
        }
    }
    
    /// Updates an existing notification with enhanced error handling and completion tracking
    /// - Parameters:
    ///   - schedule: The schedule to update
    ///   - completion: Callback with update result and potential error
    func updateNotification(_ schedule: Schedule, completion: @escaping (Result<Bool, GardenPlannerError>) -> Void) {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        guard activeSchedules[schedule.id] != nil else {
            completion(.failure(.customError(.notificationDeliveryFailed, "Schedule not found")))
            return
        }
        
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Cancel existing notification
            self.notificationManager.cancelNotification(identifier: schedule.id)
            
            // Schedule updated notification
            let success = self.notificationScheduler.scheduleNotificationForTask(schedule)
            
            if success {
                self.activeSchedules[schedule.id] = schedule
                self.logger.debug("Successfully updated notification for task: \(schedule.id)")
                completion(.success(true))
            } else {
                self.logger.error(GardenPlannerError.customError(.notificationDeliveryFailed,
                                                             "Failed to update notification for task: \(schedule.id)"))
                completion(.failure(.customError(.notificationDeliveryFailed,
                                              "Failed to update notification")))
            }
        }
    }
    
    /// Processes user response to notification with comprehensive error handling
    /// - Parameters:
    ///   - scheduleId: Identifier of the schedule
    ///   - actionIdentifier: Identifier of the user action
    ///   - completion: Callback with processing result and potential error
    func handleNotificationResponse(scheduleId: String,
                                  actionIdentifier: String,
                                  completion: @escaping (Result<Void, GardenPlannerError>) -> Void) {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        guard let schedule = activeSchedules[scheduleId] else {
            completion(.failure(.customError(.notificationDeliveryFailed, "Schedule not found")))
            return
        }
        
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            switch actionIdentifier {
            case "COMPLETE_TASK":
                schedule.markAsCompleted()
                self.activeSchedules.removeValue(forKey: scheduleId)
                
                if schedule.isRecurring {
                    let nextSchedule = schedule.generateNextSchedule()
                    self.scheduleNotification(nextSchedule) { _ in }
                }
                
                completion(.success(()))
                
            case "POSTPONE_TASK":
                // Create new schedule with adjusted due date
                let calendar = Calendar.current
                if let postponedDate = calendar.date(byAdding: .hour, value: 1, to: schedule.dueDate) {
                    schedule.updateReminderTime(postponedDate)
                    self.updateNotification(schedule) { _ in }
                }
                
                completion(.success(()))
                
            default:
                completion(.failure(.customError(.notificationDeliveryFailed,
                                              "Unknown action identifier: \(actionIdentifier)")))
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func setupDeliveryMonitoring() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeliveryConfirmation(_:)),
            name: NSNotification.Name("NotificationDeliveredNotification"),
            object: nil
        )
    }
    
    @objc private func handleDeliveryConfirmation(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let scheduleId = userInfo["scheduleId"] as? String,
              let success = userInfo["success"] as? Bool else {
            return
        }
        
        if !success {
            handleDeliveryFailure(scheduleId)
        }
    }
    
    private func handleDeliveryFailure(_ scheduleId: String) {
        guard let schedule = activeSchedules[scheduleId] else { return }
        
        let retryCount = UserDefaults.standard.integer(forKey: "retry_count_\(scheduleId)")
        
        if retryCount < MAX_RETRY_ATTEMPTS {
            UserDefaults.standard.set(retryCount + 1, forKey: "retry_count_\(scheduleId)")
            
            // Exponential backoff
            let delay = pow(Double(retryCount + 1), 2) * RETRY_INTERVAL
            
            notificationQueue.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self = self else { return }
                self.scheduleNotification(schedule) { _ in }
            }
        } else {
            logger.error(GardenPlannerError.customError(.notificationDeliveryFailed,
                                                    "Max retry attempts reached for schedule: \(scheduleId)"))
        }
    }
    
    private func trackPerformanceMetrics(_ scheduleId: String, startTime: Date) {
        let deliveryTime = Date().timeIntervalSince(startTime)
        
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        deliveryMetrics[scheduleId] = deliveryTime
        
        if deliveryTime > PERFORMANCE_THRESHOLD {
            logger.debug("Performance warning: Slow notification delivery (\(String(format: "%.2f", deliveryTime))s) for schedule: \(scheduleId)")
        }
    }
}