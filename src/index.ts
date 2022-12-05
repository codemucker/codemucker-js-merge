import { defaults } from './defaults'
import { log, LogLevel, setLogLevel } from '@/logging'
import {
  HasDestDir,
  HasDryRun,
  HasSrcDir,
  MergeConfig,
  PackageJson,
  ROOT_DIR,
} from '@/model'
import * as task from '@/tasks'
import { getMergedConfig } from '@/util'
import { program } from 'commander'
import fs from 'fs-extra'

// Links:
//  - https://www.sensedeep.com/blog/posts/2021/how-to-create-single-source-npm-module.html
//

//const distDefaults = defaults['@codemucker/merge/dist']

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
    dir: config.defaultSrc,
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
  const runBefore = config.runBefore
  if (runBefore) {
    const keys = typeof runBefore == 'string' ? [runBefore] : runBefore
    log.debug('runBefore', { runBefore })
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
  {
    await task.copyFiles({
      items: config.copyFiles,
      defaults: opts.defaults,
      dryRun: opts.dryRun,
      currentKey: configKey,
    })
    await task.deleteFiles({
      items: config.deleteFiles,
      defaults: opts.defaults,
      dryRun: opts.dryRun,
      currentKey: configKey,
    })
    await task.updateFiles({
      items: config.updateFiles,
      defaults: opts.defaults,
      dryRun: opts.dryRun,
      currentKey: configKey,
    })
  }

  //after configs
  const runAfter = config.runAfter
  if (runAfter) {
    const keys = typeof runAfter == 'string' ? [runAfter] : runAfter
    log.debug('runAfter:', { runAfter })
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
      configKey: `@codemucker/merge/${configKey}`,
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
