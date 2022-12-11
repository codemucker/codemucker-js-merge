import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/build/cjs/src/$1',
    '^@test/(.*)$': '<rootDir>/build/cjs/test/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/build/release', '<rootDir>/build/mjs'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.cjs.json',
      },
    ],
  },
  coverageDirectory:"<rootDir>/build/jest-coverage"
}

export default config
