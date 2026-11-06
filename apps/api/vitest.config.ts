import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Each test file starts an embedded Postgres; give it room on a cold start.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
