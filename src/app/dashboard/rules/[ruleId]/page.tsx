import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { createServerClient } from '@/lib/supabase-server';
import { RuleStatusBadge } from '@/components/rules/RuleStatusBadge';
import { RuleProviderBadge } from '@/components/rules/RuleProviderBadge';
import { ArrowLeft, Edit, Play, History, Calendar, Shield, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const metadata: Metadata = {
  title: 'Rule Details | Bella ERP',
  description: 'View decision rule details',
};

async function getRuleData(ruleId: string) {
  const supabase = createServerClient();
  
  const { data: rule, error } = await supabase
    .from('rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (error || !rule) {
    notFound();
  }

  return rule;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  const rule = await getRuleData(ruleId);

  interface RuleCondition {
    field: string;
    operator: string;
    value: unknown;
  }

  interface RuleAction {
    type: string;
    value: unknown;
  }

  // Parse conditions and actions safely
  const conditions = (Array.isArray(rule.conditions) ? rule.conditions : []) as unknown as RuleCondition[];
  const actions = (Array.isArray(rule.actions) ? rule.actions : []) as unknown as RuleAction[];

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-8 animate-in fade-in duration-500">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/dashboard/rules"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rules
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {rule.name}
          </h1>
          <p className="text-muted-foreground">
            {rule.description || 'No description provided for this rule.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/rules/${rule.id}/edit`}>
            <Button variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Rule
            </Button>
          </Link>
          <Link href={`/dashboard/rules/${rule.id}/test`}>
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              Test Simulator
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Rule Info Card */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-border/40 shadow-sm backdrop-blur-sm bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Rule Configuration
              </CardTitle>
              <CardDescription>System metadata and metadata state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm font-medium text-muted-foreground">Provider</span>
                <RuleProviderBadge provider={rule.provider} />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm font-medium text-muted-foreground">Category</span>
                <Badge variant="secondary" className="font-mono text-xs uppercase">
                  {rule.category || 'N/A'}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm font-medium text-muted-foreground">Priority</span>
                <span className="text-sm font-mono font-bold text-foreground">{rule.priority}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <RuleStatusBadge status={rule.status} />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm font-medium text-muted-foreground">Version</span>
                <span className="text-sm font-mono font-bold bg-accent/30 text-accent-foreground px-2 py-0.5 rounded">
                  v{rule.version}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-muted-foreground">Last Updated</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(rule.updated_at), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Execution Logic (Conditions & Actions) */}
        <div className="md:col-span-2 space-y-6">
          {/* Conditions Card */}
          <Card className="border-border/40 shadow-sm backdrop-blur-sm bg-card/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Conditions
                </CardTitle>
                <CardDescription>Conditions that must be met to trigger actions.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                {conditions.length} Trigger(s)
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {conditions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                  No trigger conditions defined. This rule will execute actions automatically.
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition, idx: number) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-accent/20 border-border/40 gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                          {idx + 1}
                        </span>
                        <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {condition.field}
                        </code>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-medium italic">{condition.operator}</span>
                        <code className="font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded border">
                          {String(condition.value)}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="border-border/40 shadow-sm backdrop-blur-sm bg-card/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Play className="h-4 w-4 text-violet-500" />
                  Actions
                </CardTitle>
                <CardDescription>Outcome actions to perform when conditions are satisfied.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-violet-50/50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-500/20">
                {actions.length} Action(s)
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                  No actions defined.
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action, idx: number) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-accent/20 border-border/40 gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 rounded">
                          {idx + 1}
                        </span>
                        <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {action.type}
                        </code>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-medium">with value</span>
                        <code className="font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded border">
                          {String(action.value)}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
