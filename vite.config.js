import { defineConfig } from 'vite';
import { blopPlugin } from './src/vite.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [blopPlugin()],
  
  // Root directory where index.html is located
  root: 'example',
  
  // Public base path
  base: './',
  
  // Resolve configuration
  resolve: {
    extensions: ['.js', '.blop', '.ts'],
    alias: [
      // Exact match for the bare 'blop' runtime namespace — must NOT match 'blop/router' etc.
      // (Rollup alias resolves string keys as prefixes, so a regex is required here.)
      { find: /^blop$/, replacement: path.resolve(__dirname, 'src/index.js') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // Provide empty modules for Node.js built-ins when used in browser
      { find: 'module',     replacement: path.resolve(__dirname, 'src/browser-stubs/module.js') },
      { find: 'fs',         replacement: path.resolve(__dirname, 'src/browser-stubs/fs.js') },
      { find: 'path',       replacement: path.resolve(__dirname, 'src/browser-stubs/path.js') },
      { find: 'chalk',      replacement: path.resolve(__dirname, 'src/browser-stubs/chalk.js') },
      { find: 'perf_hooks', replacement: path.resolve(__dirname, 'src/browser-stubs/perf_hooks.js') },
      { find: 'url',        replacement: path.resolve(__dirname, 'src/browser-stubs/url.js') },
    ],
  },
  
  // Development server configuration
  server: {
    port: 8080,
    open: true,
    strictPort: false,
  },
  
  // Build configuration
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/, /src\/runtime\.js/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'example/index.html'),
      },
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['snabbdom'],
    exclude: [],
    esbuildOptions: {
      // Ensure CommonJS modules are properly converted
      mainFields: ['module', 'main'],
    },
  },
  
  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: {
        // Add any SCSS options if needed
      },
    },
  },
  
  // Define global constants (replaces webpack.DefinePlugin)
  define: {
    SERVER: false,
  },
});
