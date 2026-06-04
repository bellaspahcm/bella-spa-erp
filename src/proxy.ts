import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { requireSupabasePublicEnv } from '@/lib/supabase-public-env';

// Next.js 16 proxy (formerly middleware): runs before page/API handlers
// on the routes matched by `config.matcher` below. Used to refresh the
// Supabase auth session cookie, handle server-side authorization check (triệt tiêu ui-flicker),
// and inject mock headers in local dev bypass mode.
export async function proxy(request: NextRequest) {
  const { url, publicKey } = requireSupabasePublicEnv();

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    url,
    publicKey,
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

  // 1. Khởi tạo & Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  const mockUserEmail = request.cookies.get('mock_user_email')?.value;
  const isMockDev = process.env.NODE_ENV === 'development' && !!mockUserEmail;

  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isKtvRoute = request.nextUrl.pathname.startsWith('/ktv');
  const isLoginRoute = request.nextUrl.pathname === '/login';

  // 2. Security Redirects: Chưa đăng nhập truy cập trang cần bảo vệ
  if (!user && !isMockDev) {
    if (isDashboardRoute || isKtvRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // 3. Đã đăng nhập: Lấy vai trò (role) của người dùng từ database
  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    role = profile?.role?.toLowerCase() || null;
  } else if (isMockDev && mockUserEmail && getSupabaseAdminKey()) {
    // Development bypass: sử dụng service_role_key để truy cập thông tin vai trò từ DB
    const { createClient: createAdmin } = await import('@supabase/supabase-js');
    const adminClient = createAdmin(
      getSupabaseAdminUrl(),
      getSupabaseAdminKey(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('email', mockUserEmail)
      .single();
    role = profile?.role?.toLowerCase() || null;
  }

  // 4. Kiểm tra phân quyền và điều hướng an toàn (Server-side Redirect)
  if (isDashboardRoute) {
    if (role === 'ktv') {
      const ktvDashboardUrl = new URL('/ktv/dashboard', request.url);
      return NextResponse.redirect(ktvDashboardUrl);
    }
  }

  if (isKtvRoute) {
    if (role && role !== 'ktv') {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (isLoginRoute) {
    const targetUrl = new URL(role === 'ktv' ? '/ktv/dashboard' : '/dashboard', request.url);
    return NextResponse.redirect(targetUrl);
  }

  // 5. Đang ở dev mock bypass, truyền header email giả lập cho server actions
  if (isMockDev && mockUserEmail) {
    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set('x-mock-user-email', mockUserEmail);
    return NextResponse.next({ request: { headers: modifiedHeaders } });
  }

  return response;
}

// Next.js still recognizes the `middleware` export name as a deprecated alias.
export async function middleware(request: NextRequest) {
  return proxy(request);
}

export default proxy;

export const config = {
  // Chỉ chạy trên các route được bảo vệ
  // Loại trừ trang Portal (/portal/[token]) của khách hàng vì truy cập qua magic links token.
  matcher: ['/dashboard/:path*', '/ktv/:path*', '/login'],
};
