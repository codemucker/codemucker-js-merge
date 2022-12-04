import { Logger as TsLogger } from 'tslog'

export type Logger = TsLogger<unknown>
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

const defaultLevel = 'info'

const levelMap: { [level: string]: number } = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
}

export const log = new TsLogger({
  name: 'merge',
  type: 'pretty',
  prettyLogTemplate: '{{logLevelName}} [{{name}}]',
  minLevel: levelMap[defaultLevel],
})

export function setLogLevel(level?: LogLevel) {
  log.settings.minLevel = level
    ? levelMap[level.toLocaleLowerCase().trim()] || levelMap[defaultLevel]
    : levelMap[defaultLevel]
}
