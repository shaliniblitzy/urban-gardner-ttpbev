# Garden Planner iOS Application

A comprehensive mobile application for optimized home gardening management built with Swift 5.9 for iOS 14.0+. This application helps users efficiently plan and maintain their gardens with features like space optimization, maintenance scheduling, and plant care tracking.

## Requirements

### Development Environment
- Xcode 15.0+
- Swift 5.9
- iOS 14.0+ deployment target
- macOS Ventura 13.0+ for development

### Dependencies
- SQLite.swift (0.14.1) - Local database management
- Firebase/Messaging (10.0.0) - Push notification handling
- Firebase/Analytics (10.0.0) - Usage tracking
- Firebase/Core (10.0.0) - Firebase core functionality
- Sentry (8.0.0) - Error tracking
- SwiftLint (0.52.0) - Code style enforcement
- Quick (7.0.0) - Testing framework (development)
- Nimble (12.0.0) - Testing assertions (development)

## Project Setup

### 1. Environment Setup
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install CocoaPods
sudo gem install cocoapods

# Install Fastlane
brew install fastlane

# Install SwiftLint
brew install swiftlint
```

### 2. Project Installation
```bash
# Clone the repository
git clone [repository-url]
cd garden-planner/ios

# Install dependencies
pod install

# Open workspace
open GardenPlanner.xcworkspace
```

## Project Structure

The project follows MVVM architecture with Coordinator pattern for navigation:

```
GardenPlanner/
├── Core/
│   ├── Constants/
│   ├── Database/
│   ├── Notifications/
│   ├── Protocols/
│   └── Utils/
├── Models/
│   ├── Garden.swift
│   ├── Plant.swift
│   ├── Zone.swift
│   └── Schedule.swift
├── Services/
│   ├── GardenService.swift
│   └── Optimization/
├── UI/
│   ├── Components/
│   ├── Common/
│   └── Garden/
└── Resources/
```

## Development Guidelines

### Code Style
- Follow Swift style guide enforced by SwiftLint
- Use Swift's native concurrency features where possible
- Implement proper error handling and logging
- Maintain thread safety using appropriate synchronization mechanisms

### Architecture
- MVVM + Coordinator pattern
- Protocol-oriented programming
- Dependency injection
- Reactive programming with Combine

### Best Practices
1. Thread Safety
```swift
private let lock = NSLock()
private var sharedResource: Resource {
    get {
        lock.lock()
        defer { lock.unlock() }
        return _sharedResource
    }
}
```

2. Error Handling
```swift
public enum GardenError: Error {
    case invalidInput(String)
    case optimizationFailed(String)
    case persistenceFailed(String)
}
```

3. Performance Optimization
```swift
private let cache = NSCache<NSString, CacheItem>()
private let operationQueue = DispatchQueue(label: "com.gardenplanner.operations",
                                         qos: .userInitiated)
```

## Testing

### Unit Tests
```bash
# Run unit tests
fastlane test

# Run specific test suite
xcodebuild test -scheme GardenPlanner -destination 'platform=iOS Simulator,name=iPhone 14'
```

### Test Coverage
- Minimum coverage requirement: 80%
- Critical components require 90%+ coverage
- Run coverage report: `fastlane coverage_report`

## Deployment

### Configuration
1. Update version and build numbers in project settings
2. Verify all certificates and provisioning profiles
3. Update release notes in fastlane/metadata

### Build and Deploy
```bash
# Build for development
fastlane development

# Deploy to TestFlight
fastlane beta

# Deploy to App Store
fastlane release
```

### Continuous Integration
- GitHub Actions workflow for automated testing
- Automated TestFlight deployment for release branches
- Code signing using fastlane match

## Monitoring

### Performance Monitoring
- Firebase Performance Monitoring integration
- Custom performance traces for critical operations
- Memory usage tracking
- Network request monitoring

### Error Tracking
- Sentry integration for crash reporting
- Custom error handling and logging
- User feedback collection

### Analytics
- Firebase Analytics implementation
- Custom event tracking
- User engagement metrics
- Feature usage analytics

## Troubleshooting

### Common Issues
1. Build Errors
   - Clean build folder (Cmd + Shift + K)
   - Clear derived data
   - Verify CocoaPods installation

2. Runtime Issues
   - Check device logs
   - Verify permissions
   - Monitor memory usage

3. Database Issues
   - Verify schema version
   - Check migration status
   - Validate data integrity

## Support

For technical support and contributions:
- File issues on GitHub
- Follow contribution guidelines
- Review pull request template
- Check coding standards

## License

Copyright © 2024 Garden Planner. All rights reserved.