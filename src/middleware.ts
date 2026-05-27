import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Middleware — chạy trước mọi request (page + API).
 * Vai trò chính: Refresh Supabase auth session để Server Components /
 * Server Actions luôn có session hợp lệ.
 * Không có file này → session cookie hết hạn → bị logout khi F5 hoặc
 * điều hướng trực tiếp vào trang được bảo vệ.
 */
export async function middleware(request: NextRequest) {
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

  // Quan trọng: gọi getUser() để refresh session token nếu đã hết hạn.
  // Kết quả không cần dùng ở đây — side-effect refresh là điều quan trọng.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/ktv') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/hq');

  // Cho phép mock user trong môi trường development
  const mockUserEmail = request.cookies.get('mock_user_email')?.value;
  const isMockDev = process.env.NODE_ENV === 'development' && !!mockUserEmail;

  if (isProtectedRoute && !user && !isMockDev) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Chạy trên tất cả routes NGOẠI TRỪ:
     * - Next.js internals (_next/static, _next/image)
     * - static assets (favicon, svg, png, jpg, ...)
     * - API routes bắt đầu với /api/  (có auth riêng)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
