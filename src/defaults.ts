import { HasDefaultSrcAndDest, MergeConfig, PackageJson } from '@/model'

export const hardDefaults: MergeConfig & HasDefaultSrcAndDest = {
  logLevel: 'info',
  extends: undefined,
  defaultSrc: '.',
  defaultDest: 'build/release/dist',
}

//various default groups one can chose from
export const defaults: PackageJson = {
  '@codemucker/merge/default': {
    logLevel: 'info',
  },
  '@codemucker/merge/default/none': {
    extends: '@codemucker/merge/default',
    logLevel: 'fatal',
  },
  // Links:
  //  - https://www.sensedeep.com/blog/posts/2021/how-to-create-single-source-npm-module.html
  '@codemucker/merge/default/pnpm-ts-module-dist': {
    extends: undefined,
    tasks: [
      {
        type: 'copy',
        label: 'built commonjs files',
        dir: 'build/mjs/src',
        dest: 'build/release/dist/mjs',
        required: true,
      },
      {
        type: 'copy',
        label: 'built esm files',
        dir: 'build/cjs/src',
        dest: 'build/release/dist/cjs',
        required: true,
      },
      {
        type: 'copy',
        label: 'common assets',
        include: ['LICENSE', 'README*', 'package.json'],
        dest: 'build/release/',
        required: true,
      },
      {
        type: 'copy',
        label: 'source code',
        dir: 'src/',
        dest: 'build/release/src/',
      },
      {
        type: 'copy',
        label: 'commonjs package.json',
        include: 'src/package.cjs.json',
        target: 'build/release/dist/cjs/package.json',
        required: true,
      },
      {
        type: 'copy',
        label: 'esm package.json',
        include: 'src/package.mjs.json',
        target: 'build/release/dist/mjs/package.json',
        required: true,
      },
      {
        type: 'update',
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
        type: 'update',
        label: 'fixup source maps',
        dir: 'build/release/',
        include: '**.js.map',
        expressionType: 'text',
        expression: '../../',
        value: '',
      },
    ],
    defaultSrc: './',
    defaultDest: 'build/release/',
  },
  '@codemucker/merge/default/pnpm-ts-module-install': {
    extends: undefined,
    tasks: [
      {
        type: 'copy',
        fromPackage: '@codemucker/merge',
        label: 'tooling config',
        dir: 'templates',
        include: [
          'tsconfig.*',
          '.prettierignore',
          '.prettierrc.cjs',
          '.npmignore',
        ],
        dest: '.',
        required: true,
        overwrite: true,
      },
      {
        type: 'copy',
        fromPackage: '@codemucker/merge',
        label: 'esm & cjs package json',
        dir: 'templates',
        include: 'package.*.json*',
        dest: 'src',
        required: true,
        overwrite: true,
      },
      {
        type: 'update',
        label: 'merge scripts block',
        fromPackage: '@codemucker/merge',
        fromFile: 'templates/package.scripts.json',
        fromExpression: 'scripts',
        dest: 'package.json',
        expression: 'scripts',
        stratagey: 'merge',
        required: true,
      },
      {
        type: 'update',
        label: 'copy dependencies from devDependencies',
        fromPackage: '@codemucker/merge',
        fromFile: 'templates/package.scripts.json',
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
