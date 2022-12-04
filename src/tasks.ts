import { log } from '@/logging'
import {
  CopyTaskItem,
  DeleteTaskItem,
  HasDestDir,
  HasDryRun,
  HasSrcDir,
  SanitisePackageJsonTaskConfig,
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
      if (item.overwite == false && (await fs.pathExists(result.target))) {
        taskLog.debug(
          `Skipping as '${result.target}' already exists and 'overwrite' is set to false`
        )
      } else {
        util.checkWithinRootDirOrThrow(result.src)
        if (opts.dryRun) {
          taskLog.info(`would of copied '${result.src}' to '${result.target}'`)
        } else {
          taskLog.trace(`copying '${result.src}' to ''${result.target}`)
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
    for (const result of found) {
      const srcContent: string = await fs.readFile(result.src, {
        encoding: item.encoding || 'utf-8',
      })
      let newContent = srcContent

      if (!item.expressionType) {
        //try to detect from file extension
        if (result.src.endsWith('.json')) {
          item.expressionType = 'json'
        } else if (result.src.endsWith('.properties')) {
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
      } else if (item.expressionType == 'json') {
        const jsonContent = JSON.parse(srcContent)
        const replaceNodes = {} as {
          [expression: string]: any
        }
        for (const expression of expressions) {
          replaceNodes[expression] = item.value
        }

        util.jsonReplaceNodes(jsonContent, replaceNodes)

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

export async function sanitisePackageJson(
  opts: {
    config?: SanitisePackageJsonTaskConfig
  } & HasDryRun &
    RunContext
) {
  if (!opts.config || !opts.config.dest || opts.config.dest.length == 0) {
    return
  }

  const taskLog = log.getSubLogger({
    name: opts.dryRun
      ? 'sanitisePackageJsonTask.dryRun'
      : 'sanitisePackageJsonTask',
  })
  taskLog.debug('begin')

  const path = opts.config.dest
  if (!(await fs.pathExists(path))) {
    taskLog.warn('No ' + path + ', skipping sanitise')
    return
  }

  const replaceNodes = opts.config.replaceNodes || {}

  //convert the excludes into replace with 'null'
  const excludeNodes = opts.config.excludeNodes || []
  excludeNodes.forEach((path) => {
    replaceNodes[path] = null
  })

  const content = JSON.parse(await fs.readFile(path, 'utf8'))
  util.jsonReplaceNodes(content, replaceNodes)
  const newContent = JSON.stringify(content, null, 2)
  taskLog.trace({ newContent })
  if (opts.dryRun) {
    taskLog.debug(`would have written sanitised '${path}'`)
  } else {
    await fs.writeFile(path, newContent)
    taskLog.debug(`wrote sanitised '${path}'`)
  }

  taskLog.trace('end')
}
