import { log, LogLevel, setLogLevel } from '@/logging'
import {
  HasDestDir,
  HasDryRun,
  HasSrcDir,
  MergeConfig,
  PackageJson,
  ROOT_DIR,
} from '@/model'
import { taskRunners } from '@/tasks'
import { getMergedConfig } from '@/util'
import { program } from 'commander'
import fs from 'fs-extra'
import { defaults } from './defaults'

const packageJson: PackageJson = JSON.parse(
  fs.readFileSync(ROOT_DIR + '/package.json', 'utf8')
)

async function commandRun(
  opts: {
    configKey: string
    logLevel?: LogLevel
  } & HasDryRun
) {
  //forced via the commandline
  if (opts.logLevel) {
    setLogLevel(opts.logLevel)
  }
  const config = getMergedConfig(packageJson, opts.configKey)
  const defaultsDrs = {
    srcDir: config.defaultSrc,
    dest: config.defaultDest,
  }

  //use the defaults before, change based on the current config. Ignore if forced via the commandline
  if (!opts.logLevel) {
    setLogLevel(config.logLevel)
  }

  await runConfig({
    config,
    configKey: opts.configKey,
    defaults: defaultsDrs,
    configsRun: [],
    dryRun: opts.dryRun,
  })
}

async function runConfig(opts: {
  config: MergeConfig
  configKey: string
  defaults: HasDestDir & HasSrcDir
  dryRun: boolean
  configsRun: string[]
}) {
  const configKey = opts.configKey
  const config = opts.config
  log.debug(`in config: '${opts.configKey}'...`)
  log.trace({ config })

  //prevent inifinite loops
  if (opts.configsRun.includes(configKey)) {
    log.warn(
      `Recursive config found '${configKey}', ignoring. Config path: ${opts.configsRun}`
    )
    return
  }
  opts.configsRun.push(configKey)

  //before configs
  const preConfigs = config.preConfigs
  if (preConfigs) {
    const keys = typeof preConfigs == 'string' ? [preConfigs] : preConfigs
    log.debug('preConfigs', { preConfigs })
    for (const beforeConfigKey of keys) {
      const beforeConfig = getMergedConfig(packageJson, beforeConfigKey)
      await runConfig({
        ...opts,
        config: beforeConfig,
        configKey: beforeConfigKey,
      })
    }
  }

  //main config
  log.info(`running config: '${configKey}'...`)
  const runTasks = config.tasks || []
  for (const task of runTasks) {
    const runner = taskRunners[task.task]
    if (!runner) {
      const errMsg = `No task runner for task type '${task.task}'`
      log.fatal(errMsg, { task, config })
      throw new Error(errMsg)
    }
    await runner({
      taskConfig: task,
      defaults: opts.defaults,
      dryRun: opts.dryRun,
      currentKey: configKey,
    })
  }

  //after configs
  const postConfigs = config.postConfigs
  if (postConfigs) {
    const keys = typeof postConfigs == 'string' ? [postConfigs] : postConfigs
    log.debug('preConfigs:', { postConfigs })
    for (const afterConfigKey of keys) {
      const afterConfig = getMergedConfig(packageJson, afterConfigKey)
      await runConfig({
        ...opts,
        config: afterConfig,
        configKey: afterConfigKey,
      })
    }
  }

  log.trace(`done running config: '${configKey}'...`)
}

program
  .name('codemucker-merge')
  .description('merge/copy files/directories/packages')
  .version('0.0.0')
  //global options. Get via 'program.opts()'
  .option('-l, --log-level [logLevel]', 'Force the log level')

program
  .command('run')
  .description('run the given merge')
  .argument(
    '<config>',
    `the config (key) to run. Looks for a node '@codemucker/merge/<config>'`
  )
  .option(
    '--dry-run',
    "If set, don't actually apply any changes, just print what would have changed"
  )
  .action(async (configKey: string, commandOptions: any) => {
    const logLevel = program.opts()['logLevel']
    const dryRun = commandOptions['dryRun'] == true

    await commandRun({
      configKey,
      logLevel,
      dryRun,
    })

    log.info('complete')
  })

program
  .command('values')
  .description('print out the default values for the given key')
  .argument(
    '[config]',
    `the config (key) to lookup the defaults for. Looks for a node '@codemucker/merge/<config>'. Or use '*' to show all configs`,
    '*'
  )
  .action(async (configKey: string) => {
    const keys = configKey == '*' ? Object.keys(defaults) : [configKey]
    for (const key of keys) {
      console.log(`Config for '${key}':`)
      const config = getMergedConfig(packageJson, key)
      console.log(config)
    }
  })

program
  .command('keys')
  .description('print out all the available config keys')
  .action(async (_configKey: string) => {
    console.log('available default configs:')
    for (const [key] of Object.entries(defaults)) {
      console.log(`   ${key}`)
    }
  })

program.parse()
