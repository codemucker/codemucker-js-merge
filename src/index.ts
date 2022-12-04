import { LogLevel } from '@/logging'
import { program } from 'commander'
import fs from 'fs-extra'
import { log, setLogLevel } from '@/logging'
import {
  PackageJson,
  HasDestDir,
  HasSrcDir,
  MergeConfig,
  HasDryRun,
} from '@/model'
import { getMergedConfig } from '@/util'
import * as task from '@/tasks'

// Links:
//  - https://www.sensedeep.com/blog/posts/2021/how-to-create-single-source-npm-module.html
//

//const distDefaults = defaults['@codemucker/merge/dist']

const packageJson: PackageJson = JSON.parse(
  fs.readFileSync('package.json', 'utf8')
)

async function main(
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
    appliedConfigs: [],
    dryRun: opts.dryRun,
  })
}

async function runConfig(opts: {
  config: MergeConfig
  configKey: string
  defaults: HasDestDir & HasSrcDir
  dryRun: boolean
  appliedConfigs: string[]
}) {
  const configKey = opts.configKey
  const config = opts.config
  log.debug(`in config: '${opts.configKey}'...`)
  log.trace({ config })

  //prevent inifinite loops
  if (opts.appliedConfigs.includes(configKey)) {
    log.warn(
      `Recursive config found '${configKey}', ignoring. Config path: ${opts.appliedConfigs}`
    )
    return
  }
  opts.appliedConfigs.push(configKey)

  //before configs
  const applyBefore = config.applyBefore
  if (applyBefore) {
    log.debug('applyBefore:', applyBefore)
    for (const beforeConfigKey of applyBefore) {
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
      items: config.copy,
      defaults: opts.defaults,
      dryRun: opts.dryRun,
    })
    await task.sanitisePackageJson({
      config: config.packageJson,
      dryRun: opts.dryRun,
    })
    await task.updateFiles({
      items: config.update,
      defaults: opts.defaults,
      dryRun: opts.dryRun,
    })
  }

  //after configs
  const applyAfter = config.applyAfter
  if (applyAfter) {
    log.debug('applyAfter:', applyAfter)
    for (const afterConfigKey of applyAfter) {
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
    "(TODO) If set, don't actually apply any changes, just print what would have changed"
  )
  .action(async (configKey: string, commandOptions: any) => {
    const logLevel = program.opts()['logLevel']
    const dryRun = commandOptions['dryRun'] == true

    await main({
      configKey: `@codemucker/merge/${configKey}`,
      logLevel,
      dryRun,
    })
  })

program
  .command('defaults')
  .description('print out the defaults values for the given key')
  .argument(
    '[config]',
    `(TODO) the config (key) to lokup the defaults for. Looks for a node '@codemucker/merge/<config>'`,
    '*'
  )
  .action(async (_configKey: string) => {})

program
  .command('keys')
  .description('(TODO) print out all the available config keys')
  .action(async (_configKey: string) => {})

program.parse()
