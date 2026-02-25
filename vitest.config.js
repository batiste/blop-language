import { defineConfig } from 'vitest/config';
import { blopPlugin } from './src/vitest.js';

export default defineConfig({
  plugins: [blopPlugin()],
  
  // Tell Vite how to handle dependencies
  resolve: {
    extensions: ['.js', '.blop', '.ts'],
    alias: {
      // Ensure paths resolve correctly
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  
  // Optimize dependency handling
  optimizeDeps: {
    include: ['snabbdom'],
  },
  
  test: {
    // File patterns for test discovery
    include: ['**/*.test.blop', '**/tests/**/*.test.js'],
    
    // Make test globals available (test, describe, expect, etc.)
    globals: true,
    
    // Browser-like environment for DOM testing
    environment: 'jsdom',
    
    // Coverage configuration
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.js',
      ],
      exclude: [
        'src/tests/**',
        'src/parser.js', // Generated file
        'src/blop.js', // CLI entry point
        'src/generateParser.js',
        'src/runtime.mock.js',
      ],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 75,
        statements: 75,
      },
    },
    
    // Global test timeout
    testTimeout: 10000,
    
    // Show full diffs in test failures
    outputDiffMaxLines: 50,
  },
});
