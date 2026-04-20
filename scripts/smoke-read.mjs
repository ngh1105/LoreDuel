import { readFile } from 'node:fs/promises'
import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'

const deployment = JSON.parse(
  await readFile(new URL('../deployment/studionet-latest.json', import.meta.url), 'utf8'),
)

const client = createClient({
  chain: studionet,
  endpoint: deployment.rpc,
})

const result = await client.readContract({
  address: deployment.contractAddress,
  functionName: 'get_last_verdict',
  args: [],
})

console.log(JSON.stringify({
  network: deployment.network,
  contractAddress: deployment.contractAddress,
  verdict: result,
}, null, 2))
