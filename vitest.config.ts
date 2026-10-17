import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    // Reporte de ejecución en el formato genérico que lee SonarQube
    reporters: ['default', ['vitest-sonar-reporter', { outputFile: 'reports/sonar-report.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'], // lcov -> coverage/lcov.info
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/local.ts'],
    },
  },
});
