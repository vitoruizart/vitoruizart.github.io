import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/components/**', 'happy-dom'],
      ['tests/screens/**', 'happy-dom']
    ],
    include: ['tests/**/*.test.js']
  }
});
