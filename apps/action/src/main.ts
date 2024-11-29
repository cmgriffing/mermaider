import * as core from '@actions/core'
import childProcess from 'node:child_process'
import { createRequire } from 'node:module'

import typedCore from './typed-core'

const createdRequire = createRequire(import.meta.url)
const mermaiderCliPath = createdRequire.resolve('@mermaider/cli/dist/index.js')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const pathToParse = typedCore.getInput('path')

    const mermaiderResult = childProcess.spawnSync(
      process.argv[0],
      [mermaiderCliPath, 'parse', pathToParse],
      {
        stdio: 'inherit'
      }
    )

    if (mermaiderResult.status !== 0) {
      throw new Error('Mermaider CLI failed to generate diagrams')
    }

    childProcess.spawnSync('git', ['add', '.'], {
      stdio: 'inherit'
    })
    childProcess.spawnSync(
      'git',
      ['commit', '-m', 'chore: update mermaid diagrams'],
      {
        stdio: 'inherit'
      }
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}
