import Foundation
import Combine // iOS 13.0+

/// Protocol defining the base contract for all view models in MVVM architecture,
/// ensuring type-safe input/output binding and efficient data transformation.
@available(iOS 13.0, *)
protocol ViewModelType {
    /// Type representing input events and data from the view layer,
    /// typically containing Combine publishers or value types
    associatedtype Input
    
    /// Type representing transformed output events and data for view consumption,
    /// typically containing Combine publishers for UI updates
    associatedtype Output
    
    /// Transforms input events and data into output events for view consumption.
    /// All processing must complete within 3 seconds per performance requirements.
    ///
    /// - Parameter input: Input events and data from view layer
    /// - Returns: Transformed output containing publishers and data for view consumption
    /// - Note: Implementations should use Combine operators for efficient data transformation
    ///         and proper error handling through error publishers
    func transform(_ input: Input) -> Output
}