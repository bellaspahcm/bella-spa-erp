/**
 * Static Login Page - Zero JavaScript Fallback
 * 
 * This is an emergency fallback login page with:
 * - NO client-side JavaScript
 * - NO external dependencies
 * - NO dynamic imports
 * - NO CSS-in-JS
 * - Pure HTML form with server action
 * 
 * Use this URL if main login page fails:
 * https://bella-spa-erp.vercel.app/login-static
 */

export default function StaticLoginPage() {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Bella Spa - Đăng Nhập</title>
        <style dangerouslySetInnerHTML={{__html: `
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #fdf2f8 0%, #fff 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          
          .container {
            width: 100%;
            max-width: 400px;
            background: white;
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            border: 2px solid #fce7f3;
          }
          
          .logo {
            text-align: center;
            margin-bottom: 2rem;
          }
          
          .logo-img {
            width: 80px;
            height: 80px;
            margin-bottom: 1rem;
          }
          
          h1 {
            font-size: 28px;
            font-weight: 900;
            color: #1f2937;
            text-align: center;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
          }
          
          .subtitle {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 2rem;
          }
          
          .alert {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            font-size: 13px;
            color: #856404;
            font-weight: 600;
          }
          
          .form-group {
            margin-bottom: 1.5rem;
          }
          
          label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
            letter-spacing: 0.5px;
          }
          
          input {
            width: 100%;
            padding: 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            font-size: 16px;
            transition: all 0.2s;
            background: white;
          }
          
          input:focus {
            outline: none;
            border-color: #ec4899;
            box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.1);
          }
          
          button {
            width: 100%;
            padding: 1.25rem;
            background: #ec4899;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            cursor: pointer;
            transition: background 0.2s;
            letter-spacing: 1px;
          }
          
          button:hover {
            background: #db2777;
          }
          
          button:active {
            transform: scale(0.98);
          }
          
          .footer {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #fce7f3;
            text-align: center;
            font-size: 13px;
            color: #9ca3af;
          }
          
          .link {
            color: #ec4899;
            font-weight: 700;
            text-decoration: none;
          }
          
          .error {
            background: #fee;
            border: 1px solid #fcc;
            color: #c00;
            padding: 1rem;
            border-radius: 10px;
            margin-bottom: 1.5rem;
            font-size: 14px;
            font-weight: 600;
          }
        `}} />
      </head>
      <body>
        <div className="container">
          <div className="logo">
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 1rem',
              background: '#ec4899',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              color: 'white',
              fontWeight: '900',
            }}>
              B
            </div>
            <h1>Bella Spa ERP</h1>
            <p className="subtitle">Trang đăng nhập khẩn cấp</p>
          </div>

          <div className="alert">
            ⚠️ Đây là trang đăng nhập dự phòng. Trang chính đang gặp sự cố.
          </div>

          <form action="/api/auth/login-static" method="POST">
            <div className="form-group">
              <label htmlFor="email">Email công việc</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="admin@bellaspa.vn"
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button type="submit">
              Đăng nhập
            </button>
          </form>

          <div className="footer">
            <p>
              Gặp sự cố? <a href="mailto:support@bellaspa.vn" className="link">Liên hệ kỹ thuật</a>
            </p>
            <p style={{marginTop: '1rem', fontSize: '11px'}}>
              © 2026 Bella Spa Group
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
