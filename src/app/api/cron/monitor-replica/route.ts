import { checkReplicaHealth } from '@/lib/database/read-replica';
import { NextResponse } from 'next/server';

/**
 * Replica Monitoring Cron Job
 * 
 * Runs every 5 minutes to check replication lag.
 * Sends alerts if lag exceeds threshold.
 * 
 * Triggered by Vercel Cron every 5 minutes
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const health = await checkReplicaHealth();
    const timestamp = new Date().toISOString();

    // Alert thresholds
    const WARNING_THRESHOLD = 2000; // 2 seconds
    const CRITICAL_THRESHOLD = 5000; // 5 seconds

    let alertSent = false;

    // Critical: Replication lag > 5 seconds
    if (health.lag_ms && health.lag_ms > CRITICAL_THRESHOLD) {
      await sendAlert({
        level: 'critical',
        message: `🚨 CRITICAL: Database replica lag ${health.lag_ms}ms (threshold: ${CRITICAL_THRESHOLD}ms)`,
        details: {
          lag_ms: health.lag_ms,
          healthy: health.healthy,
          timestamp,
        },
      });
      alertSent = true;
    }
    // Warning: Replication lag > 2 seconds
    else if (health.lag_ms && health.lag_ms > WARNING_THRESHOLD) {
      await sendAlert({
        level: 'warning',
        message: `⚠️ WARNING: Database replica lag ${health.lag_ms}ms (threshold: ${WARNING_THRESHOLD}ms)`,
        details: {
          lag_ms: health.lag_ms,
          healthy: health.healthy,
          timestamp,
        },
      });
      alertSent = true;
    }

    // Unhealthy replica
    if (!health.healthy && health.error) {
      await sendAlert({
        level: 'critical',
        message: `🚨 CRITICAL: Database replica unhealthy`,
        details: {
          error: health.error,
          timestamp,
        },
      });
      alertSent = true;
    }

    return NextResponse.json({
      success: true,
      health,
      alert_sent: alertSent,
      timestamp,
    });
  } catch (error) {
    console.error('[Cron] Replica monitoring failed:', error);

    // Alert on monitoring failure itself
    await sendAlert({
      level: 'critical',
      message: '🚨 CRITICAL: Replica monitoring cron failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Send alert to monitoring channels
 */
async function sendAlert(alert: {
  level: 'warning' | 'critical';
  message: string;
  details: Record<string, unknown>;
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('[Alert] SLACK_WEBHOOK_URL not configured, skipping alert');
    return;
  }

  try {
    const color = alert.level === 'critical' ? '#dc2626' : '#f59e0b';
    
    const payload = {
      username: 'Bella ERP Infrastructure',
      icon_emoji: ':warning:',
      attachments: [
        {
          color,
          title: alert.message,
          fields: Object.entries(alert.details).map(([key, value]) => ({
            title: key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            short: true,
          })),
          footer: 'Bella ERP Monitoring',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[Alert] Failed to send alert:', error);
    // Don't throw - monitoring failure shouldn't crash the cron
  }
}
