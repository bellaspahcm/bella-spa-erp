'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { Mail, Lock, Loader2, AlertTriangle, Shield, Smartphone } from 'lucide-react';

/**
 * Login Page - Bella Multi-Service ERP
 * Design: Clean, minimal với gradient pastel background
 */

type LoginStage = 'credentials' | 'mfa';

export default function LoginPage() {
  const [stage, setStage] = useState<LoginStage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { getSupabase } = await import('@/lib/supabase-client');
      const { needsMfaChallenge } = await import('@/lib/mfa');
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
      const requiresMfa = await needsMfaChallenge();
      if (requiresMfa) { setStage('mfa'); setLoading(false); return; }
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('[Login Error]', err);
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(mfaCode)) { setError('Mã xác minh phải gồm đúng 6 chữ số.'); return; }
    setLoading(true);
    setError(null);
    try {
      const { challengeAndVerify } = await import('@/lib/mfa');
      const result = await challengeAndVerify(mfaCode);
      if (!result.ok) { setError(result.error || 'Mã không đúng hoặc đã hết hạn.'); setLoading(false); return; }
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('[MFA Error]', err);
      setError(err instanceof Error ? err.message : 'Xác minh thất bại. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  const handleCancelMfa = async () => {
    try {
      const { getSupabase } = await import('@/lib/supabase-client');
      await getSupabase().auth.signOut();
    } catch (err) { console.error('[SignOut Error]', err); }
    setStage('credentials');
    setPassword('');
    setMfaCode('');
    setError(null);
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      minHeight: '100dvh',
    }}>
      {/* White card */}
      <div style={{
        background: 'white',
        borderRadius: '2rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '26rem',
        padding: '3rem 2.5rem',
      }}>

        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <Image
              src="/bella-erp-logo.png"
              alt="Bella ERP"
              width={1024}
              height={464}
              priority
              style={{ width: '60%', height: 'auto' }}
            />
          </div>

          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: '#e0f2fe',
            borderRadius: '999px',
            padding: '0.375rem 0.875rem',
            marginBottom: '0.625rem',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#0ea5e9',
            }} />
            <span style={{
              fontSize: '0.625rem',
              fontWeight: '800',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#0369a1',
            }}>
              MULTI-SERVICE ERP
            </span>
          </div>

          {/* Subtitle */}
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
            fontWeight: '500',
            marginTop: '0.5rem',
          }}>
            {stage === 'mfa' ? 'Xác minh 2 lớp bảo mật' : 'Hệ thống quản trị ALL in ONE'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.75rem',
            padding: '0.875rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
            <span style={{ color: '#dc2626', fontSize: '0.875rem', fontWeight: '600' }}>
              {error}
            </span>
          </div>
        )}

        {/* Credentials Form */}
        {stage === 'credentials' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Email */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
              }}>
                Email công việc
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bella.vn"
                  disabled={loading}
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem 0.875rem 3rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '0.9375rem',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'all 0.2s',
                    background: 'white',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7c3aed';
                    e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
              }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem 0.875rem 3rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '0.9375rem',
                    fontWeight: '500',
                    color: '#1e293b',
                    outline: 'none',
                    transition: 'all 0.2s',
                    background: 'white',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#7c3aed';
                    e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: loading
                  ? '#e2e8f0'
                  : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                color: loading ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '0.9375rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 10px 25px rgba(124,58,237,0.3)',
                transition: 'all 0.2s',
                marginTop: '0.5rem',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(124,58,237,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(124,58,237,0.3)';
                }
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 className="animate-spin" size={18} />
                  Đang đăng nhập...
                </span>
              ) : (
                'Đăng nhập ngay'
              )}
            </button>
          </form>
        )}

        {/* MFA Form */}
        {stage === 'mfa' && (
          <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Info */}
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.75rem',
              padding: '1rem',
              display: 'flex',
              gap: '0.75rem',
            }}>
              <Smartphone size={20} style={{ color: '#0284c7', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '700', color: '#0369a1', marginBottom: '0.25rem' }}>
                  Xác minh 2 lớp bảo mật
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
                  Mở ứng dụng Authenticator và nhập mã 6 số đang hiển thị.
                </p>
              </div>
            </div>

            {/* MFA Code */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.6875rem',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
              }}>
                <Shield size={13} style={{ color: '#7c3aed' }} />
                Mã xác minh
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: '2rem',
                  fontWeight: '900',
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontFamily: 'monospace',
                  color: '#1e293b',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7c3aed';
                  e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              style={{
                width: '100%',
                padding: '1rem',
                background: (loading || mfaCode.length !== 6)
                  ? '#e2e8f0'
                  : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                color: (loading || mfaCode.length !== 6) ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '0.9375rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: (loading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
                boxShadow: (loading || mfaCode.length !== 6) ? 'none' : '0 10px 25px rgba(124,58,237,0.3)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 className="animate-spin" size={18} />
                  Đang xác minh...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Shield size={16} />
                  Xác minh
                </span>
              )}
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={handleCancelMfa}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.625rem',
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.color = '#64748b'; }}
            >
              ← Huỷ &amp; đăng nhập lại
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: '500' }}>
            Gặp sự cố?{' '}
            <a href="mailto:support@bella.vn" style={{ color: '#7c3aed', fontWeight: '700', textDecoration: 'none' }}>
              Liên hệ kỹ thuật
            </a>
          </p>
        </div>
      </div>

      {/* Copyright */}
      <p style={{
        marginTop: '2.5rem',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.75rem',
        fontWeight: '600',
      }}>
        © {new Date().getFullYear()} Bella Group — All rights reserved
      </p>
    </div>
  );
}
