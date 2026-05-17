import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['test/unit/**/*.{test,spec}.{ts,tsx}', 'test/integration/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'test/e2e/**', '**/*.spec.ts'],
    testTimeout: 10000,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/main.ts',
        '**/*.spec.ts',
        'test/e2e/**'
      ],
      reportsDirectory: './coverage'
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
