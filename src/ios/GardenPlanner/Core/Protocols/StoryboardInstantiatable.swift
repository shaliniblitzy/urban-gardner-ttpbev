//
//  StoryboardInstantiatable.swift
//  GardenPlanner
//
//  Created for Garden Planner iOS App
//  Using Swift 5.9
//  iOS 13.0+
//

import UIKit // Version: iOS 13.0+

/// Errors that can occur during storyboard instantiation
enum StoryboardInstantiationError: Error {
    /// The specified storyboard file could not be found
    case storyboardNotFound
    /// The view controller with the specified identifier was not found in the storyboard
    case viewControllerNotFound
    /// The instantiated view controller is not of the expected type
    case invalidViewControllerType
}

/// Protocol that defines requirements for view controllers that can be instantiated from storyboards
/// Provides a type-safe way to create view controllers with comprehensive error handling
protocol StoryboardInstantiatable where Self: UIViewController {
    
    /// The storyboard identifier for the view controller
    /// Defaults to the class name if not explicitly implemented
    static var storyboardIdentifier: String { get }
    
    /// The name of the storyboard file containing the view controller
    /// Must be explicitly implemented by conforming types
    static var storyboardName: String { get }
    
    /// Creates an instance of the view controller from its storyboard
    /// - Throws: StoryboardInstantiationError if instantiation fails
    /// - Returns: An instance of the view controller
    static func instantiate() throws -> Self
}

// MARK: - Default Implementation
extension StoryboardInstantiatable {
    
    /// Default implementation of storyboardIdentifier that returns the class name
    static var storyboardIdentifier: String {
        return String(describing: self)
    }
    
    /// Default implementation of instantiate() with comprehensive error handling
    static func instantiate() throws -> Self {
        // Attempt to load the storyboard
        guard let storyboard = UIStoryboard(name: storyboardName, bundle: nil) else {
            throw StoryboardInstantiationError.storyboardNotFound
        }
        
        // Attempt to instantiate the view controller
        guard let viewController = storyboard.instantiateViewController(withIdentifier: storyboardIdentifier) as? Self else {
            // If instantiation succeeds but type casting fails, throw appropriate error
            if storyboard.instantiateViewController(withIdentifier: storyboardIdentifier) != nil {
                throw StoryboardInstantiationError.invalidViewControllerType
            }
            throw StoryboardInstantiationError.viewControllerNotFound
        }
        
        return viewController
    }
}