import { log, Logger } from '@/logging.js'
import deepmerge from 'deepmerge'

export type JsonNode = {
  rootElement: any
  parentElement: any
  expression: string
  name: string
  fullPath: string
  element: any
  setValue: (value: any) => void
  getValue: () => any
}
//update all the elements matching the given json node expression
export function updateJsonNodes(
  content: any,
  updateNodes: {
    [expression: string]: { value: any; strategy?: 'merge' | 'replace' }
  }
) {
  const jsonLog = log.getSubLogger({ name: 'updateJsonNodes' })

  jsonLog.trace('start', { content, replaceNodes: updateNodes })
  for (const expression in updateNodes) {
    const update = updateNodes[expression]
    jsonLog.trace('updateJsonNodes', { expression, update })
    const nodes = findJsonNodes(content, expression)
    for (const node of nodes) {
      if (update.strategy == 'merge') {
        const existingVal = node.getValue()
        const newVal = existingVal ? deepmerge(existingVal, update.value) : update.value
        node.setValue(newVal)
      } else if (!update.strategy || update.strategy == 'replace') {
        node.setValue(update.value)
      } else {
        const errMsg = `Unknown node update  strategy '${update.strategy}'`
        jsonLog.error(errMsg, { expression, update })
        throw new Error(errMsg)
      }
    }
  }
  jsonLog.trace('done')
}
export function findJsonNodes(root: any, expression: string): JsonNode[] {
  const jsonLog = log.getSubLogger({ name: 'jsonFindNode' })

  const parts = expression.split('.')
  const nodes: JsonNode[] = []
  internalFindNodes(
    root,
    expression,
    root,
    parts,
    0, //index
    parts[0], //part
    undefined, //parentPath
    jsonLog,
    nodes
  )
  return nodes
}
function internalFindNodes(
  rootContent: any,
  expression: string,
  currentNode: any,
  parts: string[],
  index: number,
  part: string,
  parentPath: string | undefined,
  logger: Logger,
  nodes: JsonNode[]
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
        internalFindNodes(
          rootContent,
          expression,
          currentNode, //currentNode
          parts,
          index + 1,
          key, //part
          parentPath,
          logger,
          nodes
        )
      }
    }
  } else if (!endOfExpression) {
    //keep walking down
    internalFindNodes(
      rootContent,
      expression,
      currentNode[part],
      parts,
      index + 1,
      parts[index + 1],
      parentPath ? parentPath + '.' + part : part,
      logger,
      nodes
    )
  } else {
    //this is the final node we want
    const element = currentNode[part]
    const finalPath = parentPath ? parentPath + '.' + part : part
    const node: JsonNode = {
      rootElement: rootContent,
      expression,
      name: part,
      fullPath: finalPath,
      parentElement: currentNode,
      element,
      setValue: (replaceValue: any) => {
        if (replaceValue == undefined || replaceValue == null) {
          logger.trace('Delete node', {
            expression,
            finalPath,
            part,
            currentNode,
          })
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
      },
      getValue: () => {
        return currentNode[part]
      },
    }
    nodes.push(node)
  }
}
