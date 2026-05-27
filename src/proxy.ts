import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Next.js 16 proxy (formerly middleware): runs before page/API handlers
// on the routes matched by `config.matcher` below. Used to refresh the
// Supabase auth session cookie so Server Actions in /dashboard and /ktv
// can read a fresh user without an extra round-trip.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const mockUserEmail = request.cookies.get('mock_user_email')?.value;
  const isMockDev = process.env.NODE_ENV === 'development' && !!mockUserEmail;

  if (!user && !isMockDev) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

// Next.js still recognizes the `middleware` export name as a deprecated alias.
export async function middleware(request: NextRequest) {
  return proxy(request);
}

export default proxy;

export const config = {
  // Only run on routes that require an authenticated session.
  // Portal (/portal/[token]) is intentionally excluded — customers access
  // it via magic-link tokens, not Supabase Auth.
  matcher: ['/dashboard/:path*', '/ktv/:path*'],
};
