//
// Schedule.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// A thread-safe model class representing a maintenance schedule for garden plants
/// with support for recurring tasks and completion tracking.
@objc public class Schedule: NSObject, Codable, Identifiable {
    
    // MARK: - Properties
    
    public let id: String
    public let plant: Plant
    public let taskType: String
    public let dueDate: Date
    private(set) public var isCompleted: Bool
    private(set) public var notificationPreference: NotificationPreferences
    private(set) public var reminderTime: Date
    private(set) public var completedDate: Date?
    private(set) public var isRecurring: Bool
    private(set) public var recurringFrequencyDays: Int
    
    // Thread safety
    private let scheduleLock = NSLock()
    
    // MARK: - Initialization
    
    /// Creates a new Schedule instance with comprehensive validation and recurring task setup
    /// - Parameters:
    ///   - id: Unique identifier for the schedule
    ///   - plant: Associated Plant instance
    ///   - taskType: Type of maintenance task
    ///   - dueDate: Date when task should be completed
    ///   - notificationPreference: User's notification preferences
    public init(
        id: String,
        plant: Plant,
        taskType: String,
        dueDate: Date,
        notificationPreference: NotificationPreferences
    ) {
        // Validate inputs
        precondition(!id.isEmpty, "Schedule ID cannot be empty")
        precondition(dueDate > Date(), "Due date must be in the future")
        
        self.id = id
        self.plant = plant
        self.taskType = taskType
        self.dueDate = dueDate
        self.notificationPreference = notificationPreference
        self.isCompleted = false
        
        // Set default reminder time
        self.reminderTime = NotificationPreferences.defaultReminderTime
        
        // Determine if task is recurring and set frequency
        switch taskType {
        case "WATERING":
            self.isRecurring = true
            self.recurringFrequencyDays = plant.wateringFrequencyDays
        case "FERTILIZING":
            self.isRecurring = true
            self.recurringFrequencyDays = plant.fertilizingFrequencyDays
        default:
            self.isRecurring = false
            self.recurringFrequencyDays = 0
        }
        
        super.init()
    }
    
    // MARK: - Public Methods
    
    /// Thread-safe method to mark schedule as completed and handle recurring task generation
    public func markAsCompleted() {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        guard !isCompleted else { return }
        
        isCompleted = true
        completedDate = Date()
        
        // Update plant's last care date
        switch taskType {
        case "WATERING":
            plant.lastWateredDate = completedDate!
        case "FERTILIZING":
            plant.lastFertilizedDate = completedDate!
        default:
            break
        }
        
        // Generate next schedule if recurring
        if isRecurring {
            _ = generateNextSchedule()
        }
        
        // Post notification for schedule completion
        NotificationCenter.default.post(
            name: NSNotification.Name("ScheduleCompletedNotification"),
            object: self
        )
    }
    
    /// Creates the next schedule instance for recurring tasks
    /// - Returns: New schedule instance for next occurrence
    public func generateNextSchedule() -> Schedule {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        let calendar = Calendar.current
        
        // Calculate next due date
        let nextDueDate = calendar.date(
            byAdding: .day,
            value: recurringFrequencyDays,
            to: dueDate
        )!
        
        // Generate new unique ID
        let newId = "\(id)_next_\(Int(Date().timeIntervalSince1970))"
        
        // Create new schedule with inherited properties
        let nextSchedule = Schedule(
            id: newId,
            plant: plant,
            taskType: taskType,
            dueDate: nextDueDate,
            notificationPreference: notificationPreference
        )
        
        // Copy current reminder time
        nextSchedule.updateReminderTime(reminderTime)
        
        return nextSchedule
    }
    
    /// Updates notification preferences with support for recurring schedule updates
    /// - Parameter preference: New notification preference setting
    public func updateNotificationPreference(_ preference: NotificationPreferences) {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        self.notificationPreference = preference
        
        // Post notification for preference update
        NotificationCenter.default.post(
            name: NSNotification.Name("SchedulePreferenceUpdatedNotification"),
            object: self
        )
    }
    
    /// Updates the reminder time for the schedule
    /// - Parameter time: New reminder time
    public func updateReminderTime(_ time: Date) {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        let calendar = Calendar.current
        var components = calendar.dateComponents([.hour, .minute], from: time)
        components.second = 0
        
        if let newTime = calendar.date(from: components) {
            self.reminderTime = newTime
        }
    }
    
    /// Thread-safe check for schedule overdue status
    /// - Returns: True if schedule is overdue
    public func isOverdue() -> Bool {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        guard !isCompleted else { return false }
        
        let now = Date()
        return dueDate < now
    }
    
    // MARK: - Codable Implementation
    
    private enum CodingKeys: String, CodingKey {
        case id, plant, taskType, dueDate, isCompleted, notificationPreference,
             reminderTime, completedDate, isRecurring, recurringFrequencyDays
    }
}