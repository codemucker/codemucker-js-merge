import * as json from '@/json'
import { log } from '@/logging'
import {
  CopyTaskItem,
  DeleteTaskItem,
  HasDestDir,
  HasDryRun,
  HasSrcDir,
  UpdateTaskItem,
} from '@/model'
import * as util from '@/util'
import fs from 'fs-extra'
import fspath from 'path'

export type RunContext = {
  currentKey: string
}
export async function copyFiles(
  opts: {
    items: CopyTaskItem[] | undefined
    defaults: HasDestDir & HasSrcDir
  } & HasDryRun &
    RunContext
) {
  if (!opts.items) {
    return
  }
  const taskLog = log.getSubLogger({
    name: opts.dryRun ? 'copyTask.dryRun' : 'copyTask',
  })

  taskLog.debug('begin')
  for (const item of opts.items) {
    if (item.label) {
      taskLog.debug('processing: ' + item.label)
    }

    const found = await util.findFiles(item, opts.defaults)
    if (item.required && found.length < util.getMinNumMatches(item)) {
      const errMsg = `expected to find at least ${util.getMinNumMatches(
        item
      )} item(s), but was ${found.length}, and was marked as 'required'`
      taskLog.error(errMsg, { configKey: opts.currentKey, item, found })
      throw new Error(errMsg)
    }
    for (const result of found) {
      if (item.overwrite == false && (await fs.pathExists(result.target))) {
        taskLog.debug(
          `Skipping as '${result.target}' already exists and 'overwrite' is set to false`
        )
      } else {
        util.checkWithinRootDirOrThrow(result.src)
        if (opts.dryRun) {
          taskLog.info(`would of copied '${result.src}' to '${result.target}'`)
        } else {
          taskLog.trace(`copying '${result.src}' to '${result.target}'`)
          await fs.copy(result.src, result.target, { preserveTimestamps: true })
        }
      }
    }
  }
  taskLog.trace('end')
}

export async function deleteFiles(
  opts: {
    items: DeleteTaskItem[] | undefined
    defaults: HasDestDir & HasSrcDir
  } & HasDryRun &
    RunContext
) {
  if (!opts.items) {
    return
  }
  const taskLog = log.getSubLogger({
    name: opts.dryRun ? 'deleteTask.dryRun' : 'deleteTask',
  })
  taskLog.debug('start...')
  for (const item of opts.items) {
    if (item.label) {
      taskLog.debug('processing: ' + item.label)
    }
    const found = await util.findFiles(item, opts.defaults)
    for (const result of found) {
      util.checkWithinRootDirOrThrow(result.src)
      if (opts.dryRun) {
        taskLog.info(`would of deleted '${result.src}'`)
      } else {
        taskLog.trace('deleting ' + result.src)
        await fs.remove(fspath.resolve(result.src))
      }
    }
  }

  taskLog.trace('end')
}

