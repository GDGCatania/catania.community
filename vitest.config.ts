import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tools/**/*.test.ts', 'src/**/*.test.ts'],
    // I test non devono toccare la rete: gli adapter si esercitano su fixture.
    environment: 'node',
  },
});
