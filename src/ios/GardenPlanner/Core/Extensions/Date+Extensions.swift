//
// Date+Extensions.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation
import Core

/// Extension to Date class providing garden maintenance scheduling utilities
extension Date {
    
    // MARK: - Private Properties
    
    /// Cached date formatter for performance optimization
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
    
    // MARK: - Public Methods
    
    /// Adds specified number of days to the current date
    /// - Parameter days: Number of days to add
    /// - Returns: New date with added days or nil if invalid
    public func addDays(_ days: Int) -> Date? {
        // Validate input is within allowed range
        guard days >= 0 && days <= ScheduleConstants.maxScheduleDays else {
            return nil
        }
        
        var dateComponents = DateComponents()
        dateComponents.day = days
        
        return Calendar.current.date(byAdding: dateComponents, to: self)
    }
    
    /// Returns the start of the day (midnight 00:00:00) for the current date
    /// - Returns: Date set to start of day
    public func startOfDay() -> Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month, .day], from: self)
        
        // Create new date with midnight time components
        return calendar.date(from: components) ?? self
    }
    
    /// Returns the end of the day (23:59:59) for the current date
    /// - Returns: Date set to end of day
    public func endOfDay() -> Date {
        let calendar = Calendar.current
        var components = calendar.dateComponents([.year, .month, .day], from: self)
        
        // Set components to end of day
        components.hour = 23
        components.minute = 59
        components.second = 59
        
        return calendar.date(from: components) ?? self
    }
    
    /// Checks if the date falls on a weekend
    /// - Returns: True if date is weekend, false otherwise
    public func isWeekend() -> Bool {
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: self)
        
        // weekday 1 is Sunday, 7 is Saturday
        return weekday == 1 || weekday == 7
    }
    
    /// Calculates next valid maintenance date skipping weekends
    /// - Returns: Next valid maintenance date
    public func nextValidMaintenanceDate() -> Date? {
        let calendar = Calendar.current
        var nextDate = self
        
        // If current date is weekend, calculate next weekday
        if isWeekend() {
            let weekday = calendar.component(.weekday, from: self)
            let daysToAdd = weekday == 1 ? 1 : 2  // Sunday: add 1 day, Saturday: add 2 days
            
            guard let adjustedDate = addDays(daysToAdd) else {
                return nil
            }
            nextDate = adjustedDate
        }
        
        // Validate the resulting date is within allowed range
        let startDate = Date()
        guard let maxDate = startDate.addDays(ScheduleConstants.maxScheduleDays),
              nextDate <= maxDate else {
            return nil
        }
        
        return nextDate
    }
    
    /// Formats date for schedule display
    /// - Returns: Formatted date string
    public func formattedForSchedule() -> String {
        return Date.dateFormatter.string(from: self)
    }
}