import Foundation
import Combine

/// Thread-safe ViewModel that manages encrypted settings and user preferences with performance optimization
@available(iOS 14.0, *)
@MainActor
final class SettingsViewModel: ViewModelType {
    
    // MARK: - Types
    
    /// Input events from view layer
    struct Input {
        let updateNotificationTime: AnyPublisher<String, Never>
        let updateNotificationPreference: AnyPublisher<NotificationPreference, Never>
        let togglePushNotifications: AnyPublisher<Bool, Never>
        let toggleEmailNotifications: AnyPublisher<Bool, Never>
        let updateAreaUnit: AnyPublisher<MeasurementUnit, Never>
        let updateWaterUnit: AnyPublisher<MeasurementUnit, Never>
        let requestNotificationPermission: AnyPublisher<Void, Never>
    }
    
    /// Output events for view consumption
    struct Output {
        let preferences: AnyPublisher<UserPreferences, Never>
        let isLoading: AnyPublisher<Bool, Never>
        let error: AnyPublisher<GardenPlannerError, Never>
        let notificationAuthorizationStatus: AnyPublisher<Bool, Never>
    }
    
    // MARK: - Properties
    
    private let preferencesService: UserPreferencesService
    private let notificationManager: NotificationManager
    private let errorSubject = PassthroughSubject<GardenPlannerError, Never>()
    private let isLoadingSubject = CurrentValueSubject<Bool, Never>(false)
    private var cancellables = Set<AnyCancellable>()
    
    /// Cache for optimizing preference access
    private let preferencesCache: NSCache<NSString, NSData> = {
        let cache = NSCache<NSString, NSData>()
        cache.countLimit = 100
        cache.totalCostLimit = 1024 * 1024 // 1MB
        return cache
    }()
    
    // MARK: - Initialization
    
    init(preferencesService: UserPreferencesService) {
        self.preferencesService = preferencesService
        self.notificationManager = NotificationManager.shared
        
        Logger.shared.debug("SettingsViewModel initialized")
    }
    
    // MARK: - ViewModelType Implementation
    
    func transform(_ input: Input) -> Output {
        // Track performance
        let startTime = CFAbsoluteTimeGetCurrent()
        
        // Handle notification time updates
        input.updateNotificationTime
            .removeDuplicates()
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] time in
                self?.updateNotificationSettings(
                    preference: self?.preferencesService.preferencesPublisher.value.notificationPreference ?? .daily,
                    reminderTime: time,
                    pushEnabled: self?.preferencesService.preferencesPublisher.value.pushNotificationsEnabled ?? true,
                    emailEnabled: self?.preferencesService.preferencesPublisher.value.emailNotificationsEnabled ?? false
                )
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            self?.errorSubject.send(error)
                        }
                    },
                    receiveValue: { _ in }
                )
                .store(in: &self!.cancellables)
            }
            .store(in: &cancellables)
        
        // Handle notification preference updates
        input.updateNotificationPreference
            .sink { [weak self] preference in
                self?.updateNotificationSettings(
                    preference: preference,
                    reminderTime: self?.preferencesService.preferencesPublisher.value.reminderTime ?? "09:00",
                    pushEnabled: self?.preferencesService.preferencesPublisher.value.pushNotificationsEnabled ?? true,
                    emailEnabled: self?.preferencesService.preferencesPublisher.value.emailNotificationsEnabled ?? false
                )
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            self?.errorSubject.send(error)
                        }
                    },
                    receiveValue: { _ in }
                )
                .store(in: &self!.cancellables)
            }
            .store(in: &cancellables)
        
        // Handle push notification toggle
        input.togglePushNotifications
            .sink { [weak self] enabled in
                if enabled {
                    self?.requestNotificationAuthorization()
                }
                self?.updateNotificationSettings(
                    preference: self?.preferencesService.preferencesPublisher.value.notificationPreference ?? .daily,
                    reminderTime: self?.preferencesService.preferencesPublisher.value.reminderTime ?? "09:00",
                    pushEnabled: enabled,
                    emailEnabled: self?.preferencesService.preferencesPublisher.value.emailNotificationsEnabled ?? false
                )
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            self?.errorSubject.send(error)
                        }
                    },
                    receiveValue: { _ in }
                )
                .store(in: &self!.cancellables)
            }
            .store(in: &cancellables)
        
        // Handle measurement unit updates
        Publishers.CombineLatest(input.updateAreaUnit, input.updateWaterUnit)
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] areaUnit, waterUnit in
                self?.updateMeasurementPreferences(areaUnit: areaUnit, waterUnit: waterUnit)
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                self?.errorSubject.send(error)
                            }
                        },
                        receiveValue: { _ in }
                    )
                    .store(in: &self!.cancellables)
            }
            .store(in: &cancellables)
        
        // Handle notification permission requests
        input.requestNotificationPermission
            .sink { [weak self] _ in
                self?.requestNotificationAuthorization()
            }
            .store(in: &cancellables)
        
        // Log performance metrics
        let endTime = CFAbsoluteTimeGetCurrent()
        Logger.shared.debug("SettingsViewModel transform completed in \(endTime - startTime) seconds")
        
        return Output(
            preferences: preferencesService.preferencesPublisher.eraseToAnyPublisher(),
            isLoading: isLoadingSubject.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher(),
            notificationAuthorizationStatus: Just(true).eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func updateNotificationSettings(
        preference: NotificationPreference,
        reminderTime: String,
        pushEnabled: Bool,
        emailEnabled: Bool
    ) -> AnyPublisher<Void, Error> {
        isLoadingSubject.send(true)
        
        return Future<Void, Error> { [weak self] promise in
            guard let self = self else {
                promise(.failure(GardenPlannerError.customError(.databaseError, "ViewModel deallocated")))
                return
            }
            
            let result = self.preferencesService.updateNotificationPreferences(
                preference: preference,
                reminderTime: reminderTime,
                pushEnabled: pushEnabled,
                emailEnabled: emailEnabled
            )
            
            switch result {
            case .success:
                promise(.success(()))
            case .failure(let error):
                promise(.failure(error))
            }
            
            self.isLoadingSubject.send(false)
        }
        .eraseToAnyPublisher()
    }
    
    private func updateMeasurementPreferences(
        areaUnit: MeasurementUnit,
        waterUnit: MeasurementUnit
    ) -> AnyPublisher<Void, Error> {
        isLoadingSubject.send(true)
        
        return Future<Void, Error> { [weak self] promise in
            guard let self = self else {
                promise(.failure(GardenPlannerError.customError(.databaseError, "ViewModel deallocated")))
                return
            }
            
            let currentPreferences = self.preferencesService.preferencesPublisher.value
            let newPreferences = UserPreferences(
                notificationPreference: currentPreferences.notificationPreference,
                reminderTime: currentPreferences.reminderTime,
                areaUnit: areaUnit,
                waterUnit: waterUnit,
                pushNotificationsEnabled: currentPreferences.pushNotificationsEnabled,
                emailNotificationsEnabled: currentPreferences.emailNotificationsEnabled
            )
            
            let result = self.preferencesService.savePreferences(newPreferences)
            
            switch result {
            case .success:
                promise(.success(()))
            case .failure(let error):
                promise(.failure(error))
            }
            
            self.isLoadingSubject.send(false)
        }
        .eraseToAnyPublisher()
    }
    
    private func requestNotificationAuthorization() {
        notificationManager.requestAuthorization { [weak self] granted, error in
            if let error = error {
                self?.errorSubject.send(GardenPlannerError.customError(.notificationDeliveryFailed, error.localizedDescription))
            }
        }
    }
}