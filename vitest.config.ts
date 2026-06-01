import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', 'tests/**/*.ts'],
    exclude: ['node_modules', 'mypens-mobile', 'my-pens-mobile-test', '.next', 'out'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
