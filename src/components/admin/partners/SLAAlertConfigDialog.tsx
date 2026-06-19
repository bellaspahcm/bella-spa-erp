/**
 * SLA Alert Config Dialog Component
 * 
 * Modal dialog for configuring SLA thresholds and alert rules
 * 
 * Features:
 * - Uptime target slider (95% - 99.99%)
 * - Latency thresholds (p95, p99)
 * - Error rate threshold
 * - Notification channels (email, webhook, Telegram, Slack)
 * - Alert cooldown period
 * - Quick tier presets
 * 
 * @module components/admin/partners/SLAAlertConfigDialog
 * @since 2026-06-18
 */

'use client';

import { useState, useEffect } from 'react';
import { APIPartner, SLAConfig, SLAThresholds, SLA_TIER_PRESETS } from '@/types/api-gateway';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Mail, Webhook, MessageSquare, Hash, Clock, Shield } from 'lucide-react';

interface SLAAlertConfigDialogProps {
  partner: APIPartner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: () => void;
}

export function SLAAlertConfigDialog({
  partner,
  open,
  onOpenChange,
  onConfigSaved,
}: SLAAlertConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SLAConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Form state
  const [uptimeTarget, setUptimeTarget] = useState(99.5);
  const [p95Latency, setP95Latency] = useState(300);
  const [p99Latency, setP99Latency] = useState(600);
  const [errorRateThreshold, setErrorRateThreshold] = useState(3.0);
  const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState(3);
  
  // Notification channels
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');

  // Monitoring settings
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [checkInterval, setCheckInterval] = useState(60);


  const fetchConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/sla-config`);
      if (!response.ok) {
        throw new Error('Failed to fetch SLA config');
      }
      const { data } = await response.json();
      setConfig(data);
      
      // Populate form with current config
      setUptimeTarget(data.thresholds.uptime_target_percent);
      setP95Latency(data.thresholds.p95_latency_ms);
      setP99Latency(data.thresholds.p99_latency_ms);
      setErrorRateThreshold(data.thresholds.error_rate_threshold_percent);
      setMaxConsecutiveFailures(data.thresholds.max_consecutive_failures);
      
      setEmailEnabled(data.notification_channels.email?.enabled || false);
      setEmailRecipients(data.notification_channels.email?.recipients?.join(', ') || '');
      setWebhookEnabled(data.notification_channels.webhook?.enabled || false);
      setWebhookUrl(data.notification_channels.webhook?.url || '');
      setWebhookSecret(data.notification_channels.webhook?.secret || '');
      setTelegramEnabled(data.notification_channels.telegram?.enabled || false);
      setTelegramChatId(data.notification_channels.telegram?.chat_id || '');
      setTelegramBotToken(data.notification_channels.telegram?.bot_token || '');
      setSlackEnabled(data.notification_channels.slack?.enabled || false);
      setSlackWebhookUrl(data.notification_channels.slack?.webhook_url || '');
      
      setMonitoringEnabled(data.monitoring_enabled);
      setCheckInterval(data.check_interval_seconds);
    } catch (error: unknown) {
      console.error('Error fetching SLA config:', error);
      toast.error('Failed to load current configuration');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleApplyPreset = (tier: keyof typeof SLA_TIER_PRESETS) => {
    const preset = SLA_TIER_PRESETS[tier];
    setUptimeTarget(preset.uptime_target_percent);
    setP95Latency(preset.p95_latency_ms);
    setP99Latency(preset.p99_latency_ms);
    setErrorRateThreshold(preset.error_rate_threshold_percent);
    setMaxConsecutiveFailures(preset.max_consecutive_failures);
    
    toast.success(`Applied ${tier} tier preset`);
  };

  const handleSave = async () => {
    // Validation
    if (emailEnabled && !emailRecipients.trim()) {
      toast.error('Email recipients are required when email notifications are enabled');
      return;
    }

    if (webhookEnabled && !webhookUrl.trim()) {
      toast.error('Webhook URL is required when webhook notifications are enabled');
      return;
    }

    if (telegramEnabled && (!telegramChatId.trim() || !telegramBotToken.trim())) {
      toast.error('Telegram chat ID and bot token are required when Telegram notifications are enabled');
      return;
    }

    if (slackEnabled && !slackWebhookUrl.trim()) {
      toast.error('Slack webhook URL is required when Slack notifications are enabled');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        partner_id: partner.id,
        thresholds: {
          uptime_target_percent: uptimeTarget,
          p95_latency_ms: p95Latency,
          p99_latency_ms: p99Latency,
          error_rate_threshold_percent: errorRateThreshold,
          max_consecutive_failures: maxConsecutiveFailures,
        },
        notification_channels: {
          email: {
            enabled: emailEnabled,
            recipients: emailEnabled ? emailRecipients.split(',').map(e => e.trim()).filter(Boolean) : [],
          },
          webhook: {
            enabled: webhookEnabled,
            url: webhookUrl,
            secret: webhookSecret || undefined,
          },
          telegram: {
            enabled: telegramEnabled,
            chat_id: telegramChatId,
            bot_token: telegramBotToken,
          },
          slack: {
            enabled: slackEnabled,
            webhook_url: slackWebhookUrl,
          },
        },
        monitoring_enabled: monitoringEnabled,
        check_interval_seconds: checkInterval,
      };

      const response = await fetch(`/api/admin/partners/${partner.id}/sla-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to save configuration');
      }

      toast.success('SLA configuration saved successfully');
      onOpenChange(false);
      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (error: unknown) {
      console.error('Error saving SLA config:', error);
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure SLA & Alerts</DialogTitle>
          <DialogDescription>
            Set thresholds and notification channels for {partner.partner_name}
          </DialogDescription>
        </DialogHeader>

        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Quick Presets */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Quick Presets</Label>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset('basic')}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="font-semibold">Basic</span>
                  <span className="text-xs text-muted-foreground">99% uptime</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset('standard')}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="font-semibold">Standard</span>
                  <span className="text-xs text-muted-foreground">99.5% uptime</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset('premium')}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="font-semibold">Premium</span>
                  <span className="text-xs text-muted-foreground">99.9% uptime</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset('enterprise')}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="font-semibold">Enterprise</span>
                  <span className="text-xs text-muted-foreground">99.99% uptime</span>
                </Button>
              </div>
            </div>

            {/* SLA Thresholds */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">SLA Thresholds</h3>
              </div>

              {/* Uptime Target */}
              <div className="space-y-2">
                <Label htmlFor="uptime_target">
                  Uptime Target: {uptimeTarget.toFixed(2)}%
                </Label>
                <input
                  type="range"
                  id="uptime_target"
                  min="95"
                  max="99.99"
                  step="0.01"
                  value={uptimeTarget}
                  onChange={(e) => setUptimeTarget(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>95%</span>
                  <span>99.99%</span>
                </div>
              </div>

              {/* P95 Latency */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p95_latency">P95 Latency (ms)</Label>
                  <Input
                    id="p95_latency"
                    type="number"
                    value={p95Latency}
                    onChange={(e) => setP95Latency(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>

                {/* P99 Latency */}
                <div className="space-y-2">
                  <Label htmlFor="p99_latency">P99 Latency (ms)</Label>
                  <Input
                    id="p99_latency"
                    type="number"
                    value={p99Latency}
                    onChange={(e) => setP99Latency(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>

              {/* Error Rate Threshold */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="error_rate">Error Rate Threshold (%)</Label>
                  <Input
                    id="error_rate"
                    type="number"
                    value={errorRateThreshold}
                    onChange={(e) => setErrorRateThreshold(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>

                {/* Max Consecutive Failures */}
                <div className="space-y-2">
                  <Label htmlFor="max_failures">Max Consecutive Failures</Label>
                  <Input
                    id="max_failures"
                    type="number"
                    value={maxConsecutiveFailures}
                    onChange={(e) => setMaxConsecutiveFailures(parseInt(e.target.value) || 0)}
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Notification Channels */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold">Notification Channels</h3>

              {/* Email */}
              <div className="space-y-3 pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <Label htmlFor="email_enabled" className="font-medium">Email Notifications</Label>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={emailEnabled}
                    onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      emailEnabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      emailEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {emailEnabled && (
                  <Input
                    placeholder="admin@example.com, ops@example.com"
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                  />
                )}
              </div>

              {/* Webhook */}
              <div className="space-y-3 pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    <Label htmlFor="webhook_enabled" className="font-medium">Webhook Notifications</Label>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={webhookEnabled}
                    onClick={() => setWebhookEnabled(!webhookEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      webhookEnabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      webhookEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {webhookEnabled && (
                  <div className="space-y-2">
                    <Input
                      placeholder="https://example.com/webhooks/sla-alerts"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                    <Input
                      placeholder="Webhook secret (optional)"
                      type="password"
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Telegram */}
              <div className="space-y-3 pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <Label htmlFor="telegram_enabled" className="font-medium">Telegram Notifications</Label>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={telegramEnabled}
                    onClick={() => setTelegramEnabled(!telegramEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      telegramEnabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      telegramEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {telegramEnabled && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Telegram Chat ID"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                    />
                    <Input
                      placeholder="Bot Token"
                      type="password"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Slack */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    <Label htmlFor="slack_enabled" className="font-medium">Slack Notifications</Label>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={slackEnabled}
                    onClick={() => setSlackEnabled(!slackEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      slackEnabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      slackEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                {slackEnabled && (
                  <Input
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* Monitoring Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Monitoring Settings</h3>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="monitoring_enabled">Enable SLA Monitoring</Label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={monitoringEnabled}
                  onClick={() => setMonitoringEnabled(!monitoringEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    monitoringEnabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    monitoringEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {monitoringEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="check_interval">Check Interval (seconds)</Label>
                  <Select
                    value={checkInterval.toString()}
                    onValueChange={(value) => value && setCheckInterval(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute</SelectItem>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="600">10 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || isLoadingConfig}>
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
