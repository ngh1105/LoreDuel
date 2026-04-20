import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stitch } from '@google/stitch-sdk'

const prompt = [
  'Design a desktop game interface for "LoreDuel", a fantasy duel game with GenLayer integration.',
  'The first viewport should feel like a dark mythic opera chamber with blue moonlight and ember accents.',
  'Include a strong hero area, a visible Connect Wallet call to action, two rival character panels, a move selection grid, an oracle verdict feed, and a chronicle/history panel.',
  'The experience should feel premium, dramatic, editorial, and game-like rather than dashboard-like.',
  'Use bold typography, minimal card clutter, and high contrast for readability.',
  'Make it suitable for implementation in Next.js.',
].join(' ')

async function main() {
  const outputDir = join(process.cwd(), 'stitch-output')
  await mkdir(outputDir, { recursive: true })

  const project = await stitch.createProject('LoreDuel')
  const screen = await project.generate(prompt, 'DESKTOP')
  const htmlUrl = await screen.getHtml()
  const imageUrl = await screen.getImage()

  const summary = {
    generatedAt: new Date().toISOString(),
    projectId: project.projectId,
    screenId: screen.screenId,
    prompt,
    htmlUrl,
    imageUrl,
  }

  await writeFile(
    join(outputDir, 'loreduel-screen.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  )

  console.log(`projectId=${project.projectId}`)
  console.log(`screenId=${screen.screenId}`)
  console.log(`htmlUrl=${htmlUrl}`)
  console.log(`imageUrl=${imageUrl}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
