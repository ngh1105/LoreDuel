import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

const execFileAsync = promisify(execFile)
const submissionId = `smoke-${Date.now().toString(36)}`

const deployment = JSON.parse(
  await readFile(new URL('../deployment/studionet-latest.json', import.meta.url), 'utf8'),
)

const writeArgs = [
  'write',
  '--rpc',
  deployment.rpc,
  deployment.contractAddress,
  'submit_turn',
  '--args',
  'Velis Atrium',
  'A flooded opera floor mirrors every motion in fractured moon glass.',
  'Glass Oath',
  'Mirror Feint',
  'bulwark',
  'trickster',
  'memory-1',
  submissionId,
]

const client = createClient({
  chain: studionet,
  endpoint: deployment.rpc,
})

const { stdout } = await runGenlayer(writeArgs)

const txHashMatch = stdout.match(/Write Transaction Hash:\s*\r?\n(0x[a-fA-F0-9]+)/)
const txHash = txHashMatch?.[1]

let verdict = null
for (let attempt = 0; attempt < 8; attempt += 1) {
  const result = await client.readContract({
    address: deployment.contractAddress,
    functionName: 'get_verdict',
    args: [submissionId],
  })

  if (String(result).trim()) {
    const parsed = JSON.parse(String(result))
    verdict = parsed
    break
  }

  await new Promise((resolve) => setTimeout(resolve, 3000))
}

if (!verdict) {
  throw new Error('Structured verdict did not become visible before timeout.')
}

console.log(
  JSON.stringify(
    {
      network: deployment.network,
      contractAddress: deployment.contractAddress,
      txHash,
      winner: verdict.winner,
      playerLoss: verdict.player_loss,
      rivalLoss: verdict.rival_loss,
      tacticalReason: verdict.tactical_reason,
    },
    null,
    2,
  ),
)

async function resolveGenlayerExecutable() {
  return 'genlayer'
}

async function runGenlayer(args) {
  if (process.platform === 'win32') {
    const command = `genlayer ${args.map(quoteForPowerShell).join(' ')}`
    return execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        cwd: process.cwd(),
        windowsHide: true,
      },
    )
  }

  return execFileAsync(await resolveGenlayerExecutable(), args, {
    cwd: process.cwd(),
    windowsHide: true,
  })
}

function quoteForPowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}
