import UIKit
import Combine // iOS 14.0+

/// Thread-safe view controller that manages the settings screen interface with performance monitoring
/// and accessibility support for garden preferences and notification settings.
@available(iOS 14.0, *)
@MainActor
final class SettingsViewController: BaseViewController<SettingsViewModel> {
    
    // MARK: - UI Components
    
    private lazy var containerStackView: UIStackView = {
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 20
        stackView.distribution = .fill
        stackView.alignment = .fill
        stackView.translatesAutoresizingMaskIntoConstraints = false
        stackView.isAccessibilityElement = false
        stackView.shouldGroupAccessibilityChildren = true
        return stackView
    }()
    
    private lazy var notificationTypeSegmentControl: UISegmentedControl = {
        let items = ["Daily", "Weekly", "Custom"]
        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = 0
        control.accessibilityLabel = "Notification Frequency"
        control.accessibilityHint = "Select how often you want to receive notifications"
        return control
    }()
    
    private lazy var reminderTimePicker: UIDatePicker = {
        let picker = UIDatePicker()
        picker.datePickerMode = .time
        picker.preferredDatePickerStyle = .wheels
        picker.accessibilityLabel = "Reminder Time"
        picker.accessibilityHint = "Select the time of day for reminders"
        return picker
    }()
    
