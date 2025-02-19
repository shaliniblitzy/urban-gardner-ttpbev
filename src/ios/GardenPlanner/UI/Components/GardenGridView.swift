//
// GardenGridView.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit // iOS 14.0+

/// A thread-safe, performance-optimized UIView subclass that renders an interactive grid visualization
/// of the garden layout with comprehensive accessibility support.
@IBDesignable
public class GardenGridView: UIView {
    
    // MARK: - Constants
    
    private struct GridConstants {
        static let cellSize: CGFloat = 50.0
        static let minSpacing: CGFloat = 5.0
        static let maxCellCount: Int = 1000
        static let cacheSize: Int = 100
        static let animationDuration: TimeInterval = 0.3
        static let cornerRadius: CGFloat = 8.0
    }
    
    private enum GridErrors: Error {
        case invalidLayout
        case outOfBounds
        case concurrencyError
        case memoryWarning
    }
    
    // MARK: - Properties
    
    private let gardenLock = NSLock()
    private let imageCache = NSCache<NSString, UIImage>()
    private var gridScale: CGFloat = 1.0
    private var isInteractive: Bool
    private var garden: Garden
    private var gridCollectionView: UICollectionView!
    private var accessibilityContainer: UIAccessibilityElement!
    private var lastContentOffset: CGPoint = .zero
    private var isDragging: Bool = false
    
    // MARK: - Initialization
    
    /// Creates a new GardenGridView with the specified garden and interaction mode
    /// - Parameters:
    ///   - garden: The garden model to visualize
    ///   - isInteractive: Whether the grid supports drag-and-drop interactions
    public init(garden: Garden, isInteractive: Bool) {
        self.garden = garden
        self.isInteractive = isInteractive
        
        super.init(frame: .zero)
        
        // Configure image cache
        imageCache.name = "com.gardenplanner.gridview.imageCache"
        imageCache.countLimit = GridConstants.cacheSize
        
        setupCollectionView()
        setupAccessibility()
        
        if isInteractive {
            setupGestureRecognizers()
        }
        
        // Enable state restoration
        self.restorationIdentifier = "GardenGridView"
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Setup Methods
    
    private func setupCollectionView() {
        let layout = createGridLayout()
        gridCollectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        gridCollectionView.backgroundColor = .clear
        gridCollectionView.delegate = self
        gridCollectionView.dataSource = self
        gridCollectionView.prefetchDataSource = self
        gridCollectionView.isPrefetchingEnabled = true
        
        // Register cell types
        gridCollectionView.register(GridCell.self, forCellWithReuseIdentifier: "GridCell")
        
        // Add collection view to view hierarchy
        addSubview(gridCollectionView)
        gridCollectionView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            gridCollectionView.topAnchor.constraint(equalTo: topAnchor),
            gridCollectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
            gridCollectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
            gridCollectionView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }
    
    private func createGridLayout() -> UICollectionViewFlowLayout {
        let layout = UICollectionViewFlowLayout()
        layout.minimumInteritemSpacing = GridConstants.minSpacing
        layout.minimumLineSpacing = GridConstants.minSpacing
        layout.itemSize = CGSize(width: GridConstants.cellSize, height: GridConstants.cellSize)
        layout.scrollDirection = .vertical
        return layout
    }
    
    private func setupAccessibility() {
        accessibilityContainer = UIAccessibilityElement(accessibilityContainer: self)
        accessibilityContainer.accessibilityLabel = "Garden Grid"
        accessibilityContainer.accessibilityHint = "Displays garden layout with plants and zones"
        accessibilityContainer.accessibilityTraits = .updatesFrequently
        
        isAccessibilityElement = false
        shouldGroupAccessibilityChildren = true
        accessibilityElements = [accessibilityContainer]
    }
    
    private func setupGestureRecognizers() {
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePlantDrag(_:)))
        panGesture.delegate = self
        addGestureRecognizer(panGesture)
    }
    
    // MARK: - Layout Methods
    
    private func calculateGridScale() -> Result<CGFloat, GridErrors> {
        gardenLock.lock()
        defer { gardenLock.unlock() }
        
        guard garden.area > 0 else {
            return .failure(.invalidLayout)
        }
        
        let availableWidth = bounds.width - (2 * GridConstants.minSpacing)
        let availableHeight = bounds.height - (2 * GridConstants.minSpacing)
        
        // Calculate optimal cell size based on garden dimensions
        let sqrtArea = sqrt(garden.area)
        let widthScale = availableWidth / (sqrtArea * GridConstants.cellSize)
        let heightScale = availableHeight / (sqrtArea * GridConstants.cellSize)
        
        let scale = min(widthScale, heightScale)
        
        guard scale > 0 else {
            return .failure(.invalidLayout)
        }
        
        return .success(scale)
    }
    
    public func updateLayout() {
        gardenLock.lock()
        
        // Calculate new grid scale
        if case .success(let newScale) = calculateGridScale() {
            gridScale = newScale
        }
        
        // Prepare batch updates
        gridCollectionView.performBatchUpdates({
            let indexPaths = (0..<garden.plants.count).map { IndexPath(item: $0, section: 0) }
            gridCollectionView.reloadItems(at: indexPaths)
        }, completion: { _ in
            self.updateAccessibilityLayout()
            self.gardenLock.unlock()
        })
    }
    
    private func updateAccessibilityLayout() {
        var elements: [UIAccessibilityElement] = []
        
        for (index, plant) in garden.plants.enumerated() {
            let element = UIAccessibilityElement(accessibilityContainer: self)
            element.accessibilityLabel = "\(plant.type) plant"
            element.accessibilityHint = "In \(plant.growthStage) stage"
            
            if let cell = gridCollectionView.cellForItem(at: IndexPath(item: index, section: 0)) {
                element.accessibilityFrame = convert(cell.frame, to: nil)
            }
            
            elements.append(element)
        }
        
        accessibilityElements = elements
    }
    
    // MARK: - Interaction Handling
    
    @objc private func handlePlantDrag(_ gesture: UIPanGestureRecognizer) {
        guard isInteractive else { return }
        
        let location = gesture.location(in: gridCollectionView)
        
        switch gesture.state {
        case .began:
            if let indexPath = gridCollectionView.indexPathForItem(at: location) {
                isDragging = true
                lastContentOffset = location
                gridCollectionView.beginInteractiveMovementForItem(at: indexPath)
            }
            
        case .changed:
            guard isDragging else { return }
            gridCollectionView.updateInteractiveMovementTargetPosition(location)
            
        case .ended:
            guard isDragging else { return }
            isDragging = false
            gridCollectionView.endInteractiveMovement()
            updateAccessibilityLayout()
            
        case .cancelled:
            guard isDragging else { return }
            isDragging = false
            gridCollectionView.cancelInteractiveMovement()
            
        default:
            break
        }
    }
}

