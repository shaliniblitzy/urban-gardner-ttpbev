//
// LayoutViewController.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit
import Combine // iOS 13.0+

/// A production-ready view controller for displaying and managing optimized garden layouts
/// with comprehensive error handling, accessibility support, and performance monitoring.
@available(iOS 14.0, *)
@MainActor
public class LayoutViewController: BaseViewController<LayoutViewModel> {
    
    // MARK: - UI Components
    
    private let gardenGridView: GardenGridView
    private let utilizationLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.adjustsFontForContentSizeCategory = true
        label.textAlignment = .center
        label.accessibilityTraits = .updatesFrequently
        return label
    }()
    
    private let regenerateButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Regenerate Layout", for: .normal)
        button.accessibilityLabel = "Regenerate garden layout"
        button.accessibilityHint = "Recalculates optimal plant placement"
        return button
    }()
    
    private let loadingIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.hidesWhenStopped = true
        return indicator
    }()
    
    // MARK: - Properties
    
    private var cancellables = Set<AnyCancellable>()
    private let performanceMonitor = PerformanceMonitor()
    private let errorHandler = ErrorRecoveryHandler()
    
    // MARK: - Initialization
    
    public init(viewModel: LayoutViewModel) {
        // Initialize garden grid view with view model's garden
        self.gardenGridView = GardenGridView(garden: viewModel.garden.value ?? Garden(id: UUID().uuidString, area: 0, zones: [], plants: []), isInteractive: true)
        
        super.init(viewModel: viewModel)
        
        setupViews()
        setupConstraints()
        setupAccessibility()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        
        view.backgroundColor = .systemBackground
        title = "Garden Layout"
        
        setupBindings()
        setupActions()
        
        // Start performance monitoring
        performanceMonitor.startTracking()
    }
    
    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // Announce layout for VoiceOver
        UIAccessibility.post(notification: .screenChanged,
                           argument: "Garden layout view loaded")
    }
    
    public override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        performanceMonitor.stopTracking()
    }
    
    // MARK: - Setup Methods
    
    private func setupViews() {
        [gardenGridView, utilizationLabel, regenerateButton, loadingIndicator].forEach {
            view.addSubview($0)
            $0.translatesAutoresizingMaskIntoConstraints = false
        }
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            gardenGridView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            gardenGridView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            gardenGridView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            gardenGridView.heightAnchor.constraint(equalTo: gardenGridView.widthAnchor),
            
            utilizationLabel.topAnchor.constraint(equalTo: gardenGridView.bottomAnchor, constant: 16),
            utilizationLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            utilizationLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            regenerateButton.topAnchor.constraint(equalTo: utilizationLabel.bottomAnchor, constant: 24),
            regenerateButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            regenerateButton.heightAnchor.constraint(equalToConstant: 44),
            
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
    
    private func setupAccessibility() {
        gardenGridView.accessibilityLabel = "Garden layout grid"
        gardenGridView.accessibilityHint = "Displays optimized plant placement"
        
        view.accessibilityElements = [gardenGridView, utilizationLabel, regenerateButton]
    }
    
    private func setupBindings() {
        // Bind garden updates
        viewModel.garden
            .receive(on: DispatchQueue.main)
            .sink { [weak self] garden in
                guard let self = self, let garden = garden else { return }
                self.gardenGridView.updateLayout()
                self.performanceMonitor.logEvent("Garden layout updated")
            }
            .store(in: &cancellables)
        
        // Bind utilization score
        viewModel.utilizationScore
            .receive(on: DispatchQueue.main)
            .sink { [weak self] score in
                self?.utilizationLabel.text = "Space Utilization: \(Int(score))%"
                UIAccessibility.post(notification: .announcement,
                                   argument: "Space utilization updated to \(Int(score)) percent")
            }
            .store(in: &cancellables)
        
        // Bind loading state
        viewModel.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        // Bind performance metrics
        viewModel.performanceMetrics
            .receive(on: DispatchQueue.main)
            .sink { [weak self] metrics in
                self?.performanceMonitor.logMetrics(metrics)
            }
            .store(in: &cancellables)
    }
    
    private func setupActions() {
        regenerateButton.addTarget(self,
                                 action: #selector(regenerateLayout),
                                 for: .touchUpInside)
    }
    
    // MARK: - Action Methods
    
    @objc private func regenerateLayout() {
        performanceMonitor.startOperation("layout_regeneration")
        
        viewModel.generateOptimizedLayout()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                guard let self = self else { return }
                
                self.performanceMonitor.endOperation("layout_regeneration")
                
                if case .failure(let error) = completion {
                    self.handleError(error)
                }
            } receiveValue: { [weak self] success in
                guard success else { return }
                
                self?.gardenGridView.updateLayout()
                UIAccessibility.post(notification: .announcement,
                                   argument: "Garden layout regenerated successfully")
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Private Methods
    
    private func updateLoadingState(_ isLoading: Bool) {
        if isLoading {
            loadingIndicator.startAnimating()
            regenerateButton.isEnabled = false
            view.isUserInteractionEnabled = false
        } else {
            loadingIndicator.stopAnimating()
            regenerateButton.isEnabled = true
            view.isUserInteractionEnabled = true
        }
    }
    
    // MARK: - Error Handling
    
    private func handleError(_ error: Error) {
        let errorMessage: String
        
        switch error {
        case LayoutViewModel.LayoutOptimizationError.invalidGarden:
            errorMessage = "Invalid garden configuration"
        case LayoutViewModel.LayoutOptimizationError.optimizationFailed:
            errorMessage = "Failed to optimize layout"
        case LayoutViewModel.LayoutOptimizationError.insufficientSpace:
            errorMessage = "Insufficient space for all plants"
        case LayoutViewModel.LayoutOptimizationError.lowUtilization:
            errorMessage = "Space utilization below target"
        case LayoutViewModel.LayoutOptimizationError.performanceThresholdExceeded:
            errorMessage = "Performance threshold exceeded"
        default:
            errorMessage = error.localizedDescription
        }
        
        super.handleError(GardenPlannerError.customError(.optimizationFailed, errorMessage))
    }
    
    // MARK: - Memory Management
    
    public override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        
        // Clear non-essential caches
        performanceMonitor.clearMetrics()
        cancellables.removeAll()
    }
}