export async function updateFiles(
  opts: {
    items: UpdateTaskItem[] | undefined
    defaults: HasDestDir & HasSrcDir
  } & HasDryRun &
    RunContext
) {
  if (!opts.items) {
    return
  }
  const taskLog = log.getSubLogger({
    name: opts.dryRun ? 'updateTask.dryRun' : 'updateTask',
  })
  taskLog.debug('begin')
  let index = -1
  for (const item of opts.items) {
    index++
    if (item.label) {
      taskLog.debug('processing: ' + item.label)
    }

    const expressions = item.expression
      ? Array.isArray(item.expression)
        ? item.expression
        : [item.expression]
      : undefined

    if (!expressions || expressions.length == 0 || expressions[0].length == 0) {
      log.warn(`No 'expression' for update [${index}]`, JSON.stringify(item))
      return
    }
    const found = await util.findFiles(item, opts.defaults)
    if (item.required && found.length < util.getMinNumMatches(item)) {
      const errMsg = `expected to find at least ${util.getMinNumMatches(
        item
      )} item(s), but was ${found.length}, and was marked as 'required'`
      taskLog.error(errMsg, { configKey: opts.currentKey, item, found })
      throw new Error(errMsg)
    }

    let valueSrcFileContent: string | undefined
    //read from other file
    if (!item.value && item.fromFile) {
      util.checkWithinRootDirOrThrow(item.fromFile)
      valueSrcFileContent = await fs.readFile(item.fromFile, {
        encoding: item.encoding || 'utf-8',
      })
    }

    for (const result of found) {
      const srcContent: string = await fs.readFile(result.src, {
        encoding: item.encoding || 'utf-8',
      })
      let newContent = srcContent

      if (!item.expressionType) {
        //try to detect from file extension
        if (result.src.endsWith('.json')) {
          item.expressionType = 'json'
        } else if (
          result.src.endsWith('.properties') ||
          result.src.endsWith('.env')
        ) {
          item.expressionType = 'property'
        } else if (
          result.src.endsWith('.txt') ||
          result.src.endsWith('.md') ||
          result.src.endsWith('.js') ||
          result.src.endsWith('.jts')
        ) {
          item.expressionType = 'text'
        }
      }
      if (
        !item.expressionType ||
        item.expressionType == 'text' ||
        item.expressionType == 're'
      ) {
        for (const expression of expressions) {
          const findExpression =
            item.expressionType == 're'
              ? new RegExp(expression, 'g')
              : expression

          newContent = srcContent.replace(findExpression, item.value || '')
        }
      } else if (item.expressionType == 'property') {
        for (const expression of expressions) {
          //foo=bar
          const propertyRegExp = new RegExp(
            '(' + expression + '\\s*=\\s*)(.*)',
            'g'
          )
          let replaceValue = item.value || ''

          if (valueSrcFileContent) {
            //TODO: allow using different expressions types for sourcing
            const srcExpression = item.fromExpression || expression
            replaceValue = readUtil.getProperty(
              item.fromFile as string,
              valueSrcFileContent,
              srcExpression,
              propertyRegExp,
              item.required == true
            )
          }
          newContent = srcContent.replace(
            propertyRegExp,
            (name, _existingValue) => {
              return name + '"' + replaceValue + '"'
            }
          )
        }
      } else if (item.expressionType == 'json') {
        const jsonContent = JSON.parse(srcContent)
        const updateNodes: {
          [expression: string]: { value: any; strategy?: 'merge' | 'replace' }
        } = {}
        const valueSrcFileContentJson = valueSrcFileContent
          ? JSON.parse(valueSrcFileContent)
          : undefined
        for (const expression of expressions) {
          let replaceValue = item.value
          if (valueSrcFileContentJson) {
            //TODO: allow using different expressions types for sourcing
            const srcExpression = item.fromExpression || expression
            replaceValue = readUtil.getJsonValue(
              item.fromFile as string,
              valueSrcFileContentJson,
              srcExpression,
              item.required == true
            )
          } else {
            replaceValue - item.value
          }
          updateNodes[expression] = {
            value: replaceValue,
            strategy: item.stratagey,
          }
        }

        json.updateJsonNodes(jsonContent, updateNodes)

        newContent = JSON.stringify(jsonContent, null, 2)
      } else {
        throw new Error(`Unknown matcher type '${item.expressionType}'`)
      }

      if (srcContent != newContent) {
        if (opts.dryRun) {
          taskLog.info(`would of updated '${result.src}'`)
        } else {
          await fs.writeFile(result.src, newContent)
          taskLog.debug('updated ' + result.target)
        }
      }
    }
  }

  taskLog.trace('end')
}

module readUtil {
  const taskLog = log.getSubLogger({ name: 'readUtil' })

  export function getJsonValue(
    filePath: string,
    jsonContent: any,
    expression: string,
    required: boolean
  ): any {
    const srcNodes = json.findJsonNodes(jsonContent, expression)
    if (srcNodes.length == 0) {
      const errMsg = `Can't find any json nodes with expression '${expression}' in file '${filePath}'`
      if (required) {
        taskLog.error(errMsg + ', and is required', {
          expression,
          fileContent: jsonContent,
          filePath,
        })
        throw new Error(errMsg + '. and is required')
      } else {
        taskLog.warn(errMsg + '. Not required, so skipping', {
          expression,
          fileContent: jsonContent,
          filePath,
        })
        return null
      }
    } else if (srcNodes.length > 1) {
      const errMsg = `Found multiple matching nodes for expression '${expression}' in file '${filePath}'. Don't know which one to use`
      taskLog.error(errMsg, {
        expression,
        fileContent: jsonContent,
        filePath,
        srcNodes,
      })
      throw new Error(errMsg)
    } else {
      return srcNodes[0].getValue()
    }
  }

  export function getProperty(
    filePath: string,
    fileContent: any,
    expression: string,
    propertyRe: RegExp,
    required: boolean
  ): string | undefined {
    const match = fileContent.match(propertyRe)
    if (!match || match) {
      const errMsg = `Couldn't find property '${expression}' in file '${filePath}'`
      if (required) {
        taskLog.error(errMsg + ', and is required', {
          expression,
          fileContent,
          filePath,
        })
        throw new Error(errMsg + '. and is required')
      } else {
        taskLog.warn(errMsg + '. Not required, so skipping', {
          expression,
          fileContent,
          filePath,
        })
        return undefined
      }
    }
    return match[2]
  }
}
