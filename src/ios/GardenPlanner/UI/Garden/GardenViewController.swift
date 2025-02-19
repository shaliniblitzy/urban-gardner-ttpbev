//
// GardenViewController.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit
import Combine // iOS 14.0+

/// Thread-safe view controller implementing garden setup and management with comprehensive
/// performance monitoring and error recovery capabilities.
@available(iOS 14.0, *)
@MainActor
public class GardenViewController: BaseViewController<GardenViewModel> {
    
    // MARK: - UI Components
    
    private let areaTextField: UITextField = {
        let textField = UITextField()
        textField.placeholder = "Garden area (sq ft)"
        textField.keyboardType = .decimalPad
        textField.borderStyle = .roundedRect
        textField.accessibilityIdentifier = "AreaTextField"
        return textField
    }()
    
    private let sunlightControl: UISegmentedControl = {
        let items = ["Full Sun", "Partial Shade", "Full Shade"]
        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = 0
        control.accessibilityIdentifier = "SunlightControl"
        return control
    }()
    
    private let plantsTableView: UITableView = {
        let tableView = UITableView()
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "PlantCell")
        tableView.accessibilityIdentifier = "PlantsTableView"
        return tableView
    }()
    
    private let gardenGridView: GardenGridView
    
    private let optimizeButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Optimize Garden", for: .normal)
        button.accessibilityIdentifier = "OptimizeButton"
        return button
    }()
    
    private let loadingIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.hidesWhenStopped = true
        indicator.accessibilityIdentifier = "LoadingIndicator"
        return indicator
    }()
    
    // MARK: - Properties
    
    private var cancellables = Set<AnyCancellable>()
    private let performanceMonitor = PerformanceMonitor()
    private let inputValidator = PassthroughSubject<Double, Never>()
    private var currentGarden: Garden?
    
    // MARK: - Initialization
    
    public init(viewModel: GardenViewModel) {
        // Initialize garden grid view with empty garden
        let emptyGarden = Garden(id: UUID().uuidString, area: 0, zones: [], plants: [])
        self.gardenGridView = GardenGridView(garden: emptyGarden, isInteractive: true)
        
        super.init(viewModel: viewModel)
        
        // Configure performance monitoring
        performanceMonitor.configure(
            subsystem: "com.gardenplanner.viewcontroller",
            category: "garden_setup"
        )
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        
        performanceMonitor.begin(operation: "view_setup")
        
        setupUI()
        setupConstraints()
        setupBindings()
        setupAccessibility()
        
        performanceMonitor.end(operation: "view_setup")
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        title = "Garden Setup"
        
        [areaTextField, sunlightControl, plantsTableView, 
         gardenGridView, optimizeButton, loadingIndicator].forEach {
            view.addSubview($0)
            $0.translatesAutoresizingMaskIntoConstraints = false
        }
        
        optimizeButton.addTarget(self, action: #selector(handleOptimizeButtonTap), for: .touchUpInside)
        
        // Configure input validation
        areaTextField.delegate = self
        areaTextField.addTarget(self, action: #selector(textFieldDidChange(_:)), 
                              for: .editingChanged)
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            areaTextField.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            areaTextField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            areaTextField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            sunlightControl.topAnchor.constraint(equalTo: areaTextField.bottomAnchor, constant: 20),
            sunlightControl.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            sunlightControl.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            plantsTableView.topAnchor.constraint(equalTo: sunlightControl.bottomAnchor, constant: 20),
            plantsTableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            plantsTableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            plantsTableView.heightAnchor.constraint(equalToConstant: 200),
            
            gardenGridView.topAnchor.constraint(equalTo: plantsTableView.bottomAnchor, constant: 20),
            gardenGridView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            gardenGridView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            gardenGridView.heightAnchor.constraint(equalTo: gardenGridView.widthAnchor),
            
            optimizeButton.topAnchor.constraint(equalTo: gardenGridView.bottomAnchor, constant: 20),
            optimizeButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
    
    private func setupBindings() {
        // Input validation binding
        inputValidator
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] area in
                self?.validateGardenArea(area)
            }
            .store(in: &cancellables)
        
        // View model output bindings
        let input = GardenViewModel.Input(
            createGarden: PassthroughSubject<(area: Double, zones: [Zone], plants: [Plant]), Never>().eraseToAnyPublisher(),
            optimizeGarden: PassthroughSubject<Garden, Never>().eraseToAnyPublisher(),
            validateGarden: PassthroughSubject<Garden, Never>().eraseToAnyPublisher(),
            updateProgress: PassthroughSubject<Double, Never>().eraseToAnyPublisher()
        )
        
        let output = viewModel.transform(input)
        
        output.garden
            .receive(on: DispatchQueue.main)
            .sink { [weak self] garden in
                if let garden = garden {
                    self?.updateGardenDisplay(garden)
                }
            }
            .store(in: &cancellables)
        
        output.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        output.error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
        
        output.validationState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleValidationState(state)
            }
            .store(in: &cancellables)
    }
    
    private func setupAccessibility() {
        areaTextField.accessibilityLabel = "Garden area input"
        areaTextField.accessibilityHint = "Enter garden area between 1 and 1000 square feet"
        
        sunlightControl.accessibilityLabel = "Sunlight condition selector"
        sunlightControl.accessibilityHint = "Select the amount of sunlight your garden receives"
        
        optimizeButton.accessibilityLabel = "Optimize garden layout"
        optimizeButton.accessibilityHint = "Calculate optimal plant placement"
        
        view.accessibilityElements = [areaTextField, sunlightControl, 
                                    plantsTableView, gardenGridView, 
                                    optimizeButton]
    }
    
    // MARK: - Event Handlers
    
    @objc private func handleOptimizeButtonTap() {
        performanceMonitor.begin(operation: "garden_optimization")
        
        guard let garden = currentGarden else {
            handleError(GardenViewModel.GardenError.invalidInput("No garden configured"))
            return
        }
        
        loadingIndicator.startAnimating()
        optimizeButton.isEnabled = false
        
        let optimizationTimeout = DispatchWorkItem {
            self.handleError(GardenViewModel.GardenError.optimizationFailed("Optimization timed out"))
            self.loadingIndicator.stopAnimating()
            self.optimizeButton.isEnabled = true
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0, execute: optimizationTimeout)
        
        viewModel.transform(GardenViewModel.Input(
            createGarden: Empty().eraseToAnyPublisher(),
            optimizeGarden: Just(garden).eraseToAnyPublisher(),
            validateGarden: Empty().eraseToAnyPublisher(),
            updateProgress: Empty().eraseToAnyPublisher()
        ))
        
        performanceMonitor.end(operation: "garden_optimization")
    }
    
    @objc private func textFieldDidChange(_ textField: UITextField) {
        guard let text = textField.text,
              let area = Double(text) else {
            return
        }
        
        inputValidator.send(area)
    }
    
    // MARK: - Private Methods
    
    private func validateGardenArea(_ area: Double) {
        guard area >= GardenValidation.minArea && 
              area <= GardenValidation.maxArea else {
            handleError(GardenViewModel.GardenError.invalidInput(
                "Garden area must be between \(GardenValidation.minArea) and \(GardenValidation.maxArea) sq ft"
            ))
            return
        }
        
        // Trigger garden validation
        if let garden = currentGarden {
            viewModel.transform(GardenViewModel.Input(
                createGarden: Empty().eraseToAnyPublisher(),
                optimizeGarden: Empty().eraseToAnyPublisher(),
                validateGarden: Just(garden).eraseToAnyPublisher(),
                updateProgress: Empty().eraseToAnyPublisher()
            ))
        }
    }
    
    private func updateGardenDisplay(_ garden: Garden) {
        currentGarden = garden
        gardenGridView.updateLayout()
        
        // Update optimization button state
        optimizeButton.isEnabled = !garden.isOptimized
        
        // Log performance metrics
        performanceMonitor.record(metrics: [
            "plant_count": Double(garden.plants.count),
            "space_utilization": garden.calculateSpaceUtilization()
        ])
    }
    
    private func updateLoadingState(_ isLoading: Bool) {
        if isLoading {
            loadingIndicator.startAnimating()
            view.isUserInteractionEnabled = false
        } else {
            loadingIndicator.stopAnimating()
            view.isUserInteractionEnabled = true
        }
    }
    
    private func handleValidationState(_ state: GardenViewModel.ValidationState) {
        switch state {
        case .valid:
            areaTextField.layer.borderColor = UIColor.systemGreen.cgColor
        case .invalid(let message):
            areaTextField.layer.borderColor = UIColor.systemRed.cgColor
            handleError(GardenViewModel.GardenError.validationFailed(message))
        default:
            break
        }
    }
}

// MARK: - UITextFieldDelegate

extension GardenViewController: UITextFieldDelegate {
    public func textField(_ textField: UITextField, 
                         shouldChangeCharactersIn range: NSRange,
                         replacementString string: String) -> Bool {
        // Allow only numeric input with decimal point
        let allowedCharacters = CharacterSet(charactersIn: "0123456789.")
        let characterSet = CharacterSet(charactersIn: string)
        return allowedCharacters.isSuperset(of: characterSet)
    }
}