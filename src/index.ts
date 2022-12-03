import chalk from 'chalk'
import glob from 'fast-glob'
import fs from 'fs-extra'
import fspath from 'path'

// Links:
//  - https://www.sensedeep.com/blog/posts/2021/how-to-create-single-source-npm-module.html
//
type PackageJson = {
  '@codemucker/install'?: {
    inherit?: string
    packageJson?: MergePackageJsonConfig
    copy?: CopyConfig[]
    delete?: DeleteConfig[]
    update?: UpdateConfig[]
    debug?: boolean
  }
  '@codemucker/dist'?: {
    inherit?: string
    packageJson?: SanitisePackageJsonConfig
    copy?: CopyConfig[]
    delete?: DeleteConfig[]
    update?: UpdateConfig[]
    debug?: boolean
  }
}

const ROOT_DIR = fspath.resolve('.')

type HasSrcDir = { dir: string }
type HasSrcInclude = Partial<HasSrcDir> & { include?: string | string[] }
type HasDestDir = { dest: string }
type HasTarget = { target: string }

type CopyConfig = HasSrcInclude & Partial<HasDestDir> & Partial<HasTarget>
type DeleteConfig = HasSrcInclude
type UpdateConfig = HasSrcInclude &
  Partial<HasDestDir> &
  Partial<HasTarget> & {
    matchType?: 're' | 'text' | 'json'
    match: string
    replace?: any
    encoding?: BufferEncoding
  }
type SanitisePackageJsonConfig = {
  dest?: string
  excludeNodes?: string[]
  replaceNodes?: { [pathExpression: string]: string | null | undefined }
}
type MergePackageJsonConfig = {
  dest?: string
  includeNodes?: string[]
  excludeNodes?: string[]
}

type CopyTarget = { src: string; target: string }

//various default groups one can chose from
const DEFAULTS = {
  distNone: {
    debug: false,
    packageJson: undefined,
    copy: [],
    modify: [],
  },
  installNone: {
    debug: false,
    packageJson: undefined,
    copy: [],
    modify: [],
  },
  '@codemucker/dist/mixed': {
    debug: true,
    inherit: undefined,
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
        '@codemucker/dist',
        '@codemucker/install',
      ] as string[],
      replaceNodes: {} as { [expression: string]: string },
    },
    copy: [
      { dir: 'build/mjs/src', dest: 'build/release/dist/mjs' },
      { dir: 'build/cjs/src', dest: 'build/release/dist/cjs' },
      {
        include: ['LICENSE', 'README*', 'package.json'],
        dest: 'build/release/',
      },
      { dir: 'src/', dest: 'build/release/src/' },
      {
        include: 'src/cjs.package.json',
        target: 'build/release/dist/cjs/package.json',
      },
      {
        include: 'src/mjs.package.json',
        target: 'build/release/dist/mjs/package.json',
      },
    ],
    delete: [],
    update: [
      {
        dir: 'build/release/',
        include: '**.js.map',
        matchType: 'text',
        match: '../../',
        replace: '',
      },
      // {
      //   include: 'build/release/package.json',
      //   matchType: 'json',
      //   match: 'private',
      //   replace: true,
      // },
    ] as UpdateConfig[],
    defaultSrc: './',
    defaultDest: 'build/release/',
  },
  '@codemucker/install': {
    debug: true,
    inherit: undefined,
    packageJson: {
      dest: 'package.json',
      excludeNodes: ['name', 'repository', 'keywords', 'description'],
      replaceNodes: {},
    },
    copy: [],
    modify: [],
  },
}

const distDefaults = DEFAULTS['@codemucker/dist/mixed']

const packageJson: PackageJson = JSON.parse(
  fs.readFileSync('package.json', 'utf8')
)

const distConfig = packageJson['@codemucker/dist'] || distDefaults

const logEnabled =
  distConfig?.debug == undefined
    ? distDefaults.debug
    : distConfig?.debug === true || (distConfig?.debug as any) == 'true'

module task {
  //TODO:prevent accessing outside of package dir

  export async function copyFiles(copySources: CopyConfig[]) {
    log.info('copy files')
    const files: CopyTarget[] = []
    for (const srcEntry of copySources) {
      const found = await util.findFiles(srcEntry)
      files.push(...found)
    }
    for (const entry of files) {
      log.info('copying ' + entry.src + ' to ' + entry.target)
      util.checkWithinRootDirOrThrow(entry.src)
      util.checkWithinRootDirOrThrow(entry.target)
      await fs.copy(entry.src, entry.target, { preserveTimestamps: true })
    }

    log.trace('copy files done')
  }

  export async function deleteFiles(deleteSources: DeleteConfig[]) {
    const files: CopyTarget[] = []
    for (const srcEntry of deleteSources) {
      const found = await util.findFiles(srcEntry)
      files.push(...found)
    }
    for (const entry of files) {
      log.info('deleting ' + entry.src)
      util.checkWithinRootDirOrThrow(entry.src)
      await fs.remove(fspath.resolve(entry.src))
    }
  }

