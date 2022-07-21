import path from 'path'
import os from 'os'
import url from 'url'
import shell from 'shelljs'
import { LocalProgramArgs, LocalWorkspace, Stack, UpResult } from '@pulumi/pulumi/automation'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const usage = 'Usage: npm run start -- <option>[destroy|up] <environment>[local]'

const flags = process.argv.slice(2)
if (flags.length !== 2) {
  throw new Error(`Bad arguments. ${usage}`)
}

const option = flags[0]
const supportedOptions = ['destroy', 'up']
if (!supportedOptions.includes(option)) {
  throw new Error(`Unsupported option '${option}'. ${usage}`)
}

const environment = flags[1]
const supportedEnvironments = ['local', 'dev']
if (!supportedEnvironments.includes(environment)) {
  throw new Error(`Unsupported environment '${environment}'. ${usage}`)
}

const projects: string[] = ['invoice-app', 'payment-provider']
for (const p of projects) {
  const workDir: string = path.resolve(__dirname, '..', p, 'iac')
  if (environment === 'local') {
    console.info('[INFO] Installing local filesystem Pulumi backend...')
    shell.exec(`export PULUMI_CONFIG_PASSPHRASE=password && pulumi login file://${workDir}`)
  }
  const username: string = os.userInfo().username
  const lpa: LocalProgramArgs = {
    stackName: `${username}-${environment}`,
    workDir: workDir,
  }
  const s: Stack = await LocalWorkspace.createOrSelectStack(lpa)
  console.info('[INFO] Installing Node dependencies...')
  shell.exec(`cd ${workDir} && npm ci`)
  console.info('[INFO] Refreshing stack...')
  await s.refresh({ onOutput: console.info })
  if (option === 'destroy') {
    console.info('[INFO] Destroying stack...')
    await s.destroy({ onOutput: console.info })
  } else {
    console.info('[INFO] Upping stack...')
    const ur: UpResult = await s.up({ onOutput: console.info })
    console.log(`update summary: \n${JSON.stringify(ur.summary.resourceChanges, null, 4)}`)
  }
}
shell.exec('pulumi logout &>/dev/null')
