//
// ScheduleViewController.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit
import Combine // iOS 14.0+

/// A thread-safe view controller managing garden maintenance schedules with performance optimization
/// and comprehensive error handling.
@available(iOS 14.0, *)
final class ScheduleViewController: BaseViewController<ScheduleViewModel> {
    
    // MARK: - UI Components
    
    private lazy var tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .insetGrouped)
        table.translatesAutoresizingMaskIntoConstraints = false
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 88
        table.separatorStyle = .none
        table.backgroundColor = .systemBackground
        return table
    }()
    
    private lazy var filterControl: UISegmentedControl = {
        let control = UISegmentedControl(items: ["All", "Pending", "Completed"])
        control.translatesAutoresizingMaskIntoConstraints = false
        control.selectedSegmentIndex = 0
        control.addTarget(self, action: #selector(filterChanged), for: .valueChanged)
        return control
    }()
    
    private lazy var notificationPreferencesButton: UIButton = {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        let image = UIImage(systemName: "bell.fill")
        button.setImage(image, for: .normal)
        button.addTarget(self, action: #selector(showNotificationPreferences), for: .touchUpInside)
        return button
    }()
    
    private lazy var emptyStateView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        
        let imageView = UIImageView(image: UIImage(systemName: "calendar.badge.clock"))
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.tintColor = .systemGray3
        imageView.contentMode = .scaleAspectFit
        
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = "No maintenance tasks scheduled"
        label.textAlignment = .center
        label.font = .preferredFont(forTextStyle: .body)
        label.textColor = .systemGray
        label.numberOfLines = 0
        
        view.addSubview(imageView)
        view.addSubview(label)
        
        NSLayoutConstraint.activate([
            imageView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            imageView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),
            imageView.widthAnchor.constraint(equalToConstant: 60),
            imageView.heightAnchor.constraint(equalToConstant: 60),
            
            label.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 16),
            label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)
        ])
        
        return view
    }()
    
    // MARK: - Properties
    
    private var cancellables = Set<AnyCancellable>()
    private let tableLock = NSLock()
    private let notificationQueue = DispatchQueue(label: "com.gardenplanner.schedule.notifications", qos: .userInitiated)
    private let performanceMonitor = PerformanceMonitor()
    private var currentSchedules: [Schedule] = []
    private var filteredSchedules: [Schedule] = []
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupTableView()
        setupBindings()
        setupPerformanceMonitoring()
        
        // Initial data load
        viewModel.transform(makeInput()).schedules
            .receive(on: DispatchQueue.main)
            .sink { [weak self] schedules in
                self?.updateSchedules(schedules)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        title = "Maintenance Schedule"
        view.backgroundColor = .systemBackground
        
        // Add subviews
        view.addSubview(filterControl)
        view.addSubview(tableView)
        view.addSubview(emptyStateView)
        
        // Setup navigation items
        navigationItem.rightBarButtonItem = UIBarButtonItem(customView: notificationPreferencesButton)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            filterControl.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            filterControl.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            filterControl.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            
            tableView.topAnchor.constraint(equalTo: filterControl.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            
            emptyStateView.centerXAnchor.constraint(equalTo: tableView.centerXAnchor),
            emptyStateView.centerYAnchor.constraint(equalTo: tableView.centerYAnchor),
            emptyStateView.widthAnchor.constraint(equalTo: tableView.widthAnchor),
            emptyStateView.heightAnchor.constraint(equalToConstant: 200)
        ])
    }
    
    private func setupTableView() {
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(ScheduleCell.self, forCellReuseIdentifier: "ScheduleCell")
        
        // Enable prefetching for performance
        tableView.prefetchDataSource = self
        
        // Configure refresh control
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(self, action: #selector(refreshSchedules), for: .valueChanged)
        tableView.refreshControl = refreshControl
    }
    
    private func setupBindings() {
        // Handle loading state
        viewModel.transform(makeInput()).isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        // Handle errors
        viewModel.transform(makeInput()).error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
    }
    
    private func setupPerformanceMonitoring() {
        performanceMonitor.setThreshold("table_update", threshold: 0.1)
        performanceMonitor.setThreshold("filter_update", threshold: 0.05)
        
        performanceMonitor.onThresholdExceeded = { [weak self] (metric, value, threshold) in
            self?.handlePerformanceWarning(metric: metric, value: value, threshold: threshold)
        }
    }
    
    // MARK: - Data Management
    
    private func updateSchedules(_ schedules: [Schedule]) {
        let startTime = Date()
        
        tableLock.lock()
        defer { tableLock.unlock() }
        
        currentSchedules = schedules
        applyCurrentFilter()
        
        performanceMonitor.logMetric("table_update", Date().timeIntervalSince(startTime))
        
        DispatchQueue.main.async { [weak self] in
            self?.tableView.reloadData()
            self?.updateEmptyState()
        }
    }
    
    private func applyCurrentFilter() {
        let startTime = Date()
        
        switch filterControl.selectedSegmentIndex {
        case 0: // All
            filteredSchedules = currentSchedules
        case 1: // Pending
            filteredSchedules = currentSchedules.filter { !$0.isCompleted }
        case 2: // Completed
            filteredSchedules = currentSchedules.filter { $0.isCompleted }
        default:
            filteredSchedules = currentSchedules
        }
        
        performanceMonitor.logMetric("filter_update", Date().timeIntervalSince(startTime))
    }
    
    private func updateEmptyState() {
        emptyStateView.isHidden = !filteredSchedules.isEmpty
    }
    
    // MARK: - Actions
    
    @objc private func filterChanged() {
        applyCurrentFilter()
        tableView.reloadData()
        updateEmptyState()
    }
    
    @objc private func refreshSchedules() {
        viewModel.transform(makeInput())
        tableView.refreshControl?.endRefreshing()
    }
    
    @objc private func showNotificationPreferences() {
        notificationQueue.async { [weak self] in
            NotificationManager.shared.requestAuthorization { authorized, error in
                if let error = error {
                    DispatchQueue.main.async {
                        self?.handleError(error)
                    }
                    return
                }
                
                if authorized {
                    DispatchQueue.main.async {
                        self?.presentNotificationPreferences()
                    }
                } else {
                    DispatchQueue.main.async {
                        self?.showNotificationSettings()
                    }
                }
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func makeInput() -> ScheduleViewModel.Input {
        return ScheduleViewModel.Input(
            viewDidLoad: Just(()).eraseToAnyPublisher(),
            scheduleCompleted: NotificationCenter.default.publisher(for: NSNotification.Name("ScheduleCompletedNotification"))
                .compactMap { $0.object as? Schedule }
                .eraseToAnyPublisher(),
            notificationPreferencesUpdated: NotificationCenter.default.publisher(for: NSNotification.Name("SchedulePreferenceUpdatedNotification"))
                .compactMap { $0.object as? NotificationPreferences }
                .eraseToAnyPublisher()
        )
    }
    
    private func updateLoadingState(_ isLoading: Bool) {
        if isLoading {
            tableView.refreshControl?.beginRefreshing()
        } else {
            tableView.refreshControl?.endRefreshing()
        }
    }
    
    private func handleError(_ error: Error) {
        AlertManager.shared.showError(error, from: self)
    }
    
    private func handlePerformanceWarning(metric: String, value: TimeInterval, threshold: TimeInterval) {
        Logger.shared.error(GardenPlannerError.customError(
            .scheduleGenerationFailed,
            "Performance threshold exceeded for \(metric): \(value)s (threshold: \(threshold)s)"
        ))
    }
}

// MARK: - UITableViewDataSource

extension ScheduleViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return filteredSchedules.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: "ScheduleCell", for: indexPath) as? ScheduleCell else {
            return UITableViewCell()
        }
        
        tableLock.lock()
        defer { tableLock.unlock() }
        
        let schedule = filteredSchedules[indexPath.row]
        cell.configure(with: schedule)
        
        return cell
    }
}

