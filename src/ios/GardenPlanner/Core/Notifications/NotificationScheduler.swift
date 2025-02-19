//
// NotificationScheduler.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation
import os.log

/// A thread-safe service class responsible for scheduling, managing and optimizing garden maintenance notifications
/// with robust error handling and performance monitoring.
final class NotificationScheduler {
    
    // MARK: - Constants
    
    private let NOTIFICATION_REMINDER_OFFSET: TimeInterval = 3600 // 1 hour
    private let MAX_SCHEDULE_DAYS = 365
    private let MAX_RETRY_ATTEMPTS = 3
    private let BATCH_SIZE = 10
    private let DELIVERY_TIMEOUT: TimeInterval = 1.0
    
    // MARK: - Properties
    
    private let notificationManager: NotificationManager
    private var activeSchedules: [String: Schedule]
    private let notificationQueue: DispatchQueue
    private let logger: Logger
    private let scheduleCache: NSCache<NSString, Schedule>
    
    // MARK: - Initialization
    
    init() {
        notificationManager = NotificationManager.shared
        activeSchedules = [:]
        notificationQueue = DispatchQueue(
            label: "com.gardenplanner.notification.scheduler",
            qos: .userInitiated,
            attributes: .concurrent
        )
        logger = Logger.shared
        
        scheduleCache = NSCache<NSString, Schedule>()
        scheduleCache.countLimit = 100
        
        // Register for delivery confirmations
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeliveryConfirmation(_:)),
            name: NSNotification.Name("NotificationDeliveredNotification"),
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Public Methods
    
    /// Schedules a notification for a maintenance task with retry support and performance optimization
    /// - Parameters:
    ///   - schedule: The schedule to create a notification for
    ///   - enableRetry: Whether to enable automatic retry on failure
    /// - Returns: Success status of notification scheduling
    func scheduleNotificationForTask(_ schedule: Schedule, enableRetry: Bool = true) -> Bool {
        // Validate schedule
        guard schedule.dueDate > Date(),
              schedule.dueDate <= Calendar.current.date(byAdding: .day, value: MAX_SCHEDULE_DAYS, to: Date())!
        else {
            logger.error(GardenPlannerError.invalidInput(.scheduleGenerationFailed))
            return false
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        var success = false
        
        notificationQueue.async { [weak self] in
            guard let self = self else {
                semaphore.signal()
                return
            }
            
            // Calculate optimal notification time
            let notificationDate = Calendar.current.date(
                byAdding: .second,
                value: -Int(self.NOTIFICATION_REMINDER_OFFSET),
                to: schedule.dueDate
            )!
            
            // Generate notification content
            let title = "Garden Maintenance Required"
            let body = "Time to \(schedule.taskType.lowercased()) your \(schedule.plant.type)"
            
            // Add to active schedules
            self.activeSchedules[schedule.id] = schedule
            self.scheduleCache.setObject(schedule, forKey: schedule.id as NSString)
            
            // Schedule notification with user info for tracking
            let userInfo: [String: Any] = [
                "scheduleId": schedule.id,
                "taskType": schedule.taskType,
                "plantId": schedule.plant.id,
                "retryCount": 0
            ]
            
            self.notificationManager.scheduleNotification(
                identifier: schedule.id,
                title: title,
                body: body,
                date: notificationDate,
                userInfo: userInfo
            ) { error in
                if let error = error {
                    self.logger.error(error)
                    
                    if enableRetry {
                        self.handleScheduleRetry(schedule)
                    }
                    
                    semaphore.signal()
                    return
                }
                
                self.logger.debug("Successfully scheduled notification for task: \(schedule.id)")
                success = true
                semaphore.signal()
            }
        }
        
        _ = semaphore.wait(timeout: .now() + DELIVERY_TIMEOUT)
        return success
    }
    
    /// Processes notification delivery confirmations and handles failures
    /// - Parameters:
    ///   - scheduleId: Identifier of the schedule
    ///   - success: Delivery success status
    @objc private func handleDeliveryConfirmation(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let scheduleId = userInfo["scheduleId"] as? String,
              let success = userInfo["success"] as? Bool else {
            return
        }
        
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            if success {
                self.logger.debug("Notification delivered successfully: \(scheduleId)")
                self.activeSchedules.removeValue(forKey: scheduleId)
                self.scheduleCache.removeObject(forKey: scheduleId as NSString)
            } else {
                self.logger.error(GardenPlannerError.customError(.notificationDeliveryFailed,
                                                               "Failed to deliver notification: \(scheduleId)"))
                
                if let schedule = self.activeSchedules[scheduleId] {
                    self.handleScheduleRetry(schedule)
                }
            }
        }
    }
    
    /// Optimizes notification batches for performance
    /// - Parameter schedules: Array of schedules to optimize
    /// - Returns: Success status of batch optimization
    func optimizeNotificationBatch(_ schedules: [Schedule]) -> Bool {
        guard !schedules.isEmpty else { return false }
        
        var success = true
        let batches = stride(from: 0, to: schedules.count, by: BATCH_SIZE).map {
            Array(schedules[($0)..<min($0 + BATCH_SIZE, schedules.count)])
        }
        
        let group = DispatchGroup()
        
        batches.forEach { batchSchedules in
            group.enter()
            
            notificationQueue.async { [weak self] in
                guard let self = self else {
                    group.leave()
                    return
                }
                
                // Sort by due date for optimal scheduling
                let sortedSchedules = batchSchedules.sorted { $0.dueDate < $1.dueDate }
                
                // Schedule batch with minimal delay between notifications
                for schedule in sortedSchedules {
                    if !self.scheduleNotificationForTask(schedule, enableRetry: true) {
                        success = false
                    }
                    Thread.sleep(forTimeInterval: 0.1) // Prevent notification flood
                }
                
                group.leave()
            }
        }
        
        group.wait()
        return success
    }
    
    // MARK: - Private Methods
    
    private func handleScheduleRetry(_ schedule: Schedule) {
        guard let userInfo = notificationManager.getPendingNotifications(completion: { _ in }).first(where: { $0.identifier == schedule.id })?.content.userInfo,
              let retryCount = userInfo["retryCount"] as? Int,
              retryCount < MAX_RETRY_ATTEMPTS else {
            logger.error(GardenPlannerError.customError(.notificationDeliveryFailed,
                                                      "Max retry attempts reached for schedule: \(schedule.id)"))
            return
        }
        
        // Exponential backoff for retries
        let delay = pow(Double(retryCount + 1), 2)
        
        notificationQueue.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self else { return }
            
            var updatedUserInfo = userInfo
            updatedUserInfo["retryCount"] = retryCount + 1
            
            self.notificationManager.cancelNotification(identifier: schedule.id)
            _ = self.scheduleNotificationForTask(schedule, enableRetry: true)
            
            self.logger.debug("Retry attempt \(retryCount + 1) for schedule: \(schedule.id)")
        }
    }
}