import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: [
      'supabase/functions/**/*.test.ts',
      'src/**/*.test.{js,ts,jsx,tsx}',
    ],
    // Treat .ts files as TypeScript — no Deno-specific imports in parser files
    environment: 'node',
    reporters: ['verbose'],
  },
})
