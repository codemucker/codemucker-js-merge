import deepmerge from 'deepmerge'
import glob from 'fast-glob'
import fspath from 'path'
import { defaults, hardDefaults } from '@/defaults'
import { log, Logger } from '@/logging'
import {
  CopyTarget,
  HasDefaultSrcAndDest,
  HasDestDir,
  HasLogLevel,
  HasSrcDir,
  HasSrcInclude,
  HasTarget,
  MergeConfig,
  PackageJson,
  ROOT_DIR,
} from '@/model'

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
  include: HasSrcInclude & Partial<HasDestDir> & Partial<HasTarget>,
  defaults: HasDestDir & HasSrcDir
): Promise<CopyTarget[]> {
  const dir = ensureEndsWithSlash(include.dir || defaults.dir)
  const dest = ensureEndsWithSlash(include.dest || defaults.dest)
  const includes = sanitiseIncludes(include.include)

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

function sanitiseIncludes(includes: undefined | string | string[]): string[] {
  if (typeof includes == 'string') {
    return [includes]
  } else if (Array.isArray(includes)) {
    return includes
  } else {
    return ['*', '**/*']
  }
}

function ensureEndsWithSlash(s: string): string {
  if (!s.endsWith('/')) {
    return s + '/'
  }
  return s
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
    return pkg[configKey] || defaults[configKey] || {}
  }
  return (
    pkg[`@codemucker/merge/${configKey}`] ||
    defaults[`@codemucker/merge/${configKey}`] ||
    pkg[configKey] ||
    defaults[configKey] ||
    {}
  )
}

//update all the elements matching the given json node expression
export function jsonReplaceNodes(
  content: any,
  replaceNodes: { [expression: string]: any }
) {
  const jsonLog = log.getSubLogger({ name: 'jsonUtil' })

  jsonLog.trace('start', { content, replaceNodes })
  for (const expression in replaceNodes) {
    const replaceValue = replaceNodes[expression]
    jsonLog.trace('jsonReplace', { expression, replaceValue })

    const parts = expression.split('.')
    internalJsonReplaceNodes(
      content,
      expression,
      content,
      parts,
      0, //index
      parts[0], //part
      undefined, //parentPath
      replaceValue,
      jsonLog
    )
  }
}

function internalJsonReplaceNodes(
  rootContent: any,
  expression: string,
  currentNode: any,
  parts: string[],
  index: number,
  part: string,
  parentPath: string | undefined,
  replaceValue: any,
  logger: Logger
) {
  if (currentNode == undefined || currentNode == null) {
    return
  }
  const endOfExpression = index >= parts.length - 1

  //handle wildcards
  if (part.endsWith('*')) {
    //match on the bit before the wildcard
    const startsWith = part.substring(0, part.length - 2)
    for (const [key] of Object.entries(currentNode)) {
      if (key.startsWith(startsWith)) {
        internalJsonReplaceNodes(
          rootContent,
          expression,
          currentNode, //currentNode
          parts,
          index + 1,
          key, //part
          parentPath,
          replaceValue,
          logger
        )
      }
    }
  } else if (!endOfExpression) {
    //keep walking down
    internalJsonReplaceNodes(
      rootContent,
      expression,
      currentNode[part],
      parts,
      index + 1,
      parts[index + 1],
      parentPath ? parentPath + '.' + part : part,
      replaceValue,
      logger
    )
  } else {
    //this is the final node we want
    const finalPath = parentPath ? parentPath + '.' + part : part
    if (replaceValue == undefined || replaceValue == null) {
      logger.trace('Delete node', { expression, finalPath, part, currentNode })
      delete currentNode[part]
    } else {
      //TODO: interpolate vars
      logger.trace('Replace node', {
        expression,
        finalPath,
        replaceValue,
        part,
        currentNode,
      })
      currentNode[part] = replaceValue
    }
  }
}
