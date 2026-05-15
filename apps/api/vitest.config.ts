import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.test.ts', 'src/db/schema.ts', 'src/scripts/**'],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
      },
    },
  },
});
