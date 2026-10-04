import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/test-output',
      '**/storybook-static',
      '**/vitest.config.*.timestamp*',
      '**/vite.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // Dependency rules from PLAN.md §3.
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            { sourceTag: 'scope:engine', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'scope:audio-analysis', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'scope:ui', onlyDependOnLibsWithTags: [] },
            {
              sourceTag: 'scope:playback',
              onlyDependOnLibsWithTags: ['scope:engine'],
            },
            {
              sourceTag: 'scope:tab-renderer',
              onlyDependOnLibsWithTags: ['scope:engine', 'scope:ui'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: [
                'scope:engine',
                'scope:audio-analysis',
                'scope:playback',
                'scope:tab-renderer',
                'scope:ui',
              ],
            },
            { sourceTag: 'scope:web-e2e', onlyDependOnLibsWithTags: [] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
  {
    // Named exports only in packages. Stories and tool configs need default exports.
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    ignores: ['**/*.stories.ts', '**/*.stories.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports (AGENTS.md).',
        },
      ],
    },
  },
  {
    // engine and audio-analysis are pure: no React, no UI kit.
    files: [
      'packages/engine/src/**/*.ts',
      'packages/audio-analysis/src/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'motion', 'motion/*'],
              message: 'engine and audio-analysis must stay framework-free.',
            },
          ],
        },
      ],
    },
  },
  {
    // playback and tab-renderer may use engine *types* only.
    files: [
      'packages/playback/src/**/*.ts',
      'packages/playback/src/**/*.tsx',
      'packages/tab-renderer/src/**/*.ts',
      'packages/tab-renderer/src/**/*.tsx',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@thumbline/engine',
              message: 'Import engine types only (`import type`).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];
