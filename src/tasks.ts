import * as json from '@/json'
import { log } from '@/logging'
import {
  CopyTask,
  DeleteTask,
  HasDestDir,
  HasDryRun,
  HasSrcDir,
  UpdateTask,
} from '@/model'
import * as util from '@/util'
import fs from 'fs-extra'
import fspath from 'path'

export type TaskContext<T> = {
  defaults: HasDestDir & HasSrcDir
  currentKey: string
  taskConfig: T
} & HasDryRun


export type TaskRunner = (context: TaskContext<unknown>) => Promise<void>

export const taskRunners: { [type: string]: TaskRunner } = {
  copy: (context) => taskCopy(context as TaskContext<CopyTask>),
  update: (context) => taskUpdate(context as TaskContext<UpdateTask>),
  delete: (context) => taskDelete(context as TaskContext<DeleteTask>),
}

export async function taskCopy(ctxt: TaskContext<CopyTask>) {
  const taskLog = log.getSubLogger({
    name: ctxt.dryRun ? 'run:copyTask.dryRun' : 'run:copyTask',
  })
  const task = ctxt.taskConfig

  taskLog.debug('begin')

  if (task.label) {
    taskLog.debug('processing: ' + task.label)
  }

  const found = await util.findFiles(task, ctxt.defaults)
  if (task.required && found.length < util.getMinNumMatches(task)) {
    const errMsg = `expected to find at least ${util.getMinNumMatches(
      task
    )} files(s), but was ${found.length}, and was marked as 'required'`
    taskLog.error(errMsg, { configKey: ctxt.currentKey, task, found })
    if (!ctxt.dryRun) {
      throw new Error(errMsg)
    }
  }
  for (const result of found) {
    if (task.overwrite == false && (await fs.pathExists(result.target))) {
      taskLog.debug(
        `Skipping as '${result.target}' already exists and 'overwrite' is set to false`
      )
    } else {
      util.checkWithinRootDirOrThrow(result.src)
      if (ctxt.dryRun) {
        taskLog.info(`would of copied '${result.src}' to '${result.target}'`)
      } else {
        taskLog.trace(`copying '${result.src}' to '${result.target}'`)
        await fs.copy(result.src, result.target, { preserveTimestamps: true })
      }
    }
  }
  taskLog.trace('end')
}

export async function taskDelete(ctxt: TaskContext<DeleteTask>) {
  const task = ctxt.taskConfig
  const taskLog = log.getSubLogger({
    name: ctxt.dryRun ? 'run:deleteTask.dryRun' : 'run:deleteTask',
  })
  taskLog.debug('start...')

  if (task.label) {
    taskLog.debug('processing: ' + task.label)
  }
  const found = await util.findFiles(task, ctxt.defaults)
  for (const result of found) {
    util.checkWithinRootDirOrThrow(result.src)
    if (ctxt.dryRun) {
      taskLog.info(`would of deleted '${result.src}'`)
    } else {
      taskLog.trace('deleting ' + result.src)
      await fs.remove(fspath.resolve(result.src))
    }
  }

  taskLog.trace('end')
}

