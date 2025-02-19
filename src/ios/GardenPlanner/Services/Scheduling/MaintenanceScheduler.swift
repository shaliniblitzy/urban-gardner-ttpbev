//
// MaintenanceScheduler.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// A thread-safe service class responsible for generating and managing maintenance schedules
/// with performance optimization and error recovery mechanisms.
final class MaintenanceScheduler {
    
    // MARK: - Constants
    
    private let DEFAULT_WATERING_FREQUENCY = 3
    private let DEFAULT_FERTILIZING_FREQUENCY = 14
    private let MAX_SCHEDULE_PERIOD_DAYS = 365
    private let MAX_RETRY_ATTEMPTS = 3
    private let RETRY_DELAY_SECONDS = 1.0
    private let CACHE_EXPIRATION_MINUTES = 30
    
    // MARK: - Properties
    
    private let notificationScheduler: NotificationScheduler
    private var activeSchedules: [String: [Schedule]]
    private let scheduleLock = NSLock()
    private let scheduleCache: NSCache<NSString, NSArray>
    private let retryQueue: DispatchQueue
    private let logger: Logger
    private var lastUpdateDate: Date
    
    // MARK: - Initialization
    
    /// Initializes the maintenance scheduler with required dependencies
    /// - Parameter notificationScheduler: The notification scheduler instance
    init(notificationScheduler: NotificationScheduler) {
        self.notificationScheduler = notificationScheduler
        self.activeSchedules = [:]
        self.lastUpdateDate = Date()
        
        // Initialize cache with limits
        self.scheduleCache = NSCache<NSString, NSArray>()
        self.scheduleCache.countLimit = 100
        
        // Initialize retry queue
        self.retryQueue = DispatchQueue(
            label: "com.gardenplanner.scheduler.retry",
            qos: .utility
        )
        
        self.logger = Logger.shared
        
        // Register for schedule completion notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleScheduleCompletion(_:)),
            name: NSNotification.Name("ScheduleCompletedNotification"),
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - Public Methods
    
    /// Generates a maintenance schedule for a plant with optimized caching
    /// - Parameters:
    ///   - plant: The plant requiring maintenance
    ///   - startDate: Schedule start date
    ///   - periodDays: Number of days to schedule
    /// - Returns: Array of generated schedules
    func generateSchedule(for plant: Plant, startDate: Date, periodDays: Int) throws -> [Schedule] {
        // Validate input parameters
        guard periodDays > 0 && periodDays <= MAX_SCHEDULE_PERIOD_DAYS else {
            throw GardenPlannerError.invalidInput(.scheduleGenerationFailed)
        }
        
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        // Check cache first
        let cacheKey = "\(plant.id)_\(startDate.timeIntervalSince1970)_\(periodDays)" as NSString
        if let cachedSchedules = scheduleCache.object(forKey: cacheKey) as? [Schedule] {
            return cachedSchedules
        }
        
        var schedules: [Schedule] = []
        let calendar = Calendar.current
        
        // Generate watering schedules
        if plant.needsWatering() {
            let wateringFrequency = plant.wateringFrequencyDays
            var currentDate = startDate
            
            while calendar.dateComponents([.day], from: startDate, to: currentDate).day! <= periodDays {
                let schedule = Schedule(
                    id: UUID().uuidString,
                    plant: plant,
                    taskType: "WATERING",
                    dueDate: currentDate,
                    notificationPreference: .init()
                )
                schedules.append(schedule)
                
                currentDate = calendar.date(byAdding: .day, value: wateringFrequency, to: currentDate)!
            }
        }
        
        // Generate fertilizing schedules
        if plant.needsFertilizing() {
            let fertilizingFrequency = plant.fertilizingFrequencyDays
            var currentDate = startDate
            
            while calendar.dateComponents([.day], from: startDate, to: currentDate).day! <= periodDays {
                let schedule = Schedule(
                    id: UUID().uuidString,
                    plant: plant,
                    taskType: "FERTILIZING",
                    dueDate: currentDate,
                    notificationPreference: .init()
                )
                schedules.append(schedule)
                
                currentDate = calendar.date(byAdding: .day, value: fertilizingFrequency, to: currentDate)!
            }
        }
        
        // Sort schedules by due date
        schedules.sort { $0.dueDate < $1.dueDate }
        
        // Schedule notifications with retry mechanism
        for schedule in schedules {
            scheduleNotificationWithRetry(for: schedule)
        }
        
        // Cache the generated schedules
        scheduleCache.setObject(schedules as NSArray, forKey: cacheKey)
        activeSchedules[plant.id] = schedules
        
        return schedules
    }
    
    /// Updates an existing schedule with completion status and feedback
    /// - Parameters:
    ///   - schedule: The schedule to update
    ///   - completed: Completion status
    ///   - feedback: Optional feedback for schedule adjustment
    func updateSchedule(_ schedule: Schedule, completed: Bool, feedback: String? = nil) throws {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        guard let plantSchedules = activeSchedules[schedule.plant.id],
              let scheduleIndex = plantSchedules.firstIndex(where: { $0.id == schedule.id }) else {
            throw GardenPlannerError.customError(.scheduleGenerationFailed, "Schedule not found")
        }
        
        if completed {
            schedule.markAsCompleted()
            
            // Generate next schedule if recurring
            if let nextSchedule = schedule.generateNextSchedule() {
                scheduleNotificationWithRetry(for: nextSchedule)
                activeSchedules[schedule.plant.id]?.append(nextSchedule)
            }
        }
        
        // Process feedback if provided
        if let feedback = feedback {
            logger.info("Processing schedule feedback: \(feedback) for schedule: \(schedule.id)")
            // Implement feedback processing logic here
        }
        
        // Update cache
        invalidateCache(for: schedule.plant.id)
    }
    
    /// Retrieves overdue schedules with priority sorting
    /// - Returns: Array of overdue schedules
    func getOverdueSchedules() -> [Schedule] {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        let overdueSchedules = activeSchedules.values.flatMap { schedules in
            schedules.filter { $0.isOverdue() }
        }
        
        // Sort by priority and due date
        return overdueSchedules.sorted { schedule1, schedule2 in
            if schedule1.dueDate == schedule2.dueDate {
                // Prioritize watering over fertilizing
                return schedule1.taskType == "WATERING" && schedule2.taskType == "FERTILIZING"
            }
            return schedule1.dueDate < schedule2.dueDate
        }
    }
    
    // MARK: - Private Methods
    
    private func scheduleNotificationWithRetry(for schedule: Schedule, retryCount: Int = 0) {
        let success = notificationScheduler.scheduleNotificationForTask(schedule)
        
        if !success && retryCount < MAX_RETRY_ATTEMPTS {
            retryQueue.asyncAfter(deadline: .now() + RETRY_DELAY_SECONDS * Double(retryCount + 1)) { [weak self] in
                self?.scheduleNotificationWithRetry(for: schedule, retryCount: retryCount + 1)
            }
        } else if !success {
            logger.error(GardenPlannerError.customError(.notificationDeliveryFailed,
                                                      "Failed to schedule notification after \(MAX_RETRY_ATTEMPTS) attempts"))
        }
    }
    
    private func invalidateCache(for plantId: String) {
        let pattern = "\(plantId)_"
        scheduleCache.removeAllObjects()
        lastUpdateDate = Date()
    }
    
    @objc private func handleScheduleCompletion(_ notification: Notification) {
        guard let schedule = notification.object as? Schedule else { return }
        
        do {
            try updateSchedule(schedule, completed: true)
        } catch {
            logger.error(error)
        }
    }
}