import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 1. Khởi tạo Supabase client chuẩn cho middleware
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

  // 2. Làm mới session và lấy thông tin user hiện tại
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const mockEmail = request.cookies.get('mock_user_email')?.value;

  const isDashboardRoute = url.pathname.startsWith('/dashboard');
  const isKtvRoute = url.pathname.startsWith('/ktv');
  const isLoginRoute = url.pathname === '/login';

  // 3. Nếu chưa đăng nhập và không dùng bypass mock email trong development
  if (!user && !mockEmail) {
    if (isDashboardRoute || isKtvRoute) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // 4. Lấy vai trò (role) của người dùng
  let role: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    role = profile?.role?.toLowerCase() || null;
  } else if (mockEmail && process.env.NODE_ENV === 'development' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Development bypass: sử dụng service_role_key để truy cập thông tin vai trò từ DB
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );
    const { data: profile } = await adminSupabase
      .from('users')
      .select('role')
      .eq('email', mockEmail)
      .single();
    role = profile?.role?.toLowerCase() || null;
  }

  // 5. Chuyển hướng bảo vệ route dựa trên role
  if (isDashboardRoute) {
    if (role === 'ktv') {
      url.pathname = '/ktv/dashboard';
      return NextResponse.redirect(url);
    }
  }

  if (isKtvRoute) {
    if (role && role !== 'ktv') {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  if (isLoginRoute) {
    url.pathname = role === 'ktv' ? '/ktv/dashboard' : '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/ktv/:path*', '/login'],
};
