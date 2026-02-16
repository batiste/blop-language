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
    alias: {
      'blop': path.resolve(__dirname, 'src/index.js'),
      '@': path.resolve(__dirname, 'src'),
    },
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
    include: ['snabbdom', 'snabbdom-to-html'],
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
