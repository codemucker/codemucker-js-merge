import {
  HasDefaultSrcAndDest,
  MergeConfig,
  PackageJson,
  UpdateTaskItem,
} from '@/model'

export const hardDefaults: MergeConfig & HasDefaultSrcAndDest = {
  logLevel: 'info',
  extends: undefined,
  copyFiles: [],
  deleteFiles: [],
  updateFiles: [],
  defaultSrc: '.',
  defaultDest: 'build/release/dist',
}

//various default groups one can chose from
export const defaults: PackageJson = {
  '@codemucker/merge/default': {
    logLevel: 'info',
    copyFiles: [],
    updateFiles: [],
  },
  '@codemucker/merge/default/none': {
    extends: '@codemucker/merge/default',
    logLevel: 'fatal',
  },
  '@codemucker/merge/default/pnpm-ts-module-dist': {
    extends: undefined,
    copyFiles: [
      {
        label: 'built commonjs files',
        dir: 'build/mjs/src',
        dest: 'build/release/dist/mjs',
        required: true,
      },
      {
        label: 'built esm files',
        dir: 'build/cjs/src',
        dest: 'build/release/dist/cjs',
        required: true,
      },
      {
        label: 'common assets',
        include: ['LICENSE', 'README*', 'package.json'],
        dest: 'build/release/',
        required: true,
      },
      { label: 'source code', dir: 'src/', dest: 'build/release/src/' },
      {
        label: 'commonjs package.json',
        include: 'src/package.cjs.json',
        target: 'build/release/dist/cjs/package.json',
        required: true,
      },
      {
        label: 'esm package.json',
        include: 'src/package.mjs.json',
        target: 'build/release/dist/mjs/package.json',
        required: true,
      },
    ],
    deleteFiles: [],
    updateFiles: [
      {
        include: 'build/release/package.json',
        expression: [
          'scripts',
          'type',
          'files',
          'devDependencies',
          'scripts',
          'build',
          'settings',
          'config',
          '@codemucker/*',
        ],
        value: undefined,
        required: true,
      },
      {
        label: 'fixup source maps',
        dir: 'build/release/',
        include: '**.js.map',
        expressionType: 'text',
        expression: '../../',
        value: '',
      },
    ] as UpdateTaskItem[],
    defaultSrc: './',
    defaultDest: 'build/release/',
  },
  '@codemucker/merge/default/pnpm-ts-module-install': {
    extends: undefined,
    copyFiles: [
      {
        fromPackage: '@codemucker/merge',
        label: 'code setup',
        dir: 'assets',
        include: [
          'tsconfig.*',
          '.prettierignore',
          '.prettierrc.cjs',
          '.npmignore',
        ],
        dest: '.',
        required: true,
        overwite: true,
      },
      {
        fromPackage: '@codemucker/merge',
        label: 'copy license',
        dir: 'assets',
        include: 'LICENSE*',
        dest: '.',
        required: true,
        overwite: false,
      },
    ],
    updateFiles: [
      {
        label: 'merge scripts block',
        fromPackage: '@codemucker/merge',
        fromFile: 'dist/templates/package.scripts.json',
        fromExpression: 'scripts',
        dest: 'package.json',
        expression: 'scripts',
        stratagey: 'merge',
        required: true,
      },
      {
        label: 'copy dependencies from devDependencies',
        fromPackage: '@codemucker/merge',
        fromFile: 'dist/templates/package.scripts.json',
        fromExpression: 'dependencies',
        dest: 'package.json',
        expression: 'devDpendencies',
        stratagey: 'merge',
        required: true,
      },
    ],
  },
  '@codemucker/merge/none': {
    extends: '@codemucker/merge/default/none',
  },
  '@codemucker/merge/dist': {
    extends: '@codemucker/merge/default/pnpm-ts-module-dist',
  },
  '@codemucker/merge/install': {
    extends: '@codemucker/merge/default/pnpm-ts-module-install',
  },
}
