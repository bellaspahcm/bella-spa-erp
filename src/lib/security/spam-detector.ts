/**
 * IP-based Spam Detection
 * 
 * Track suspicious activity patterns:
 * - Multiple registrations from same IP
 * - Rapid-fire requests
 * - Known spam IP addresses
 * - Disposable email domains
 * 
 * Actions:
 * - Log suspicious activity
 * - Flag for manual review
 * - Block if confidence high
 */

interface SuspiciousActivity {
  ip: string;
  email?: string;
  activityType: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// In-memory store (use Redis/DB in production)
const activityLog: SuspiciousActivity[] = [];
const blockedIps = new Set<string>();
const disposableEmailDomains = new Set<string>([
  // Common disposable email domains
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'throwaway.email',
  'mailinator.com',
  'maildrop.cc',
  'yopmail.com',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
  // Add more as needed
]);

/**
 * Check if IP is blocked
 */
export function isIpBlocked(ip: string): boolean {
  return blockedIps.has(ip);
}

/**
 * Block an IP address
 */
export function blockIp(ip: string, reason?: string): void {
  blockedIps.add(ip);
  console.warn(`[SpamDetector] Blocked IP: ${ip}${reason ? ` (Reason: ${reason})` : ''}`);
  
  // Log to activity
  logActivity({
    ip,
    activityType: 'ip_blocked',
    timestamp: Date.now(),
    metadata: { reason },
  });
}

/**
 * Unblock an IP address
 */
export function unblockIp(ip: string): void {
  blockedIps.delete(ip);
  console.log(`[SpamDetector] Unblocked IP: ${ip}`);
}

/**
 * Check if email is from disposable domain
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  return disposableEmailDomains.has(domain);
}

/**
 * Add disposable email domain to blocklist
 */
export function addDisposableEmailDomain(domain: string): void {
  disposableEmailDomains.add(domain.toLowerCase());
}

/**
 * Log suspicious activity
 */
export function logActivity(activity: SuspiciousActivity): void {
  activityLog.push(activity);
  
  // Keep only last 1000 entries (prevent memory leak)
  if (activityLog.length > 1000) {
    activityLog.shift();
  }
}

/**
 * Get recent activities for an IP
 */
export function getRecentActivities(
  ip: string,
  windowMs: number = 60 * 60 * 1000 // 1 hour
): SuspiciousActivity[] {
  const cutoff = Date.now() - windowMs;
  return activityLog.filter(
    (activity) => activity.ip === ip && activity.timestamp > cutoff
  );
}

/**
 * Calculate spam score for an IP (0-100)
 * Higher score = more suspicious
 */
export function calculateSpamScore(ip: string, email?: string): number {
  let score = 0;
  
  // Check if IP is blocked
  if (isIpBlocked(ip)) {
    return 100;
  }
  
  // Check disposable email
  if (email && isDisposableEmail(email)) {
    score += 50;
  }
  
  // Check recent activity frequency
  const recentActivities = getRecentActivities(ip, 60 * 60 * 1000); // Last hour
  
  // Multiple registrations from same IP (suspicious)
  const registrations = recentActivities.filter(
    (a) => a.activityType === 'registration'
  );
  if (registrations.length > 2) {
    score += 30;
  }
  
  // Rapid-fire requests (bot-like behavior)
  if (recentActivities.length > 20) {
    score += 20;
  }
  
  // Check for failed verification attempts
  const failedVerifications = recentActivities.filter(
    (a) => a.activityType === 'verification_failed'
  );
  if (failedVerifications.length > 3) {
    score += 20;
  }
  
  return Math.min(100, score);
}

/**
 * Get risk level from spam score
 */
export function getSpamRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Check if request should be blocked based on spam score
 */
export function shouldBlockRequest(ip: string, email?: string): {
  blocked: boolean;
  score: number;
  reason?: string;
} {
  const score = calculateSpamScore(ip, email);
  const risk = getSpamRiskLevel(score);
  
  if (risk === 'critical') {
    return {
      blocked: true,
      score,
      reason: 'Critical spam score - automatic block',
    };
  }
  
  return {
    blocked: false,
    score,
  };
}

/**
 * Validate email format (basic check)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (Vietnamese format)
 */
export function isValidVietnamesePhone(phone: string): boolean {
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Vietnamese phone patterns:
  // - Mobile: 03x, 05x, 07x, 08x, 09x (10 digits)
  // - Landline: 02x (10 digits)
  const phoneRegex = /^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$/;
  
  return phoneRegex.test(cleaned);
}

/**
 * Check for common spam patterns in text
 */
export function containsSpamPatterns(text: string): boolean {
  const spamPatterns = [
    /viagra/i,
    /cialis/i,
    /casino/i,
    /lottery/i,
    /winner/i,
    /congratulations/i,
    /click here/i,
    /buy now/i,
    /limited time/i,
    /act now/i,
    /free money/i,
    /work from home/i,
    /make money fast/i,
    /http:\/\//i, // HTTP links in content (suspicious)
    /bit\.ly/i, // Shortened URLs
  ];
  
  return spamPatterns.some((pattern) => pattern.test(text));
}

/**
 * Comprehensive spam check for registration
 */
export interface SpamCheckResult {
  isSpam: boolean;
  score: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  shouldBlock: boolean;
  shouldReview: boolean;
}

export function checkRegistrationForSpam(params: {
  ip: string;
  email: string;
  phone?: string;
  companyName?: string;
  notes?: string;
}): SpamCheckResult {
  const { ip, email, phone, companyName, notes } = params;
  const reasons: string[] = [];
  let score = calculateSpamScore(ip, email);
  
  // Email validation
  if (!isValidEmail(email)) {
    reasons.push('Invalid email format');
    score += 20;
  }
  
  if (isDisposableEmail(email)) {
    reasons.push('Disposable email domain');
    score += 30;
  }
  
  // Phone validation (if provided)
  if (phone && !isValidVietnamesePhone(phone)) {
    reasons.push('Invalid phone format');
    score += 10;
  }
  
  // Content spam check
  const combinedText = [companyName, notes].filter(Boolean).join(' ');
  if (containsSpamPatterns(combinedText)) {
    reasons.push('Spam patterns detected in content');
    score += 40;
  }
  
  const risk = getSpamRiskLevel(score);
  const shouldBlock = score >= 80;
  const shouldReview = score >= 40 && score < 80;
  
  return {
    isSpam: score >= 40,
    score,
    risk,
    reasons,
    shouldBlock,
    shouldReview,
  };
}

/**
 * Clean up old activity logs (call periodically)
 */
export function cleanupOldActivities(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  
  for (let i = activityLog.length - 1; i >= 0; i--) {
    if (activityLog[i].timestamp < cutoff) {
      activityLog.splice(i, 1);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`[SpamDetector] Cleaned up ${removed} old activity logs`);
  }
}

// Cleanup every hour
setInterval(() => {
  cleanupOldActivities();
}, 60 * 60 * 1000);
