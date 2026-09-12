import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath, URL} from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {'@': fileURLToPath(new URL('./src', import.meta.url))},
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // The only chunk over the default 500 kB limit is the Firestore SDK, which
    // is lazily imported and never reaches signed-out visitors.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Route-level code splitting is handled by React.lazy; these manual
        // chunks keep the heavy third-party libraries out of the entry bundle.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
});