    private lazy var pushNotificationSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityLabel = "Push Notifications"
        toggle.accessibilityHint = "Enable or disable push notifications"
        return toggle
    }()
    
    private lazy var emailNotificationSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityLabel = "Email Notifications"
        toggle.accessibilityHint = "Enable or disable email notifications"
        return toggle
    }()
    
    private lazy var measurementUnitSegmentControl: UISegmentedControl = {
        let items = ["Imperial", "Metric"]
        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = 0
        control.accessibilityLabel = "Measurement Units"
        control.accessibilityHint = "Select your preferred measurement system"
        return control
    }()
    
    // MARK: - Properties
    
    private var cancellables = Set<AnyCancellable>()
    private let performanceMonitor = PerformanceMonitor(identifier: "SettingsViewController")
    
    // MARK: - Initialization
    
    init(viewModel: SettingsViewModel) {
        super.init(viewModel: viewModel)
        
        // Enable state restoration
        restorationIdentifier = "SettingsViewController"
        
        Logger.shared.debug("SettingsViewController initialized")
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        performanceMonitor.start()
        
        super.viewDidLoad()
        title = "Settings"
        
        setupUI()
        setupBindings()
        setupAccessibility()
        
        performanceMonitor.stop()
        Logger.shared.debug("SettingsViewController loaded in \(performanceMonitor.elapsedTime)s")
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Add container stack view
        view.addSubview(containerStackView)
        
        // Setup notification section
        let notificationSection = createSection(
            title: "Notifications",
            arrangedSubviews: [
                createLabeledControl(label: "Frequency", control: notificationTypeSegmentControl),
                createLabeledControl(label: "Reminder Time", control: reminderTimePicker),
                createLabeledControl(label: "Push Notifications", control: pushNotificationSwitch),
                createLabeledControl(label: "Email Notifications", control: emailNotificationSwitch)
            ]
        )
        
        // Setup measurement section
        let measurementSection = createSection(
            title: "Measurement Units",
            arrangedSubviews: [
                createLabeledControl(label: "Units", control: measurementUnitSegmentControl)
            ]
        )
        
        containerStackView.addArrangedSubview(notificationSection)
        containerStackView.addArrangedSubview(measurementSection)
        
        NSLayoutConstraint.activate([
            containerStackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            containerStackView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            containerStackView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            containerStackView.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20)
        ])
    }
    
    // MARK: - Bindings
    
    private func setupBindings() {
        // Bind notification type selection
        notificationTypeSegmentControl.publisher(for: .valueChanged)
            .map { [weak self] _ in
                NotificationPreference(rawValue: self?.notificationTypeSegmentControl.selectedSegmentIndex ?? 0) ?? .daily
            }
            .sink { [weak self] preference in
                self?.viewModel.transform(SettingsViewModel.Input(
                    updateNotificationPreference: Just(preference).eraseToAnyPublisher(),
                    updateNotificationTime: Empty().eraseToAnyPublisher(),
                    togglePushNotifications: Empty().eraseToAnyPublisher(),
                    toggleEmailNotifications: Empty().eraseToAnyPublisher(),
                    updateAreaUnit: Empty().eraseToAnyPublisher(),
                    updateWaterUnit: Empty().eraseToAnyPublisher(),
                    requestNotificationPermission: Empty().eraseToAnyPublisher()
                ))
            }
            .store(in: &cancellables)
        
        // Bind reminder time selection
        reminderTimePicker.publisher(for: .valueChanged)
            .map { [weak self] _ in
                let formatter = DateFormatter()
                formatter.dateFormat = "HH:mm"
                return formatter.string(from: self?.reminderTimePicker.date ?? Date())
            }
            .sink { [weak self] time in
                self?.viewModel.transform(SettingsViewModel.Input(
                    updateNotificationPreference: Empty().eraseToAnyPublisher(),
                    updateNotificationTime: Just(time).eraseToAnyPublisher(),
                    togglePushNotifications: Empty().eraseToAnyPublisher(),
                    toggleEmailNotifications: Empty().eraseToAnyPublisher(),
                    updateAreaUnit: Empty().eraseToAnyPublisher(),
                    updateWaterUnit: Empty().eraseToAnyPublisher(),
                    requestNotificationPermission: Empty().eraseToAnyPublisher()
                ))
            }
            .store(in: &cancellables)
        
        // Bind push notification toggle
        pushNotificationSwitch.publisher(for: .valueChanged)
            .sink { [weak self] isEnabled in
                if isEnabled {
                    self?.viewModel.transform(SettingsViewModel.Input(
                        updateNotificationPreference: Empty().eraseToAnyPublisher(),
                        updateNotificationTime: Empty().eraseToAnyPublisher(),
                        togglePushNotifications: Just(true).eraseToAnyPublisher(),
                        toggleEmailNotifications: Empty().eraseToAnyPublisher(),
                        updateAreaUnit: Empty().eraseToAnyPublisher(),
                        updateWaterUnit: Empty().eraseToAnyPublisher(),
                        requestNotificationPermission: Just(()).eraseToAnyPublisher()
                    ))
                }
            }
            .store(in: &cancellables)
        
        // Bind measurement unit selection
        measurementUnitSegmentControl.publisher(for: .valueChanged)
            .map { [weak self] _ in
                self?.measurementUnitSegmentControl.selectedSegmentIndex == 0 ? MeasurementUnit.squareFeet : .squareMeters
            }
            .sink { [weak self] unit in
                self?.viewModel.transform(SettingsViewModel.Input(
                    updateNotificationPreference: Empty().eraseToAnyPublisher(),
                    updateNotificationTime: Empty().eraseToAnyPublisher(),
                    togglePushNotifications: Empty().eraseToAnyPublisher(),
                    toggleEmailNotifications: Empty().eraseToAnyPublisher(),
                    updateAreaUnit: Just(unit).eraseToAnyPublisher(),
                    updateWaterUnit: Just(unit == .squareFeet ? .gallons : .liters).eraseToAnyPublisher(),
                    requestNotificationPermission: Empty().eraseToAnyPublisher()
                ))
            }
            .store(in: &cancellables)
        
        // Handle view model outputs
        viewModel.transform(SettingsViewModel.Input(
            updateNotificationPreference: Empty().eraseToAnyPublisher(),
            updateNotificationTime: Empty().eraseToAnyPublisher(),
            togglePushNotifications: Empty().eraseToAnyPublisher(),
            toggleEmailNotifications: Empty().eraseToAnyPublisher(),
            updateAreaUnit: Empty().eraseToAnyPublisher(),
            updateWaterUnit: Empty().eraseToAnyPublisher(),
            requestNotificationPermission: Empty().eraseToAnyPublisher()
        ))
        .preferences
        .receive(on: DispatchQueue.main)
        .sink { [weak self] preferences in
            self?.updateUI(with: preferences)
        }
        .store(in: &cancellables)
    }
    
    // MARK: - Helper Methods
    
    private func createSection(title: String, arrangedSubviews: [UIView]) -> UIStackView {
        let sectionStack = UIStackView()
        sectionStack.axis = .vertical
        sectionStack.spacing = 12
        
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.adjustsFontForContentSizeCategory = true
        
        sectionStack.addArrangedSubview(titleLabel)
        arrangedSubviews.forEach { sectionStack.addArrangedSubview($0) }
        
        return sectionStack
    }
    
    private func createLabeledControl(label: String, control: UIView) -> UIStackView {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 12
        stack.distribution = .fillEqually
        
        let label = UILabel()
        label.text = label
        label.font = .preferredFont(forTextStyle: .body)
        label.adjustsFontForContentSizeCategory = true
        
        stack.addArrangedSubview(label)
        stack.addArrangedSubview(control)
        
        return stack
    }
    
    private func updateUI(with preferences: UserPreferences) {
        notificationTypeSegmentControl.selectedSegmentIndex = preferences.notificationPreference.rawValue
        
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        if let date = formatter.date(from: preferences.reminderTime) {
            reminderTimePicker.date = date
        }
        
        pushNotificationSwitch.isOn = preferences.pushNotificationsEnabled
        emailNotificationSwitch.isOn = preferences.emailNotificationsEnabled
        measurementUnitSegmentControl.selectedSegmentIndex = preferences.areaUnit == .squareFeet ? 0 : 1
    }
    
    private func setupAccessibility() {
        view.accessibilityIdentifier = "SettingsView"
        containerStackView.accessibilityIdentifier = "SettingsContainer"
        
        // Set accessibility traits
        notificationTypeSegmentControl.accessibilityTraits = .adjustable
        reminderTimePicker.accessibilityTraits = .adjustable
        pushNotificationSwitch.accessibilityTraits = .button
        emailNotificationSwitch.accessibilityTraits = .button
        measurementUnitSegmentControl.accessibilityTraits = .adjustable
        
        // Support dynamic type
        view.subviews.forEach { $0.adjustsFontForContentSizeCategory = true }
    }
}