import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: '/:path*',
}
