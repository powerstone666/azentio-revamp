import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

// ESM-only packages (react-markdown and its unified/micromark tree) must be transformed by SWC.
const ESM_PACKAGES = [
  'react-markdown', 'remark-.*', 'rehype-.*', 'unified', 'bail', 'devlop', 'is-plain-obj', 'trough',
  'vfile.*', 'unist-.*', 'mdast-.*', 'micromark.*', 'decode-named-character-reference', 'character-entities.*',
  'hast-.*', 'property-information', 'space-separated-tokens', 'comma-separated-tokens', 'html-url-attributes',
  'ccount', 'trim-lines', 'zwitch', 'longest-streak', 'markdown-table', 'estree-util-.*', 'style-to-.*', 'inline-style-parser',
].join('|');

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node', // UI tests opt in with a `@jest-environment jsdom` docblock
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^server-only$': '<rootDir>/tests/support/server-only.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'app/api/**/*.{ts,tsx}',
    'app/(common-lib)/**/*.ts',
    'app/(config)/**/*.ts',
    'app/(ui)/components/**/*.tsx',
    '!**/*.d.ts',
  ],
};

export default async () => {
  const resolved = await createJestConfig(config)();
  resolved.transformIgnorePatterns = [
    `/node_modules/(?!(?:${ESM_PACKAGES})/)`,
    '^.+\\.module\\.(css|sass|scss)$',
  ];
  return resolved;
};