// MARK: - UITableViewDelegate

extension ScheduleViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        tableLock.lock()
        let schedule = filteredSchedules[indexPath.row]
        tableLock.unlock()
        
        if !schedule.isCompleted {
            let alert = UIAlertController(
                title: "Complete Task?",
                message: "Mark this maintenance task as completed?",
                preferredStyle: .alert
            )
            
            alert.addAction(UIAlertAction(title: "Complete", style: .default) { [weak self] _ in
                self?.completeSchedule(schedule)
            })
            
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
            
            present(alert, animated: true)
        }
    }
}

// MARK: - UITableViewDataSourcePrefetching

extension ScheduleViewController: UITableViewDataSourcePrefetching {
    func tableView(_ tableView: UITableView, prefetchRowsAt indexPaths: [IndexPath]) {
        // Implement prefetching logic if needed
    }
    
    func tableView(_ tableView: UITableView, cancelPrefetchingForRowsAt indexPaths: [IndexPath]) {
        // Cancel any prefetching operations if needed
    }
}

// MARK: - Private Extensions

private extension ScheduleViewController {
    func completeSchedule(_ schedule: Schedule) {
        schedule.markAsCompleted()
        
        // Notify view model of completion
        NotificationCenter.default.post(
            name: NSNotification.Name("ScheduleCompletedNotification"),
            object: schedule
        )
    }
    
    func presentNotificationPreferences() {
        // Implementation for showing notification preferences UI
    }
    
    func showNotificationSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        
        if UIApplication.shared.canOpenURL(settingsUrl) {
            UIApplication.shared.open(settingsUrl)
        }
    }
}

// MARK: - Performance Monitoring

private final class PerformanceMonitor {
    private var thresholds: [String: TimeInterval] = [:]
    var onThresholdExceeded: ((String, TimeInterval, TimeInterval) -> Void)?
    
    func setThreshold(_ metric: String, threshold: TimeInterval) {
        thresholds[metric] = threshold
    }
    
    func logMetric(_ metric: String, _ value: TimeInterval) {
        if let threshold = thresholds[metric], value > threshold {
            onThresholdExceeded?(metric, value, threshold)
        }
    }
}