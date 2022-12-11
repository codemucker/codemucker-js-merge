import { spawn, SpawnOptions, ChildProcess } from 'child_process'
import { log } from '@/logging.js'

describe('test deploy', () => {
  test('can link', async () => {
    // await runCmd({ label: 'link parent', cmd: 'pnpm link', cwd: '.' })
    // await runCmd({
    //   label: 'link child',
    //   cmd: 'pnpm link',
    //   cwd: 'test/test-package',
    // })
    await runCmd({ label: 'test run', cmd: 'echo', cmdArgs:['"hello, world!"'], cwd: '.' })
  })
})

async function runCmd(
  opts: SpawnOptions & {
    label: string
    cmd: string
    cmdArgs?: ReadonlyArray<string>
  }
): Promise<CommandResponse | undefined> {
  return new Promise<CommandResponse>((resolve, reject) => {
    const process = spawn(opts.cmd, opts.cmdArgs, { cwd: opts.cwd })
    const logName = (opts.label || opts.cmd).replaceAll(/\s+/g,'-')
    const spawnLog = log.getSubLogger({ name: logName })
    
    spawnLog.info(
      `Running cmd '${opts.cmd} ${opts.cmdArgs || []}' in cwd '${opts.cwd}'`
    )

    process.stdout.on('data', (dataBuffer) => {
      spawnLog.info(dataBuffer.toString())
    })
    process.stderr.on('data', (dataBuffer) => {
      spawnLog.warn(dataBuffer.toString())
    })
    process.on('error', (error) => {
      spawnLog.error({ error })
      reject(
        new Error(
          `Error running process '${opts.cmd} ${opts.cmdArgs || []}' in cwd '${
            opts.cwd
          }'`,
          { cause: error }
        )
      )
    })
    process.on('close', (code) => {
      log.debug(`child process exited with code ${code}`)
      resolve({ process })
    })
  })
}

type CommandResponse = {
  process: ChildProcess
}
