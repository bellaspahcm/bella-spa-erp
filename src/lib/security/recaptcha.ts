/**
 * reCAPTCHA v3 Verification
 * 
 * Google reCAPTCHA v3 returns a score (0.0 - 1.0)
 * - 1.0: Very likely a human
 * - 0.0: Very likely a bot
 * 
 * Recommended thresholds:
 * - 0.5+: Allow
 * - 0.3-0.5: Challenge/Review
 * - <0.3: Block
 * 
 * Setup:
 * 1. Get keys from: https://www.google.com/recaptcha/admin
 * 2. Add to .env:
 *    - NEXT_PUBLIC_RECAPTCHA_SITE_KEY (frontend)
 *    - RECAPTCHA_SECRET_KEY (backend)
 */

export interface RecaptchaVerificationResult {
  success: boolean;
  score?: number; // 0.0 - 1.0 (v3 only)
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  error?: string;
  'error-codes'?: string[];
}

/**
 * Verify reCAPTCHA token on server-side
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string
): Promise<RecaptchaVerificationResult> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  // Skip verification in development if key not configured
  if (!secretKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[verifyRecaptcha] RECAPTCHA_SECRET_KEY not configured, skipping verification in dev mode');
      return {
        success: true,
        score: 1.0,
        action: expectedAction || 'unknown',
      };
    }
    
    return {
      success: false,
      error: 'reCAPTCHA not configured',
    };
  }
  
  try {
    // Call Google reCAPTCHA API
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `reCAPTCHA API error: ${response.status}`,
      };
    }
    
    const result: RecaptchaVerificationResult = await response.json();
    
    // Validate action matches (if provided)
    if (expectedAction && result.action !== expectedAction) {
      return {
        ...result,
        success: false,
        error: `Action mismatch: expected ${expectedAction}, got ${result.action}`,
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('[verifyRecaptcha] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if reCAPTCHA score meets threshold
 */
export function isScoreAcceptable(score: number | undefined, threshold: number = 0.5): boolean {
  if (score === undefined) return false;
  return score >= threshold;
}

/**
 * Get risk level from reCAPTCHA score
 */
export function getRiskLevel(score: number | undefined): 'low' | 'medium' | 'high' | 'unknown' {
  if (score === undefined) return 'unknown';
  if (score >= 0.7) return 'low';
  if (score >= 0.3) return 'medium';
  return 'high';
}

/**
 * reCAPTCHA score thresholds for different actions
 */
export const RECAPTCHA_THRESHOLDS = {
  // Partner registration: Strict (prevent spam)
  REGISTRATION: 0.5,
  
  // Login: Moderate (balance security and UX)
  LOGIN: 0.4,
  
  // Email verification: Strict (prevent abuse)
  EMAIL_VERIFICATION: 0.5,
  
  // Contact form: Moderate (avoid false positives)
  CONTACT_FORM: 0.3,
  
  // Admin actions: Lenient (trusted users)
  ADMIN_ACTIONS: 0.3,
} as const;

/**
 * Generate client-side reCAPTCHA script tag
 */
export function getRecaptchaScriptTag(): string {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  
  if (!siteKey) {
    console.warn('[getRecaptchaScriptTag] NEXT_PUBLIC_RECAPTCHA_SITE_KEY not configured');
    return '';
  }
  
  return `<script src="https://www.google.com/recaptcha/api.js?render=${siteKey}"></script>`;
}

/**
 * Middleware helper to verify reCAPTCHA in API routes
 */
export async function withRecaptchaVerification(
  token: string | null | undefined,
  action: string,
  threshold: number = 0.5
): Promise<{ valid: boolean; error?: string; score?: number }> {
  if (!token) {
    return {
      valid: false,
      error: 'reCAPTCHA token missing',
    };
  }
  
  const result = await verifyRecaptcha(token, action);
  
  if (!result.success) {
    return {
      valid: false,
      error: result.error || 'reCAPTCHA verification failed',
    };
  }
  
  if (!isScoreAcceptable(result.score, threshold)) {
    return {
      valid: false,
      error: `reCAPTCHA score too low: ${result.score} (threshold: ${threshold})`,
      score: result.score,
    };
  }
  
  return {
    valid: true,
    score: result.score,
  };
}
