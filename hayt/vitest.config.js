import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/components/calendar-grid.test.js', 'happy-dom'],
    ],
    globals: false,
    testTimeout: 10_000,
  },
});
