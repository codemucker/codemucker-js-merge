//detecting package manager
import { ROOT_DIR } from '@/model.js'
import fs from 'fs-extra'

export type PkgManager = 'npm' | 'pnpm' | 'yarn'
let cachedPackageManager: PkgManager | undefined

export function getPackageManager(): PkgManager {
  if (!cachedPackageManager) {
    cachedPackageManager = findPackageManager()
  }
  return cachedPackageManager
}

function findPackageManager(): PkgManager {
  if (fs.existsSync(ROOT_DIR + '/pnpm-lock.yaml')) {
    return 'pnpm'
  } else if (fs.existsSync(ROOT_DIR + '/yarn-lock.yaml')) {
    return 'yarn'
  }
  if (fs.existsSync(ROOT_DIR + '/package-lock.yaml')) {
    return 'npm'
  }

  //try to detect from package.json
  const packageJson: { scripts?: { [name: string]: string } } = JSON.parse(
    fs.readFileSync(ROOT_DIR + '/package.json', 'utf8')
  )
  if (packageJson.scripts) {
    for (const [_name, script] of Object.entries(packageJson.scripts)) {
      if (script.includes('yarn')) {
        return 'yarn'
      }
      if (script.includes('pnpm')) {
        return 'pnpm'
      }
      if (script.includes('nppm')) {
        return 'npm'
      }
    }
  }

  return 'npm'
}
