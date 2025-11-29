import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'src/test/**',
        'src/__tests__/**',
        'src/main.tsx',
        'server.js',
        'api/**',
        'lib/**',
        '*.config.js',
        '*.config.ts',
        'coverage/**',
        'node_modules/**',
      ],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