// MARK: - UICollectionViewDataSource

extension GardenGridView: UICollectionViewDataSource {
    public func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        gardenLock.lock()
        defer { gardenLock.unlock() }
        return garden.plants.count
    }
    
    public func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        guard let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "GridCell", for: indexPath) as? GridCell else {
            fatalError("Unable to dequeue GridCell")
        }
        
        gardenLock.lock()
        let plant = garden.plants[indexPath.item]
        gardenLock.unlock()
        
        cell.configure(with: plant, scale: gridScale)
        return cell
    }
}

// MARK: - UICollectionViewDataSourcePrefetching

extension GardenGridView: UICollectionViewDataSourcePrefetching {
    public func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
        // Prefetch plant images and cache them
        gardenLock.lock()
        for indexPath in indexPaths {
            let plant = garden.plants[indexPath.item]
            let cacheKey = "plant_\(plant.id)" as NSString
            if imageCache.object(forKey: cacheKey) == nil {
                // Async image generation would go here
            }
        }
        gardenLock.unlock()
    }
}

// MARK: - UICollectionViewDelegate

extension GardenGridView: UICollectionViewDelegate {
    public func collectionView(_ collectionView: UICollectionView, canMoveItemAt indexPath: IndexPath) -> Bool {
        return isInteractive
    }
    
    public func collectionView(_ collectionView: UICollectionView, moveItemAt sourceIndexPath: IndexPath, to destinationIndexPath: IndexPath) {
        gardenLock.lock()
        let plant = garden.plants[sourceIndexPath.item]
        garden.plants.remove(at: sourceIndexPath.item)
        garden.plants.insert(plant, at: destinationIndexPath.item)
        gardenLock.unlock()
        
        updateAccessibilityLayout()
    }
}

// MARK: - UIGestureRecognizerDelegate

extension GardenGridView: UIGestureRecognizerDelegate {
    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        return isInteractive
    }
}

// MARK: - GridCell

private class GridCell: UICollectionViewCell {
    private let plantImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.layer.cornerRadius = GridConstants.cornerRadius
        imageView.clipsToBounds = true
        return imageView
    }()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupCell()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupCell() {
        contentView.addSubview(plantImageView)
        plantImageView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            plantImageView.topAnchor.constraint(equalTo: contentView.topAnchor),
            plantImageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            plantImageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            plantImageView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])
    }
    
    func configure(with plant: Plant, scale: CGFloat) {
        // Apply plant visualization with proper scaling
        let size = GridConstants.cellSize * scale
        plantImageView.frame = CGRect(x: 0, y: 0, width: size, height: size)
        
        // Set background color based on growth stage
        switch plant.growthStage {
        case "seedling":
            backgroundColor = .systemGreen.withAlphaComponent(0.3)
        case "vegetative":
            backgroundColor = .systemGreen.withAlphaComponent(0.5)
        case "flowering":
            backgroundColor = .systemYellow.withAlphaComponent(0.3)
        case "fruiting":
            backgroundColor = .systemRed.withAlphaComponent(0.3)
        case "mature":
            backgroundColor = .systemBrown.withAlphaComponent(0.3)
        default:
            backgroundColor = .clear
        }
    }
}