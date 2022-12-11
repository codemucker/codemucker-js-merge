import { defaults, hardDefaults } from '@/defaults.js'
import { log } from '@/logging.js'
import {
  CopyTarget,
  HasDefaultSrcAndDest,
  HasDestDir,
  HasLogLevel,
  HasPackageDependency,
  HasSrcDir,
  HasSrcInclude,
  HasTarget,
  MergeConfig,
  PackageJson,
  ROOT_DIR,
} from '@/model.js'

import deepmerge from 'deepmerge'
import glob from 'fast-glob'
import fspath from 'path'

//if the given path is not within the project root, then throw an error
export function checkWithinRootDirOrThrow(path: string) {
  const fullPath = fspath.resolve(path)
  if (!fullPath.startsWith(ROOT_DIR)) {
    const errMsg = `Path '${fullPath}' (from '${path}') is not within the project root dir '${ROOT_DIR}'. Bailing as this looks malicious or a bug`
    log.error(errMsg)
    throw new Error(errMsg)
  }
}

//find all the files matching the given include rules
export async function findFiles(
  include: HasSrcInclude &
    Partial<HasDestDir> &
    Partial<HasTarget> &
    Partial<HasPackageDependency>,
  defaults: HasDestDir & HasSrcDir
): Promise<CopyTarget[]> {
  const pkgDir = include.fromPackage
    ? getDependencyPath(include.fromPackage)
    : undefined
  let dir = include.srcDir || defaults.srcDir
  dir = ensureEndsWithSlash(pkgDir ? pkgDir + dir : dir)
  const dest = ensureEndsWithSlash(include.dest || defaults.dest)
  const includes = includesToArray(include.include)

  const found = await glob(includes, { cwd: dir })

  const results: CopyTarget[] = []
  for (const file of found) {
    const src = dir + file
    //override the target if manually set
    const target = include.target || dest + file
    results.push({ src, target })
  }
  return results
}

function includesToArray(includes: undefined | string | string[]): string[] {
  if (typeof includes == 'string') {
    return [includes]
  } else if (Array.isArray(includes)) {
    return includes
  } else {
    return ['*', '**/*']
  }
}

export function getMinNumMatches(include: HasSrcInclude): number {
  if (!include.include) {
    return 1
  }
  //count num non wildcards
  let min = 0
  const includes = includesToArray(include.include)
  for (const inc of includes) {
    if (inc == '*' || inc == '**/*') {
      continue
    }
    min++
  }
  return min > 0 ? min : 1
}

function ensureEndsWithSlash(s: string): string {
  if (!s.endsWith('/')) {
    return s + '/'
  }
  return s
}

function getDependencyPath(dep: string): string {
  return ensureEndsWithSlash(ROOT_DIR + '/node_modules/' + dep)
}

export function getMergedConfig(
  pkg: PackageJson,
  configKey: string
): MergeConfig & HasDefaultSrcAndDest & HasLogLevel {
  const config = resolveConfig(pkg, configKey)
  return deepmerge(hardDefaults as HasDefaultSrcAndDest, config)
}

function resolveConfig(pkg: PackageJson, configKey: string): MergeConfig {
  const config = getRawConfig(pkg, configKey)
  if (config.extends) {
    log.trace(`resolving parent '${config.extends}' for '${configKey}'`)
    const parentConfig = resolveConfig(pkg, config.extends)
    return deepmerge(parentConfig, config)
  }
  return config
}

function getRawConfig(
  pkg: PackageJson,
  configKey: string
): Partial<MergeConfig> & Partial<HasDefaultSrcAndDest> {
  if (configKey.startsWith('@')) {
    const cfg = pkg[configKey] || defaults[configKey] || undefined
    if (!cfg) {
      const erroMsg = `No merge config could be found for key '${configKey}'`
      log.fatal(erroMsg)
      throw new Error(erroMsg)
    }
    return cfg
  }
  const cfg =
    pkg[`@codemucker/merge/${configKey}`] ||
    defaults[`@codemucker/merge/${configKey}`] ||
    pkg[configKey] ||
    defaults[configKey] ||
    undefined
  if (!cfg) {
    const erroMsg = `No merge config could be found for key '${configKey}' or ${`@codemucker/merge/${configKey}`}`
    log.fatal(erroMsg)
    throw new Error(erroMsg)
  }
  return cfg
}
