import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? './' : './',
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    maxWorkers: 2,
    minWorkers: 1,
    testTimeout: 20000,
    teardownTimeout: 10000,
  }
})