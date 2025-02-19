// @ts-check
// Metro configuration for React Native v0.72.0
const path = require('path'); // v18.0.0
const { getDefaultConfig } = require('@react-native/metro-config'); // v0.72.0

/**
 * Metro configuration for Garden Planner application
 * Provides optimized bundling rules, transformations, and module resolution
 * for React Native development with enhanced production capabilities
 */
module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(__dirname);

  return {
    ...defaultConfig,
    
    // Transformer configuration for optimized builds
    transformer: {
      getTransformOptions: async () => ({
        transform: {
          // Enable inline requires for performance optimization
          inlineRequires: true,
          // Set high optimization level for production builds
          optimizationLevel: 3,
          // Enable Babel runtime for better compatibility
          enableBabelRuntime: true,
        },
      }),
      // Use React Native Babel transformer
      babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
      // Configure Terser minifier for production builds
      minifierPath: 'metro-minify-terser',
      minifierConfig: {
        compress: {
          // Enable aggressive production optimizations
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
        mangle: {
          // Enable name mangling for smaller bundles
          toplevel: true,
          keep_classnames: false,
          keep_fnames: false,
        },
      },
    },

    // Module resolver configuration
    resolver: {
      // Supported source file extensions in order of preference
      sourceExts: [
        'tsx', // TypeScript with JSX
        'ts',  // TypeScript
        'jsx', // JavaScript with JSX
        'js',  // JavaScript
        'json' // JSON files
      ],
      
      // Supported asset extensions
      assetExts: [
        // Images
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
        // Media
        'mp4', 'mp3', 'wav',
        // Documents
        'pdf'
      ],

      // Supported platforms
      platforms: ['ios', 'android'],

      // Module resolution fields in order of preference
      resolverMainFields: [
        'react-native',
        'browser',
        'main'
      ],

      // Enable Watchman for faster file watching
      useWatchman: true,

      // Files to exclude from bundling
      blockList: [
        /.*\.test\..*$/, // Test files
        /.*\.spec\..*$/, // Spec files
      ],
    },

    // Cache configuration for improved build performance
    cacheStores: [{
      name: 'FileStore',
      // Set cache size to 500MB
      maxSize: 500 * 1024 * 1024
    }],

    // Development server configuration
    server: {
      port: 8081,
      // Enable bundle visualizer for debugging
      enableVisualizer: true,
      // Enable enhanced middleware for better development experience
      enhancedMiddleware: true,
    },

    // Project root configuration
    projectRoot: path.resolve(__dirname),
    watchFolders: [
      // Include project root
      path.resolve(__dirname),
      // Include node_modules
      path.resolve(__dirname, '../../node_modules'),
    ],
  };
})();