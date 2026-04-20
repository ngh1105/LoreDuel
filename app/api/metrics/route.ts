import { NextResponse } from 'next/server'
import { getDataStats } from '../../../src/server/repository'

const startedAt = Date.now()

export async function GET() {
  const stats = await getDataStats()
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000)

  const lines = [
    '# HELP loreduel_up Process health status.',
    '# TYPE loreduel_up gauge',
    'loreduel_up 1',
    '# HELP loreduel_uptime_seconds Process uptime in seconds.',
    '# TYPE loreduel_uptime_seconds counter',
    `loreduel_uptime_seconds ${uptimeSeconds}`,
    '# HELP loreduel_profiles_total Number of profile records.',
    '# TYPE loreduel_profiles_total gauge',
    `loreduel_profiles_total ${stats.profiles}`,
    '# HELP loreduel_runs_total Number of run records.',
    '# TYPE loreduel_runs_total gauge',
    `loreduel_runs_total ${stats.runs}`,
    '# HELP loreduel_analytics_events_total Number of analytics events.',
    '# TYPE loreduel_analytics_events_total gauge',
    `loreduel_analytics_events_total ${stats.analytics}`,
    '# HELP loreduel_storage_backend Active storage backend mode.',
    '# TYPE loreduel_storage_backend gauge',
    `loreduel_storage_backend{mode="${stats.backend}"} 1`,
  ]

  return new NextResponse(`${lines.join('\n')}\n`, {
    status: 200,
    headers: {
      'content-type': 'text/plain; version=0.0.4',
      'cache-control': 'no-store',
    },
  })
}
