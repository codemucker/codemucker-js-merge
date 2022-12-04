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
    //parent configs to apply
    applyBefore?: string | string[]
    applyAfter?: string | string[]
    packageJson?: MergePackageJsonConfig
    copy?: CopyTaskItem[]
    delete?: DeleteTaskItem[]
    update?: UpdateTaskItem[]
  }
export type PackageJson = {
  [key: string]: Partial<MergeConfig> & Partial<HasDefaultSrcAndDest>
}

export type HasSrcDir = { dir: string }
export type HasSrcInclude = Partial<HasSrcDir> & { include?: string | string[] }
export type HasDestDir = { dest: string }
export type HasTarget = { target: string }
export type HasPackageDependency = { package: string }
export type HasRequired = { required: boolean }

export type CopyTaskItem = HasSrcInclude &
  Partial<HasDestDir> &
  Partial<HasTarget> &
  Partial<HasPackageDependency> &
  Partial<HasRequired> &
  HasLoggingLabel & {
    //if set to false, then if the target exists, don't overwrite
    overwite?: boolean
  }

export type DeleteTaskItem = HasSrcInclude & HasLoggingLabel

export type UpdateTaskItem = HasSrcInclude &
  Partial<HasDestDir> &
  Partial<HasTarget> &
  Partial<HasRequired> &
  HasLoggingLabel & {
    // which matcher to
    expressionType?: 're' | 'text' | 'json'
    // the match expression
    expression: string
    //what to replace any matches with
    value?: any
    //what the file encoding is
    encoding?: BufferEncoding
  }
export type SanitisePackageJsonTaskConfig = {
  dest?: string
  excludeNodes?: string[]
  replaceNodes?: { [pathExpression: string]: string | null | undefined }
}
export type MergePackageJsonConfig = {
  dest?: string
  includeNodes?: string[]
  excludeNodes?: string[]
}

export type CopyTarget = { src: string; target: string }
