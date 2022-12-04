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
  '@codemucker/merge/default/ts/module/dist': {
    extends: undefined,
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
    ] as UpdateTaskItem[],
    defaultSrc: './',
    defaultDest: 'build/release/',
  },

  '@codemucker/merge/default/ts/module/install': {
    extends: undefined,
    copy: [],
    update: [],
  },
  '@codemucker/merge/none': {
    extends: '@codemucker/merge/default/none',
  },
  '@codemucker/merge/dist': {
    extends: '@codemucker/merge/default/ts/module/dist',
  },
  '@codemucker/merge/install': {
    extends: '@codemucker/merge/default/ts/module/install',
  },
}
