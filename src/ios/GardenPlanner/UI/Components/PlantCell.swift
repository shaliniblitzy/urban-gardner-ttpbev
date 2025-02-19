//
// PlantCell.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit

/// A reusable, accessible, and performance-optimized cell component for displaying plant information
@IBDesignable
public class PlantCell: UITableViewCell {
    
    // MARK: - UI Components
    
    private let typeLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let growthStageLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.textColor = .secondaryLabel
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let plantImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    private let careIndicatorStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 8
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    private let wateringIndicator: UIImageView = {
        let imageView = UIImageView(image: UIImage(systemName: "drop.fill"))
        imageView.tintColor = .systemBlue
        imageView.isHidden = true
        return imageView
    }()
    
    private let fertilizingIndicator: UIImageView = {
        let imageView = UIImageView(image: UIImage(systemName: "leaf.fill"))
        imageView.tintColor = .systemGreen
        imageView.isHidden = true
        return imageView
    }()
    
    // MARK: - Properties
    
    private weak var plant: Plant?
    private let imageCache = NSCache<NSString, UIImage>()
    private var animationDisplayLink: CADisplayLink?
    private var isAnimating = false
    
    // MARK: - Initialization
    
    override init(style: UITableViewCell.Style, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
        setupAccessibility()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
        setupAccessibility()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Add content stack
        let contentStack = UIStackView()
        contentStack.axis = .horizontal
        contentStack.spacing = 12
        contentStack.alignment = .center
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        
        // Add label stack
        let labelStack = UIStackView(arrangedSubviews: [typeLabel, growthStageLabel])
        labelStack.axis = .vertical
        labelStack.spacing = 4
        
        // Configure care indicators
        careIndicatorStack.addArrangedSubview(wateringIndicator)
        careIndicatorStack.addArrangedSubview(fertilizingIndicator)
        
        // Add all components to content stack
        contentStack.addArrangedSubview(plantImageView)
        contentStack.addArrangedSubview(labelStack)
        contentStack.addArrangedSubview(careIndicatorStack)
        
        // Add content stack to cell
        contentView.addSubview(contentStack)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            contentStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            contentStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            contentStack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            contentStack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            
            plantImageView.widthAnchor.constraint(equalToConstant: 60),
            plantImageView.heightAnchor.constraint(equalToConstant: 60),
            
            wateringIndicator.widthAnchor.constraint(equalToConstant: 24),
            wateringIndicator.heightAnchor.constraint(equalToConstant: 24),
            
            fertilizingIndicator.widthAnchor.constraint(equalToConstant: 24),
            fertilizingIndicator.heightAnchor.constraint(equalToConstant: 24)
        ])
        
        // Support RTL languages
        contentStack.semanticContentAttribute = .forceLeftToRight
    }
    
    private func setupAccessibility() {
        isAccessibilityElement = true
        accessibilityTraits = .button
        
        // Make indicators accessible individually
        wateringIndicator.isAccessibilityElement = true
        wateringIndicator.accessibilityLabel = NSLocalizedString("Needs watering", comment: "Accessibility label for watering indicator")
        
        fertilizingIndicator.isAccessibilityElement = true
        fertilizingIndicator.accessibilityLabel = NSLocalizedString("Needs fertilizing", comment: "Accessibility label for fertilizing indicator")
    }
    
    // MARK: - Configuration
    
    /// Configures the cell with plant data
    /// - Parameter plant: The plant model to display
    public func configure(with plant: Plant) {
        self.plant = plant
        
        // Update labels
        typeLabel.text = plant.type
        growthStageLabel.text = plant.growthStage
        
        // Load plant image
        loadPlantImage()
        
        // Update care indicators
        updateCareIndicators()
        
        // Update accessibility
        updateAccessibilityLabel()
    }
    
    private func loadPlantImage() {
        guard let plant = plant else { return }
        
        // Check cache first
        let cacheKey = NSString(string: "plant_\(plant.id)")
        if let cachedImage = imageCache.object(forKey: cacheKey) {
            plantImageView.image = cachedImage
            return
        }
        
        // Load image asynchronously
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            // Simulated image loading - replace with actual image loading logic
            let plantImage = UIImage(systemName: "leaf.circle.fill")
            
            DispatchQueue.main.async {
                guard let self = self, self.plant?.id == plant.id else { return }
                self.plantImageView.image = plantImage
                if let plantImage = plantImage {
                    self.imageCache.setObject(plantImage, forKey: cacheKey)
                }
            }
        }
    }
    
    private func updateCareIndicators() {
        guard let plant = plant else { return }
        
        // Check care status on background queue
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let needsWater = plant.needsWatering()
            let needsFertilizer = plant.needsFertilizing()
            
            DispatchQueue.main.async {
                guard let self = self else { return }
                
                // Animate indicators
                UIView.animate(withDuration: 0.3) {
                    self.wateringIndicator.isHidden = !needsWater
                    self.fertilizingIndicator.isHidden = !needsFertilizer
                }
                
                // Update accessibility
                self.updateAccessibilityLabel()
            }
        }
    }
    
    private func updateAccessibilityLabel() {
        guard let plant = plant else { return }
        
        let careNeeds = [
            plant.needsWatering() ? NSLocalizedString("needs watering", comment: "") : nil,
            plant.needsFertilizing() ? NSLocalizedString("needs fertilizing", comment: "") : nil
        ].compactMap { $0 }
        
        let careNeedsString = careNeeds.isEmpty ? 
            NSLocalizedString("no immediate care needed", comment: "") :
            careNeeds.joined(separator: ", ")
        
        accessibilityLabel = String(
            format: NSLocalizedString("%@, growth stage %@, %@", comment: "Accessibility label format"),
            plant.type,
            plant.growthStage,
            careNeedsString
        )
    }
    
    // MARK: - Reuse
    
    override public func prepareForReuse() {
        super.prepareForReuse()
        
        // Reset UI state
        plant = nil
        typeLabel.text = nil
        growthStageLabel.text = nil
        plantImageView.image = nil
        wateringIndicator.isHidden = true
        fertilizingIndicator.isHidden = true
        
        // Cancel any ongoing animations
        animationDisplayLink?.invalidate()
        animationDisplayLink = nil
        isAnimating = false
        
        // Reset accessibility
        accessibilityLabel = nil
        
        // Clear image cache if memory is constrained
        if UIApplication.shared.applicationState == .background {
            imageCache.removeAllObjects()
        }
    }
    
    // MARK: - Memory Management
    
    deinit {
        animationDisplayLink?.invalidate()
    }
}