export async function taskUpdate(ctxt: TaskContext<UpdateTask>) {
  const taskLog = log.getSubLogger({
    name: ctxt.dryRun ? 'run:updateTask.dryRun' : 'run:updateTask',
  })
  taskLog.debug('begin')
  let index = -1
  const task = ctxt.taskConfig
  index++
  if (task.label) {
    taskLog.debug('processing: ' + task.label)
  }

  const expressions = task.expression
    ? Array.isArray(task.expression)
      ? task.expression
      : [task.expression]
    : undefined

  if (!expressions || expressions.length == 0 || expressions[0].length == 0) {
    log.warn(`No 'expression' for update [${index}]`, JSON.stringify(task))
    return
  }
  const found = await util.findFiles(task, ctxt.defaults)
  if (task.required && found.length < util.getMinNumMatches(task)) {
    const errMsg = `expected to find at least ${util.getMinNumMatches(
      task
    )} files(s), but was ${found.length}, and was marked as 'required'`
    taskLog.error(errMsg, { configKey: ctxt.currentKey, task, found })
    if (!ctxt.dryRun) {
      throw new Error(errMsg)
    }
  }

  let valueSrcFileContent: string | undefined
  //read from other file
  if (!task.value && task.fromFile) {
    util.checkWithinRootDirOrThrow(task.fromFile)
    valueSrcFileContent = await fs.readFile(task.fromFile, {
      encoding: task.encoding || 'utf-8',
    })
  }

  for (const result of found) {
    const srcContent: string = await fs.readFile(result.src, {
      encoding: task.encoding || 'utf-8',
    })
    let newContent = srcContent

    if (!task.expressionType) {
      //try to detect from file extension
      if (result.src.endsWith('.json')) {
        task.expressionType = 'json'
      } else if (
        result.src.endsWith('.properties') ||
        result.src.endsWith('.env')
      ) {
        task.expressionType = 'property'
      } else if (
        result.src.endsWith('.txt') ||
        result.src.endsWith('.md') ||
        result.src.endsWith('.js') ||
        result.src.endsWith('.jts')
      ) {
        task.expressionType = 'text'
      }
    }
    if (
      !task.expressionType ||
      task.expressionType == 'text' ||
      task.expressionType == 're'
    ) {
      for (const expression of expressions) {
        const findExpression =
          task.expressionType == 're' ? new RegExp(expression, 'g') : expression

        newContent = srcContent.replace(findExpression, task.value || '')
      }
    } else if (task.expressionType == 'property') {
      for (const expression of expressions) {
        //foo=bar
        const propertyRegExp = new RegExp(
          '(' + expression + '\\s*=\\s*)(.*)',
          'g'
        )
        let replaceValue = task.value || ''

        if (valueSrcFileContent) {
          //TODO: allow using different expressions types for sourcing
          const srcExpression = task.fromExpression || expression
          replaceValue = readUtil.getProperty(
            task.fromFile as string,
            valueSrcFileContent,
            srcExpression,
            propertyRegExp,
            task.required == true,
            ctxt.dryRun
          )
        }
        newContent = srcContent.replace(
          propertyRegExp,
          (name, _existingValue) => {
            return name + '"' + replaceValue + '"'
          }
        )
      }
    } else if (task.expressionType == 'json') {
      const jsonContent = JSON.parse(srcContent)
      const updateNodes: {
        [expression: string]: { value: any; strategy?: 'merge' | 'replace' }
      } = {}
      const valueSrcFileContentJson = valueSrcFileContent
        ? JSON.parse(valueSrcFileContent)
        : undefined
      for (const expression of expressions) {
        let replaceValue = task.value
        if (valueSrcFileContentJson) {
          //TODO: allow using different expressions types for sourcing
          const srcExpression = task.fromExpression || expression
          replaceValue = readUtil.getJsonValue(
            task.fromFile as string,
            valueSrcFileContentJson,
            srcExpression,
            task.required == true,
            ctxt.dryRun
          )
        } else {
          replaceValue - task.value
        }
        updateNodes[expression] = {
          value: replaceValue,
          strategy: task.stratagey,
        }
      }

      json.updateJsonNodes(jsonContent, updateNodes)

      newContent = JSON.stringify(jsonContent, null, 2)
    } else {
      throw new Error(`Unknown matcher type '${task.expressionType}'`)
    }

    if (srcContent != newContent) {
      if (ctxt.dryRun) {
        taskLog.info(`would of updated '${result.src}'`)
      } else {
        await fs.writeFile(result.src, newContent)
        taskLog.debug('updated ' + result.target)
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
    required: boolean,
    dryRun: boolean
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
        if (!dryRun) {
          throw new Error(errMsg + '. and is required')
        }
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
      if (!dryRun) {
        throw new Error(errMsg)
      }
    } else {
      return srcNodes[0].getValue()
    }
  }

  export function getProperty(
    filePath: string,
    fileContent: any,
    expression: string,
    propertyRe: RegExp,
    required: boolean,
    dryRun: boolean
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
        if (!dryRun) {
          throw new Error(errMsg + '. and is required')
        }
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
