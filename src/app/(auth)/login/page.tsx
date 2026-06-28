'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { Mail, Lock, Loader2, AlertTriangle, Shield, Smartphone } from 'lucide-react';

/**
 * Login Page - Bella Multi-Service ERP
 *
 * Features:
 * - Email/Password authentication
 * - 2FA/MFA TOTP support
 * - High-tech glassmorphism design (dark, indigo/violet/cyan palette)
 * - No framer-motion (iOS Safari compatible)
 * - Vanilla JavaScript animations
 * - Progressive enhancement
 */

type LoginStage = 'credentials' | 'mfa';

// ── Design tokens ──────────────────────────────────────────────────────────────
const ACCENT   = '#6366f1';       // indigo-500
const ACCENT2  = '#8b5cf6';       // violet-500
const CYAN     = '#06b6d4';       // cyan-500
const FOCUS_RING = 'rgba(99,102,241,0.35)';

const glassCard: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: '1.75rem',
  boxShadow:
    '0 0 0 1px rgba(99,102,241,0.12), ' +
    '0 32px 64px -12px rgba(0,0,0,0.7), ' +
    'inset 0 1px 0 rgba(255,255,255,0.08)',
};

const inputBase: React.CSSProperties = {
  width: '100%',
  paddingLeft: '3rem',
  paddingRight: '1rem',
  paddingTop: '0.9rem',
  paddingBottom: '0.9rem',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.875rem',
  fontSize: '1rem',
  fontWeight: '500',
  color: '#f1f5f9',
  outline: 'none',
  transition: 'all 0.2s',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: '700',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const iconWrap: React.CSSProperties = {
  position: 'absolute',
  left: '1rem',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: '#475569',
};

function GlowDot({ color, style }: { color: string; style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        borderRadius: '50%',
        filter: 'blur(60px)',
        opacity: 0.35,
        background: color,
        ...style,
      }}
    />
  );
}