  export async function sanitisePackageJson(
    config?: SanitisePackageJsonConfig
  ) {
    if (!config || !config.dest || config.dest.length == 0) {
      return
    }
    log.trace('sanitise package.json')

    const path = config.dest
    if (!(await fs.pathExists(path))) {
      log.warn('No ' + path + ', skipping sanitise')
      return
    }

    const replaceNodes = Object.assign(
      {},
      config.replaceNodes || distDefaults.packageJson.replaceNodes
    )

    //convert the excludes into replace with 'null'
    const excludeNodes =
      config.excludeNodes || distDefaults.packageJson.excludeNodes
    excludeNodes.forEach((path) => {
      replaceNodes[path] = null
    })

    const content = JSON.parse(await fs.readFile(path, 'utf8'))
    util.replaceNodes(content, replaceNodes)
    const newContent = JSON.stringify(content, null, 2)
    //log.info('newContent', newContent)

    await fs.writeFile(path, newContent)
    log.info('wrote sanitised ' + path)

    log.trace('sanitise package.json done')
  }

  export async function updateFiles(updates: UpdateConfig[]) {
    log.trace('update files')
    let index = -1
    for (const update of updates) {
      index++
      if (!update.match || update.match.length == 0) {
        log.warn(`No 'find' for update [${index}]`, JSON.stringify(update))
        return
      }
      const files = await util.findFiles(update)
      for (const entry of files) {
        const srcContent: string = await fs.readFile(entry.src, {
          encoding: update.encoding || 'utf-8',
        })
        let newContent = srcContent

        if (
          !update.matchType ||
          update.matchType == 'text' ||
          update.matchType == 're'
        ) {
          const findExpression =
            update.matchType == 're'
              ? new RegExp(update.match, 'g')
              : update.match

          newContent = srcContent.replace(findExpression, update.replace || '')
        } else if (update.matchType == 'json') {
          const jsonContent = JSON.parse(srcContent)
          const replaceNodes = {} as {
            [expression: string]: any
          }
          replaceNodes[update.match] = update.replace

          util.replaceNodes(jsonContent, replaceNodes)

          newContent = JSON.stringify(jsonContent, null, 2)
        } else {
          throw new Error(`Unknown matcher type '${update.matchType}'`)
        }

        if (srcContent != newContent) {
          await fs.writeFile(entry.src, newContent)
          log.info('updated ' + entry.target)
        }
      }
    }

    log.trace('update files done')
  }
}

module util {
  export function checkWithinRootDirOrThrow(path: string) {
    const fullPath = fspath.resolve(path)
    if (!fullPath.startsWith(ROOT_DIR)) {
      const errMsg = `Path '${fullPath}' (from '${path}') is not within the project root dir '${ROOT_DIR}'. Bailing as this looks malicious or a bug`
      log.error(errMsg)
      throw new Error(errMsg)
    }
  }
  export async function findFiles(
    include: HasSrcInclude & Partial<HasDestDir> & Partial<HasTarget>
  ): Promise<CopyTarget[]> {
    const cleanInclude = sanitiseInclude(include)
    const found = await glob(cleanInclude.includes, { cwd: cleanInclude.dir })

    const results: CopyTarget[] = []
    for (const file of found) {
      const src = cleanInclude.dir + file
      //override the target if manually set
      const target = include.target || cleanInclude.dest + file
      results.push({ src, target })
    }
    return results
  }

  function sanitiseInclude(
    include: HasSrcInclude & Partial<HasDestDir>
  ): HasSrcDir & HasDestDir & { includes: string[] } {
    const dir = ensureEndsWithSlash(include.dir || distDefaults.defaultSrc)
    const dest = ensureEndsWithSlash(include.dest || distDefaults.defaultDest)

    let includes: string[]
    if (typeof include.include == 'string') {
      includes = [include.include]
    } else if (Array.isArray(include.include)) {
      includes = include.include
    } else {
      includes = ['*', '**/*']
    }

    return { dir, dest, includes }
  }

  function ensureEndsWithSlash(s: string): string {
    if (!s.endsWith('/')) {
      return s + '/'
    }
    return s
  }

  export function replaceNodes(
    content: any,
    replaceNodes: { [expression: string]: any }
  ) {
    for (const expression in replaceNodes) {
      let node = content
      const parts = expression.split('.')
      parts.forEach((part, index) => {
        if (node == undefined || node == null) {
          return
        }
        const last = index == parts.length - 1
        if (last) {
          const replaceValue = replaceNodes[expression]
          if (replaceValue == undefined || replaceValue == null) {
            log.trace(`Delete node '${expression}'`)
            delete node[part]
          } else {
            log.trace(`Replace node '${expression}' with ${replaceValue}`)
            node[part] = replaceValue
          }
        }
      })
    }
  }
}

module log {
  export function trace(...args: any) {
    if (!logEnabled) {
      return
    }
    console.log(chalk.grey('[merge.ts] [TRACE]', ...args))
  }

  export function info(...args: any) {
    if (!logEnabled) {
      return
    }
    console.log('[merge.ts]', ...args)
  }

  export function warn(...args: any) {
    console.log(chalk.magenta('[merge.ts] [WARN]', ...args))
  }

  export function error(...args: any) {
    console.log(chalk.red('[merge.ts] [ERROR]', ...args))
  }
}

async function main() {
  await task.copyFiles(distConfig?.copy || distDefaults.copy)
  await task.sanitisePackageJson(
    distConfig.packageJson || distDefaults.packageJson
  )
  await task.updateFiles(distConfig.update || distDefaults.update)
}

main().then(() => log.trace('done'))