// MARK: - PerformanceMonitor

private class PerformanceMonitor {
    private var operations: [String: CFAbsoluteTime] = [:]
    private var metrics: [String: Double] = [:]
    
    func startTracking() {
        metrics["viewLoadTime"] = CFAbsoluteTimeGetCurrent()
    }
    
    func stopTracking() {
        if let startTime = metrics["viewLoadTime"] {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            Logger.shared.debug("View controller lifetime: \(duration)s")
        }
    }
    
    func startOperation(_ name: String) {
        operations[name] = CFAbsoluteTimeGetCurrent()
    }
    
    func endOperation(_ name: String) {
        if let startTime = operations[name] {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            Logger.shared.debug("Operation \(name) completed in \(duration)s")
            operations.removeValue(forKey: name)
        }
    }
    
    func logEvent(_ event: String) {
        Logger.shared.debug("Event: \(event)")
    }
    
    func logMetrics(_ metrics: LayoutViewModel.LayoutOptimizationMetrics) {
        Logger.shared.debug("Performance metrics: \(metrics)")
    }
    
    func clearMetrics() {
        operations.removeAll()
        metrics.removeAll()
    }
}

// MARK: - ErrorRecoveryHandler

private class ErrorRecoveryHandler {
    func handleError(_ error: Error) -> AnyPublisher<Void, Error> {
        return Future { promise in
            // Implement error recovery logic
            if GardenPlannerError.shouldRetry(error) {
                promise(.success(()))
            } else {
                promise(.failure(error))
            }
        }.eraseToAnyPublisher()
    }
}