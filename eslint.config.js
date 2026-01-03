//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    ignores: ['convex/_generated/**', '*.config.js', '*.config.ts'],
  },
]
