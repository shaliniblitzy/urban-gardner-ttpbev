//
// ScheduleService.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation
import os.log

/// A thread-safe service class that coordinates schedule management, maintenance tasks,
/// and notifications with performance monitoring and error recovery.
final class ScheduleService {
    
    // MARK: - Constants
    
    private let CACHE_EXPIRATION_INTERVAL: TimeInterval = 30 * 60 // 30 minutes
    private let PERFORMANCE_THRESHOLD: TimeInterval = 2.0 // 2 seconds for schedule creation
    private let NOTIFICATION_DELIVERY_THRESHOLD: TimeInterval = 1.0 // 1 second for notification delivery
    
    // MARK: - Properties
    
    private let scheduleLock = NSLock()
    private let maintenanceScheduler: MaintenanceScheduler
    private let notificationManager: NotificationManager
    private var currentSchedules: [Schedule] = []
    private let scheduleCache: NSCache<NSString, [Schedule]>
    private let logger: Logger
    private var lastCacheUpdate: Date
    
    // MARK: - Initialization
    
    init() {
        self.notificationManager = NotificationManager.shared
        self.maintenanceScheduler = MaintenanceScheduler(
            notificationScheduler: NotificationScheduler()
        )
        self.logger = Logger.shared
        self.lastCacheUpdate = Date()
        
        // Initialize cache with limits
        self.scheduleCache = NSCache<NSString, [Schedule]>()
        self.scheduleCache.countLimit = 100
        
        // Register for notification authorization changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNotificationAuthorizationChange(_:)),
            name: NSNotification.Name("NotificationAuthorizationChanged"),
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Public Methods
    
    /// Creates a new maintenance schedule for a plant with delivery confirmation
    /// - Parameters:
    ///   - plant: The plant requiring maintenance
    ///   - startDate: Schedule start date
    /// - Returns: Result containing created schedules or error
    func createScheduleForPlant(plant: Plant, startDate: Date) -> Result<[Schedule], Error> {
        let perfStartTime = Date()
        
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        do {
            // Generate schedules using maintenance scheduler
            let schedules = try maintenanceScheduler.generateSchedule(
                for: plant,
                startDate: startDate,
                periodDays: ScheduleConstants.maxScheduleDays
            )
            
            // Track performance
            let executionTime = Date().timeIntervalSince(perfStartTime)
            if executionTime > PERFORMANCE_THRESHOLD {
                logger.error(GardenPlannerError.customError(
                    .scheduleGenerationFailed,
                    "Schedule generation exceeded performance threshold: \(executionTime)s"
                ))
            }
            
            // Update current schedules and cache
            currentSchedules.append(contentsOf: schedules)
            updateScheduleCache(for: plant.id, schedules: schedules)
            
            logger.info("Created \(schedules.count) schedules for plant: \(plant.id)")
            return .success(schedules)
            
        } catch {
            logger.error(error)
            return .failure(error)
        }
    }
    
    /// Updates an existing schedule with enhanced error handling
    /// - Parameter schedule: The schedule to update
    /// - Returns: Success status with error handling
    func updateSchedule(_ schedule: Schedule) -> Result<Bool, Error> {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        do {
            // Validate schedule state
            guard let index = currentSchedules.firstIndex(where: { $0.id == schedule.id }) else {
                throw GardenPlannerError.customError(.scheduleGenerationFailed, "Schedule not found")
            }
            
            // Update schedule with retry mechanism
            try maintenanceScheduler.updateSchedule(
                schedule,
                completed: schedule.isCompleted,
                feedback: nil
            )
            
            // Update notification if needed
            if schedule.isCompleted {
                notificationManager.cancelNotification(identifier: schedule.id)
            }
            
            // Update cache and current schedules
            currentSchedules[index] = schedule
            invalidateCache(for: schedule.plant.id)
            
            logger.info("Successfully updated schedule: \(schedule.id)")
            return .success(true)
            
        } catch {
            logger.error(error)
            return .failure(error)
        }
    }
    
    /// Marks a schedule as completed with retry mechanism
    /// - Parameter schedule: The schedule to complete
    /// - Returns: Next schedule if recurring or error
    func completeSchedule(_ schedule: Schedule) -> Result<Schedule?, Error> {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        do {
            // Validate completion state
            guard !schedule.isCompleted else {
                throw GardenPlannerError.customError(.scheduleGenerationFailed, "Schedule already completed")
            }
            
            // Mark as completed and generate next schedule if recurring
            schedule.markAsCompleted()
            
            // Cancel existing notification
            notificationManager.cancelNotification(identifier: schedule.id)
            
            var nextSchedule: Schedule?
            if let newSchedule = schedule.generateNextSchedule() {
                // Schedule notification for next occurrence
                let notificationResult = notificationManager.scheduleNotification(
                    identifier: newSchedule.id,
                    title: "Garden Maintenance Required",
                    body: "Time to \(newSchedule.taskType.lowercased()) your \(newSchedule.plant.type)",
                    date: newSchedule.dueDate
                ) { error in
                    if let error = error {
                        self.logger.error(error)
                    }
                }
                
                if notificationResult != nil {
                    nextSchedule = newSchedule
                    currentSchedules.append(newSchedule)
                }
            }
            
            // Update cache
            invalidateCache(for: schedule.plant.id)
            
            logger.info("Completed schedule: \(schedule.id), next schedule: \(nextSchedule?.id ?? "none")")
            return .success(nextSchedule)
            
        } catch {
            logger.error(error)
            return .failure(error)
        }
    }
    
    /// Retrieves cached overdue schedules with refresh mechanism
    /// - Returns: Array of overdue schedules
    func getOverdueSchedules() -> [Schedule] {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        // Check if cache needs refresh
        if Date().timeIntervalSince(lastCacheUpdate) > CACHE_EXPIRATION_INTERVAL {
            let overdueSchedules = maintenanceScheduler.getOverdueSchedules()
            
            // Sort by priority and due date
            let sortedSchedules = overdueSchedules.sorted { schedule1, schedule2 in
                if schedule1.dueDate == schedule2.dueDate {
                    return schedule1.taskType == "WATERING" && schedule2.taskType == "FERTILIZING"
                }
                return schedule1.dueDate < schedule2.dueDate
            }
            
            // Update cache
            updateScheduleCache(for: "overdue", schedules: sortedSchedules)
            return sortedSchedules
        }
        
        // Return cached schedules
        return scheduleCache.object(forKey: "overdue" as NSString) ?? []
    }
    
    /// Updates notification preferences with validation
    /// - Parameter preferences: New notification preferences
    /// - Returns: Success or error status
    func updateNotificationPreferences(_ preferences: NotificationPreferences) -> Result<Void, Error> {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        do {
            // Update preferences for all current schedules
            for schedule in currentSchedules {
                schedule.updateNotificationPreference(preferences)
                
                // Reschedule notification with new preferences
                notificationManager.cancelNotification(identifier: schedule.id)
                
                let notificationResult = notificationManager.scheduleNotification(
                    identifier: schedule.id,
                    title: "Garden Maintenance Required",
                    body: "Time to \(schedule.taskType.lowercased()) your \(schedule.plant.type)",
                    date: schedule.dueDate
                ) { error in
                    if let error = error {
                        self.logger.error(error)
                    }
                }
                
                if notificationResult == nil {
                    throw GardenPlannerError.customError(.notificationDeliveryFailed, "Failed to reschedule notification")
                }
            }
            
            logger.info("Updated notification preferences for \(currentSchedules.count) schedules")
            return .success(())
            
        } catch {
            logger.error(error)
            return .failure(error)
        }
    }
    
    // MARK: - Private Methods
    
    private func updateScheduleCache(for key: String, schedules: [Schedule]) {
        scheduleCache.setObject(schedules, forKey: key as NSString)
        lastCacheUpdate = Date()
    }
    
    private func invalidateCache(for key: String) {
        scheduleCache.removeObject(forKey: key as NSString)
        lastCacheUpdate = Date()
    }
    
    @objc private func handleNotificationAuthorizationChange(_ notification: Notification) {
        guard let isAuthorized = notification.object as? Bool else { return }
        
        if !isAuthorized {
            logger.error(GardenPlannerError.customError(
                .notificationDeliveryFailed,
                "Notification authorization revoked"
            ))
        }
    }
}