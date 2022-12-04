import {
  HasDefaultSrcAndDest,
  MergeConfig,
  PackageJson,
  UpdateTaskItem,
} from '@/model'

export const hardDefaults: MergeConfig & HasDefaultSrcAndDest = {
  logLevel: 'info',
  extends: undefined,
  packageJson: undefined,
  copy: [],
  delete: [],
  update: [],
  defaultSrc: '.',
  defaultDest: 'build/release/dist',
}

//various default groups one can chose from
export const defaults: PackageJson = {
  '@codemucker/merge/default': {
    logLevel: 'info',
    packageJson: undefined,
    copy: [],
    update: [],
  },
  '@codemucker/merge/default/none': {
    extends: '@codemucker/merge/default',
    logLevel: 'fatal',
  },
  '@codemucker/merge/default/dist': {
    extends: undefined,
    applyBefore: ['@codemucker/merge/install'],
    packageJson: {
      dest: 'build/release/package.json',
      excludeNodes: [
        'scripts',
        'type',
        'files',
        'devDependencies',
        'scripts',
        'build',
        'settings',
        'config',
        '@codemucker/*',
      ] as string[],
    },
    copy: [
      {
        label: 'built commonjs files',
        dir: 'build/mjs/src',
        dest: 'build/release/dist/mjs',
      },
      {
        label: 'built esm files',
        dir: 'build/cjs/src',
        dest: 'build/release/dist/cjs',
      },
      {
        label: 'common assets',
        include: ['LICENSE', 'README*', 'package.json'],
        dest: 'build/release/',
      },
      { label: 'source code', dir: 'src/', dest: 'build/release/src/' },
      {
        label: 'commonjs package.json',
        include: 'src/package.cjs.json',
        target: 'build/release/dist/cjs/package.json',
      },
      {
        label: 'esm package.json',
        include: 'src/package.mjs.json',
        target: 'build/release/dist/mjs/package.json',
      },
    ],
    delete: [],
    update: [
      {
        label: 'fixup source maps',
        dir: 'build/release/',
        include: '**.js.map',
        expressionType: 'text',
        expression: '../../',
        value: '',
      },
      // {
      //   include: 'build/release/package.json',
      //   matchType: 'json',
      //   match: 'private',
      //   replace: true,
      // },
    ] as UpdateTaskItem[],
    defaultSrc: './',
    defaultDest: 'build/release/',
  },

  '@codemucker/merge/default/install': {
    extends: undefined,
    packageJson: {
      dest: 'package.json',
      excludeNodes: ['name', 'repository', 'keywords', 'description'],
      includeNodes: [],
    },
    copy: [],
    update: [],
  },
  '@codemucker/merge/none': {
    extends: '@codemucker/merge/default/none',
  },
  '@codemucker/merge/dist': {
    extends: '@codemucker/merge/default/dist',
  },
  '@codemucker/merge/install': {
    extends: '@codemucker/merge/default/install',
  },
}
