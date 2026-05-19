import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Next.js 16 proxy: runs on every request BEFORE page/API handlers.
// REQUIRED for Supabase SSR — refreshes the auth session so Server Actions
// can reliably call supabase.auth.getUser() without getting null.
export async function proxy(request: NextRequest) {
  console.log("[Proxy] PATH:", request.nextUrl.pathname);
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

  // Calling getUser() triggers token refresh if the JWT is expired.
  // Do NOT remove this — it keeps sessions alive for Server Actions.
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log("[Proxy] User refresh:", !!user, error?.message);

  return response;
}

// Next.js 16/Turbopack compatibility exports
export async function middleware(request: NextRequest) {
  return proxy(request);
}

export default proxy;

export const config = {
  matcher: [
    // Run on all routes EXCEPT Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
