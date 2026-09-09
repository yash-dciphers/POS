import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

// Fast edge guard. Server pages/actions still validate the session against
// the database, but middleware keeps unauthenticated navigation out of the app shell.
export async function middleware(request: NextRequest) {
  // The scheduled renewal endpoint authenticates with CRON_SECRET instead
  // of a browser session, so it must reach its own authorization check.
  if (request.nextUrl.pathname === '/api/cron/renewal-alerts') {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
