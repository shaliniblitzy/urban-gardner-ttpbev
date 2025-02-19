//
// ScheduleCell.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit // iOS 14.0+

/// A thread-safe, accessible UITableViewCell for displaying garden maintenance schedule items
/// with responsive layout and dynamic styling support.
@MainActor
final class ScheduleCell: UITableViewCell {
    
    // MARK: - UI Components
    
    private let taskTypeLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 1
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let dueDateLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 1
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let statusLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .caption1)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 1
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let taskIconImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .systemGreen
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    private let contentStackView: UIStackView = {
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 4
        stackView.alignment = .leading
        stackView.translatesAutoresizingMaskIntoConstraints = false
        return stackView
    }()
    
    // MARK: - Properties
    
    private var schedule: Schedule?
    private var stackViewLeadingConstraint: NSLayoutConstraint!
    private var stackViewTrailingConstraint: NSLayoutConstraint!
    
    private lazy var dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
    
    // MARK: - Initialization
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Configure content view
        contentView.backgroundColor = .systemBackground
        
        // Add subviews to hierarchy
        contentStackView.addArrangedSubview(taskTypeLabel)
        contentStackView.addArrangedSubview(dueDateLabel)
        contentStackView.addArrangedSubview(statusLabel)
        
        contentView.addSubview(taskIconImageView)
        contentView.addSubview(contentStackView)
        
        // Setup constraints
        stackViewLeadingConstraint = contentStackView.leadingAnchor.constraint(equalTo: taskIconImageView.trailingAnchor, constant: 12)
        stackViewTrailingConstraint = contentStackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16)
        
        NSLayoutConstraint.activate([
            taskIconImageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            taskIconImageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            taskIconImageView.widthAnchor.constraint(equalToConstant: 24),
            taskIconImageView.heightAnchor.constraint(equalToConstant: 24),
            
            stackViewLeadingConstraint,
            stackViewTrailingConstraint,
            contentStackView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
            contentStackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -12)
        ])
        
        // Apply styling
        roundCorners(radius: 8)
        addShadow(opacity: 0.1, radius: 4)
        
        // Configure accessibility
        isAccessibilityElement = true
        accessibilityTraits = .button
        
        // Optimize layer rendering
        layer.shouldRasterize = true
        layer.rasterizationScale = UIScreen.main.scale
    }
    
    // MARK: - Configuration
    
    /// Configures the cell with schedule data
    /// - Parameter schedule: The Schedule instance to display
    public func configure(with schedule: Schedule) {
        self.schedule = schedule
        
        // Configure task type
        taskTypeLabel.text = schedule.taskType
        
        // Configure due date
        dueDateLabel.text = dateFormatter.string(from: schedule.dueDate)
        
        // Configure status
        let isOverdue = schedule.isOverdue()
        statusLabel.text = schedule.isCompleted ? "Completed" : (isOverdue ? "Overdue" : "Pending")
        statusLabel.textColor = schedule.isCompleted ? .systemGreen : (isOverdue ? .systemRed : .systemOrange)
        
        // Configure task icon
        let iconName = schedule.isCompleted ? "checkmark.circle.fill" : "circle"
        if #available(iOS 13.0, *) {
            taskIconImageView.image = UIImage(systemName: iconName)
        }
        taskIconImageView.tintColor = statusLabel.textColor
        
        // Update styling based on completion status
        contentView.alpha = schedule.isCompleted ? 0.8 : 1.0
        
        // Configure accessibility label
        let statusText = schedule.isCompleted ? "Completed" : (isOverdue ? "Overdue" : "Pending")
        accessibilityLabel = "\(schedule.taskType), due \(dateFormatter.string(from: schedule.dueDate)), \(statusText)"
    }
    
    // MARK: - Reuse
    
    override func prepareForReuse() {
        super.prepareForReuse()
        
        schedule = nil
        taskTypeLabel.text = nil
        dueDateLabel.text = nil
        statusLabel.text = nil
        taskIconImageView.image = nil
        
        contentView.alpha = 1.0
        accessibilityLabel = nil
        
        // Reset layer properties
        layer.shadowPath = nil
        layer.shouldRasterize = false
    }
    
    // MARK: - Trait Collection
    
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            // Update shadow for current appearance
            addShadow(opacity: 0.1, radius: 4)
        }
        
        if traitCollection.preferredContentSizeCategory != previousTraitCollection?.preferredContentSizeCategory {
            // Update constraints for new content size
            let spacing = traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? 20 : 12
            stackViewLeadingConstraint.constant = CGFloat(spacing)
        }
    }
}