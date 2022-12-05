import fspath from 'path'

import { LogLevel } from '@/logging'
export const ROOT_DIR = fspath.resolve('.')

export type HasDefaultSrcAndDest = {
  defaultSrc: string
  defaultDest: string
}

export type HasLogLevel = {
  logLevel: LogLevel
}

export type HasDryRun = {
  dryRun: boolean
}

//custom label to attach to a config for logging
export type HasLoggingLabel = {
  label?: string
}

export type HasExtends = {
  extends: string
}

export type MergeConfig = Partial<HasLogLevel> &
  Partial<HasExtends> & {
    //configs to run before this one
    runBefore?: string | string[]
    //configs to run after this ones
    runAfter?: string | string[]
    copyFiles?: CopyTaskItem[]
    deleteFiles?: DeleteTaskItem[]
    updateFiles?: UpdateTaskItem[]
  }
export type PackageJson = {
  [key: string]: Partial<MergeConfig> & Partial<HasDefaultSrcAndDest>
}

export type HasSrcDir = { dir: string }
export type HasSrcInclude = Partial<HasSrcDir> & { include?: string | string[] }
export type HasDestDir = { dest: string }
export type HasTarget = { target: string }
export type HasPackageDependency = { fromPackage: string }
export type HasRequired = { required: boolean }

export type CopyTaskItem = HasSrcInclude &
  Partial<HasDestDir> &
  Partial<HasTarget> &
  Partial<HasPackageDependency> &
  Partial<HasRequired> &
  HasLoggingLabel & {
    //if set to false, then if the target exists, don't overwrite
    overwrite?: boolean
  }

export type DeleteTaskItem = HasSrcInclude & HasLoggingLabel

export type UpdateTaskItem = HasSrcInclude &
  Partial<HasDestDir> &
  Partial<HasTarget> &
  Partial<HasPackageDependency> &
  Partial<HasRequired> &
  HasLoggingLabel & {
    // which matcher to
    expressionType?: 're' | 'text' | 'json' | 'property'
    // the match expression. If an array, then they are treated as indiviual expressions
    expression: string | string[]
    //what to replace any matches with
    value?: any
    //what the file encoding is
    encoding?: BufferEncoding
    //if set, and no value set, then use this file as the value source
    fromFile?: string
    //if set, then use this expression to extract the value from the file, otherwise, use the expression
    fromExpression?: string
    fromExpressionType?: string
    stratagey?: 'merge' | 'replace'
  }

export type CopyTarget = { src: string; target: string }
