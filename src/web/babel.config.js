// @babel/preset-env version: ^7.22.0
// @babel/preset-typescript version: ^7.22.0
// metro-react-native-babel-preset version: ^0.76.0

module.exports = api => {
  // Cache the returned value forever and don't call this function again
  api.cache(true);

  return {
    // Configure presets for React Native and TypeScript with optimized settings
    presets: [
      [
        'module:metro-react-native-babel-preset',
        {
          enableBabelRuntime: true, // Enable Babel runtime for better performance
          disableImportExportTransform: false, // Keep import/export transforms for compatibility
        },
      ],
      [
        '@babel/preset-typescript',
        {
          allowNamespaces: true, // Enable TypeScript namespace support
          allowDeclareFields: true, // Enable declare field syntax
          onlyRemoveTypeImports: true, // Only remove type imports for better tree-shaking
        },
      ],
    ],

    // Configure plugins for React Native features and optimizations
    plugins: [
      [
        '@babel/plugin-proposal-decorators',
        {
          legacy: true,
          loose: true, // Enable loose mode for better performance
        },
      ],
      [
        'react-native-reanimated/plugin',
        {
          relativeSourceLocation: true, // Enable relative source location for better debugging
        },
      ],
    ],

    // Environment-specific settings
    env: {
      development: {
        compact: false, // Disable code compaction in development for better debugging
        sourceMaps: true, // Enable source maps for development debugging
      },
      production: {
        plugins: [
          'transform-remove-console', // Remove console.* calls in production
          [
            'transform-react-remove-prop-types',
            {
              removeImport: true, // Remove PropTypes imports in production
            },
          ],
        ],
        compact: true, // Enable code compaction in production
        sourceMaps: false, // Disable source maps in production for better performance
      },
    },

    // Cache configuration for improved build performance
    cache: {
      directory: './node_modules/.cache/babel-loader',
      compress: true,
      identifier: 'babel-cache',
    },
  };
};