export default function LoginPage() {
  const [stage, setStage] = useState<LoginStage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Auth handlers (unchanged logic) ────────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem 1.5rem 2rem',
      position: 'relative',
      minHeight: '100dvh',
    }}>
      {/* Ambient glow blobs */}
      <GlowDot color="#6366f1" style={{ width: 360, height: 360, top: '5%', left: '-8%' }} />
      <GlowDot color="#8b5cf6" style={{ width: 280, height: 280, bottom: '8%', right: '-6%' }} />
      <GlowDot color="#06b6d4" style={{ width: 200, height: 200, bottom: '20%', left: '15%', opacity: 0.2 }} />

      {/* Glass card */}
      <div style={{ ...glassCard, width: '100%', maxWidth: '26rem', padding: '2.5rem', position: 'relative', zIndex: 10 }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1.25rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Image
              src="/bella-erp-logo.png"
              alt="Bella ERP"
              width={1024}
              height={464}
              priority
              style={{ width: '90%', height: 'auto', filter: 'drop-shadow(0 0 16px rgba(139,92,246,0.45))' }}
            />
          </div>

          {/* Subtitle badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '999px',
            padding: '0.25rem 0.75rem',
            marginBottom: '0.25rem',
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: CYAN,
              display: 'inline-block',
              boxShadow: `0 0 6px ${CYAN}`,
            }} />
            <span style={{
              fontSize: '0.625rem',
              fontWeight: '700',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: CYAN,
            }}>MULTI-SERVICE ERP</span>
          </div>

          {/* Subtitle */}
          <p style={{
            fontSize: '0.8125rem',
            fontWeight: '500',
            color: '#64748b',
            marginTop: '0.375rem',
          }}>
            {stage === 'mfa'
              ? 'Xác minh 2 lớp bảo mật'
              : 'Hệ thống quản trị ALL in ONE'}
          </p>

          {/* Divider */}
          <div style={{
            marginTop: '1.25rem',
            width: '100%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)',
          }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.875rem',
            padding: '0.875rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <AlertTriangle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
            <span style={{ color: '#fca5a5', fontSize: '0.875rem', fontWeight: '600' }}>
              {error}
            </span>
          </div>
        )}

        {/* ── Credentials stage ── */}
        {stage === 'credentials' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={labelStyle}>Email công việc</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Mail size={18} /></div>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bella.vn"
                  disabled={loading}
                  autoComplete="email"
                  style={inputBase}
                  onFocus={(e) => {
                    e.target.style.borderColor = ACCENT;
                    e.target.style.boxShadow = `0 0 0 3px ${FOCUS_RING}`;
                    e.target.style.background = 'rgba(99,102,241,0.08)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.target.style.boxShadow = 'none';
                    e.target.style.background = 'rgba(255,255,255,0.06)';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={labelStyle}>Mật khẩu</label>
              <div style={{ position: 'relative' }}>
                <div style={iconWrap}><Lock size={18} /></div>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  style={inputBase}
                  onFocus={(e) => {
                    e.target.style.borderColor = ACCENT;
                    e.target.style.boxShadow = `0 0 0 3px ${FOCUS_RING}`;
                    e.target.style.background = 'rgba(99,102,241,0.08)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.target.style.boxShadow = 'none';
                    e.target.style.background = 'rgba(255,255,255,0.06)';
                  }}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                background: loading
                  ? 'rgba(255,255,255,0.06)'
                  : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT2} 100%)`,
                color: loading ? '#475569' : 'white',
                fontWeight: '800',
                fontSize: '0.9375rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                borderRadius: '0.875rem',
                border: loading ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(99,102,241,0.5)',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 8px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
                marginTop: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={20} /><span>Đang đăng nhập...</span></>
              ) : (
                'Đăng nhập ngay'
              )}
            </button>
          </form>
        )}

        {/* ── MFA stage ── */}
        {stage === 'mfa' && (
          <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Info card */}
            <div style={{
              background: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: '0.875rem',
              padding: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}>
              <Smartphone size={22} style={{ color: CYAN, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '700', color: '#67e8f9', marginBottom: '0.25rem' }}>
                  Xác minh 2 lớp bảo mật
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Mở ứng dụng Authenticator trên điện thoại và nhập mã 6 số đang hiển thị.
                </p>
              </div>
            </div>

            {/* MFA input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Shield size={13} style={{ color: ACCENT }} />
                Mã xác minh
              </label>
              <input
                id="mfa-code-input"
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
                  ...inputBase,
                  paddingLeft: '1rem',
                  fontSize: '2.25rem',
                  fontWeight: '900',
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontFamily: 'monospace',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = ACCENT;
                  e.target.style.boxShadow = `0 0 0 3px ${FOCUS_RING}`;
                  e.target.style.background = 'rgba(99,102,241,0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255,255,255,0.06)';
                }}
              />
            </div>

            {/* Verify button */}
            <button
              id="mfa-submit-btn"
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              style={{
                width: '100%',
                padding: '1rem',
                background: (loading || mfaCode.length !== 6)
                  ? 'rgba(255,255,255,0.05)'
                  : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT2} 100%)`,
                color: (loading || mfaCode.length !== 6) ? '#475569' : 'white',
                fontWeight: '800',
                fontSize: '0.9375rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                borderRadius: '0.875rem',
                border: '1px solid rgba(99,102,241,0.3)',
                cursor: (loading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
                boxShadow: (loading || mfaCode.length !== 6) ? 'none' : '0 8px 24px rgba(99,102,241,0.35)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
              }}
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={20} /><span>Đang xác minh...</span></>
              ) : (
                <><Shield size={18} /><span>Xác minh</span></>
              )}
            </button>

            {/* Cancel */}
            <button
              id="mfa-cancel-btn"
              type="button"
              onClick={handleCancelMfa}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.625rem',
                background: 'transparent',
                color: '#475569',
                fontWeight: '600',
                fontSize: '0.875rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.color = '#475569'; }}
            >
              ← Huỷ &amp; đăng nhập lại
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: '500' }}>
            Gặp sự cố?{' '}
            <span style={{ color: ACCENT, fontWeight: '700', cursor: 'pointer' }}>
              Liên hệ kỹ thuật
            </span>
          </p>
        </div>
      </div>

      {/* Copyright — in normal flow, no position:absolute */}
      <p style={{
        marginTop: '2rem',
        textAlign: 'center',
        color: '#1e293b',
        fontSize: '0.6875rem',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        zIndex: 10,
        position: 'relative',
      }}>
        &copy; {new Date().getFullYear()} Bella Group — All rights reserved
      </p>
    </div>
  );
}
