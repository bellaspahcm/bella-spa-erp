'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { Mail, Lock, Loader2, AlertTriangle, Shield, Smartphone } from 'lucide-react';

/**
 * Simplified Login Page - Mobile Safari Compatible
 * 
 * Features:
 * - Email/Password authentication
 * - 2FA/MFA TOTP support
 * - No framer-motion (iOS Safari compatible)
 * - Vanilla JavaScript animations
 * - Progressive enhancement
 */

type LoginStage = 'credentials' | 'mfa';

export default function LoginPageSimple() {
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
      // Lazy load Supabase only when needed
      const { getSupabase } = await import('@/lib/supabase-client');
      const { needsMfaChallenge } = await import('@/lib/mfa');
      const supabase = getSupabase();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Check if MFA is required
      const requiresMfa = await needsMfaChallenge();
      
      if (requiresMfa) {
        // Switch to MFA stage
        setStage('mfa');
        setLoading(false);
        return;
      }

      // Success - no MFA required, redirect
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('[Login Error]', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Đăng nhập thất bại. Vui lòng thử lại.'
      );
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate MFA code format
    if (!/^\d{6}$/.test(mfaCode)) {
      setError('Mã xác minh phải gồm đúng 6 chữ số.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { challengeAndVerify } = await import('@/lib/mfa');
      
      const result = await challengeAndVerify(mfaCode);
      
      if (!result.ok) {
        setError(result.error || 'Mã không đúng hoặc đã hết hạn.');
        setLoading(false);
        return;
      }

      // MFA success - redirect
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('[MFA Error]', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Xác minh thất bại. Vui lòng thử lại.'
      );
      setLoading(false);
    }
  };

  const handleCancelMfa = async () => {
    try {
      const { getSupabase } = await import('@/lib/supabase-client');
      await getSupabase().auth.signOut();
    } catch (err) {
      console.error('[SignOut Error]', err);
    }
    
    // Reset to credentials stage
    setStage('credentials');
    setPassword('');
    setMfaCode('');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '28rem',
        background: 'white',
        borderRadius: '2rem',
        padding: '2rem',
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        border: '2px solid #fce7f3',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Image 
              src="/logo.png" 
              alt="Bella Spa" 
              width={80} 
              height={80}
              style={{ width: 'auto', height: '5rem' }}
            />
          </div>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: '900',
            color: '#1f2937',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
          }}>
            Bella Spa ERP
          </h1>
          <p style={{
            color: '#6b7280',
            marginTop: '0.5rem',
            fontWeight: '500',
          }}>
            {stage === 'mfa' 
              ? 'Xác minh 2 lớp bảo mật' 
              : 'Hệ thống quản lý chăm sóc mẹ & bé'
            }
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '1rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <AlertTriangle 
              size={20} 
              style={{ color: '#dc2626', flexShrink: 0 }}
            />
            <span style={{
              color: '#dc2626',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}>
              {error}
            </span>
          </div>
        )}

        {/* Credentials Stage */}
        {stage === 'credentials' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Email Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Email công việc
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#9ca3af',
              }}>
                <Mail size={20} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bellaspa.vn"
                disabled={loading}
                style={{
                  width: '100%',
                  paddingLeft: '3rem',
                  paddingRight: '1rem',
                  paddingTop: '1rem',
                  paddingBottom: '1rem',
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '1rem',
                  fontSize: '1rem',
                  fontWeight: '500',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#ec4899';
                  e.target.style.boxShadow = '0 0 0 4px rgba(236, 72, 153, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#9ca3af',
              }}>
                <Lock size={20} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{
                  width: '100%',
                  paddingLeft: '3rem',
                  paddingRight: '1rem',
                  paddingTop: '1rem',
                  paddingBottom: '1rem',
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '1rem',
                  fontSize: '1rem',
                  fontWeight: '500',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#ec4899';
                  e.target.style.boxShadow = '0 0 0 4px rgba(236, 72, 153, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
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
              padding: '1.25rem',
              background: loading ? '#d1d5db' : '#ec4899',
              color: 'white',
              fontWeight: '900',
              fontSize: '1.125rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              borderRadius: '1rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 10px 15px -3px rgba(236, 72, 153, 0.3)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#db2777';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#ec4899';
              }
            }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              'Đăng nhập ngay'
            )}
          </button>
        </form>
        )}

        {/* MFA Stage */}
        {stage === 'mfa' && (
          <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Info Card */}
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '1rem',
              padding: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}>
              <Smartphone 
                size={24} 
                style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }}
              />
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#92400e',
                  marginBottom: '0.25rem',
                }}>
                  Xác minh 2 lớp bảo mật
                </p>
                <p style={{
                  fontSize: '0.8125rem',
                  color: '#78350f',
                  lineHeight: '1.4',
                }}>
                  Mở ứng dụng Authenticator trên điện thoại và nhập mã 6 số đang hiển thị.
                </p>
              </div>
            </div>

            {/* MFA Code Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Shield size={14} style={{ color: '#ec4899' }} />
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
                  padding: '1.25rem 1rem',
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '2px solid #e5e7eb',
                  borderRadius: '1rem',
                  fontSize: '2rem',
                  fontWeight: '900',
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'monospace',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#ec4899';
                  e.target.style.boxShadow = '0 0 0 4px rgba(236, 72, 153, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              style={{
                width: '100%',
                padding: '1.25rem',
                background: (loading || mfaCode.length !== 6) ? '#d1d5db' : '#ec4899',
                color: 'white',
                fontWeight: '900',
                fontSize: '1.125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                borderRadius: '1rem',
                border: 'none',
                cursor: (loading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
                boxShadow: (loading || mfaCode.length !== 6) ? 'none' : '0 10px 15px -3px rgba(236, 72, 153, 0.3)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
              onMouseEnter={(e) => {
                if (!loading && mfaCode.length === 6) {
                  e.currentTarget.style.background = '#db2777';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && mfaCode.length === 6) {
                  e.currentTarget.style.background = '#ec4899';
                }
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  <span>Đang xác minh...</span>
                </>
              ) : (
                <>
                  <Shield size={20} />
                  <span>Xác minh</span>
                </>
              )}
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancelMfa}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                color: '#6b7280',
                fontWeight: '600',
                fontSize: '0.875rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.color = '#ec4899';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              ← Huỷ & đăng nhập lại
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #fce7f3',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: '#9ca3af',
            fontWeight: '500',
          }}>
            Gặp sự cố? <span style={{
              color: '#ec4899',
              fontWeight: '700',
              cursor: 'pointer',
            }}>Liên hệ kỹ thuật</span>
          </p>
        </div>
      </div>

      {/* Copyright */}
      <p style={{
        position: 'absolute',
        bottom: '2rem',
        width: '100%',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '0.75rem',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        &copy; {new Date().getFullYear()} Bella Spa Group
      </p>
    </div>
  );
}
