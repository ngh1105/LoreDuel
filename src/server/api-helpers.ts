export function getClientId(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export function isAuthorized(req: Request, tokenEnvKey: string): boolean {
  const token = process.env[tokenEnvKey]
  if (!token) return true
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${token}`
}
