/**
 * Static Login API Handler
 * 
 * Handles form submission from emergency static login page.
 * Uses traditional POST form data instead of JSON.
 */

import { createClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Lỗi Đăng Nhập</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #fee;
              margin: 0;
            }
            .error {
              background: white;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              max-width: 400px;
              text-align: center;
            }
            h1 { color: #c00; margin-bottom: 1rem; }
            a {
              display: inline-block;
              margin-top: 1rem;
              padding: 0.75rem 1.5rem;
              background: #ec4899;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Lỗi</h1>
            <p>Vui lòng nhập đầy đủ email và mật khẩu.</p>
            <a href="/login-static">← Quay lại</a>
          </div>
        </body>
        </html>
        `,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // Initialize Supabase
    const supabase = await createClient();

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Đăng Nhập Thất Bại</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #fee;
              margin: 0;
            }
            .error {
              background: white;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              max-width: 400px;
              text-align: center;
            }
            h1 { color: #c00; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 0.5rem; }
            .details {
              background: #f5f5f5;
              padding: 1rem;
              border-radius: 5px;
              margin-top: 1rem;
              font-size: 13px;
              color: #666;
            }
            a {
              display: inline-block;
              margin-top: 1rem;
              padding: 0.75rem 1.5rem;
              background: #ec4899;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Đăng Nhập Thất Bại</h1>
            <p>Email hoặc mật khẩu không đúng.</p>
            <div class="details">
              ${error ? error.message : 'Session không được tạo'}
            </div>
            <a href="/login-static">← Thử lại</a>
          </div>
        </body>
        </html>
        `,
        {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // Success - Set cookies and redirect
    const cookieStore = await cookies();
    
    // Set auth cookies (Supabase handles this automatically, but we ensure it)
    cookieStore.set({
      name: 'sb-auth-token',
      value: data.session.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
    
  } catch (error) {
    console.error('[Static Login Error]', error);
    
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Lỗi Server</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #fee;
            margin: 0;
          }
          .error {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 400px;
            text-align: center;
          }
          h1 { color: #c00; margin-bottom: 1rem; }
          .code {
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 5px;
            margin-top: 1rem;
            font-family: monospace;
            font-size: 12px;
            color: #c00;
            word-break: break-all;
          }
          a {
            display: inline-block;
            margin-top: 1rem;
            padding: 0.75rem 1.5rem;
            background: #ec4899;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>⚠️ Lỗi Server</h1>
          <p>Đã xảy ra lỗi không mong muốn.</p>
          <div class="code">
            ${error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <a href="/login-static">← Quay lại</a>
        </div>
      </body>
      </html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}
