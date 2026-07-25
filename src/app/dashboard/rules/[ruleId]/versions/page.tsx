'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, History, RefreshCw, Undo2, Calendar, User, Info, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VersionsPageProps {
  params: Promise<{ ruleId: string }>;
}

interface RuleState {
  id: string;
  name: string;
  version: number;
  status: string;
}

interface RuleVersionItem {
  id: string;
  version: number;
  changeType?: string;
  changeSummary?: string;
  changedBy?: { name?: string };
  changedAt: string;
}

export default function RuleVersionsPage({ params }: VersionsPageProps) {
  const { ruleId } = React.use(params);
  const [rule, setRule] = useState<RuleState | null>(null);
  const [versions, setVersions] = useState<RuleVersionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<RuleVersionItem | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const fetchRuleAndVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch current rule data
      const ruleResponse = await fetch(`/api/rules/${ruleId}`);
      if (!ruleResponse.ok) throw new Error('Rule not found');
      const ruleResult = await ruleResponse.json();
      setRule(ruleResult.data || ruleResult);

      // Fetch versions data
      const versionsResponse = await fetch(`/api/rules/${ruleId}/versions`);
      if (!versionsResponse.ok) throw new Error('Failed to load version history');
      const versionsResult = await versionsResponse.json();
      setVersions(versionsResult.data?.versions || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [ruleId]);

  useEffect(() => {
    fetchRuleAndVersions();
  }, [fetchRuleAndVersions]);

  const handleRollbackConfirm = (versionItem: RuleVersionItem) => {
    if (rule?.status === 'active') {
      toast.error('Cannot rollback active rule. Please edit status to "draft" or "inactive" first.');
      return;
    }
    setSelectedVersion(versionItem);
    setShowRollbackDialog(true);
  };

  const handleExecuteRollback = async () => {
    if (!selectedVersion) return;
    setIsRollingBack(true);

    try {
      const response = await fetch(`/api/rules/${ruleId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetVersion: selectedVersion.version,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Rollback failed');
      }

      toast.success(result.message || `Successfully rolled back to version ${selectedVersion.version}`);
      setShowRollbackDialog(false);
      // Reload lists
      fetchRuleAndVersions();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to rollback rule');
    } finally {
      setIsRollingBack(false);
      setSelectedVersion(null);
    }
  };

  if (isLoading && versions.length === 0) {
    return (
      <div className="container mx-auto py-12 text-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading version history...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-6 animate-in fade-in duration-300">
      {/* Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="space-y-1">
          <Link
            href={`/dashboard/rules/${ruleId}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rule Details
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <History className="h-7 w-7 text-primary" />
            Version History: <span className="text-primary">{rule?.name}</span>
          </h1>
          <p className="text-muted-foreground">
            Track and restore previous configurations of this business rule.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchRuleAndVersions} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh History
        </Button>
      </div>

      {/* Info Banner for Active Rule */}
      {rule?.status === 'active' && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-bold">Rollback is Locked</p>
            <p className="opacity-90">
              This rule is currently <strong>Active</strong>. To prevent accidental production bugs, rollback is disabled. 
              Please edit the rule and set its status to <strong>Draft</strong> first to enable rollback.
            </p>
          </div>
        </div>
      )}

      {/* History Table Card */}
      <Card className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Versions Log</CardTitle>
          <CardDescription>
            Current live version is <strong className="text-foreground">v{rule?.version}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              No version history records found.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Version</TableHead>
                    <TableHead className="w-[120px]">Change Type</TableHead>
                    <TableHead className="w-[300px]">Change Summary</TableHead>
                    <TableHead className="w-[180px]">Changed By</TableHead>
                    <TableHead className="w-[150px]">Date</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => {
                    const isCurrent = v.version === rule?.version;
                    
                    return (
                      <TableRow key={v.id} className={isCurrent ? 'bg-muted/30 font-medium' : ''}>
                        <TableCell>
                          <span className={`font-mono px-2 py-0.5 rounded text-xs ${
                            isCurrent ? 'bg-primary/20 text-primary font-bold' : 'bg-muted text-muted-foreground'
                          }`}>
                            v{v.version} {isCurrent && ' (Live)'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.changeType === 'rollback' ? 'outline' : 'secondary'} className="text-xs uppercase font-mono">
                            {v.changeType || 'Update'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm line-clamp-2">{v.changeSummary || 'Update rule configurations.'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm flex items-center gap-1.5 text-muted-foreground">
                            <User className="h-3 w-3" />
                            {v.changedBy?.name || 'System'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(v.changedAt), { addSuffix: true })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isCurrent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRollbackConfirm(v)}
                              disabled={rule?.status === 'active'}
                              className="text-primary hover:text-primary-foreground hover:bg-primary/80 gap-1.5 h-8"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              Rollback
                            </Button>
                          )}
                          {isCurrent && (
                            <span className="text-xs font-medium text-emerald-500 flex items-center justify-end gap-1 px-3 py-1">
                              Active
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rollback Confirmation Alert */}
      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-primary" />
              Confirm Rollback to v{selectedVersion?.version}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to rollback rule <strong>{rule?.name}</strong> to version <strong>v{selectedVersion?.version}</strong>?
              </p>
              <div className="p-3 bg-muted rounded-md text-xs font-mono">
                <p className="font-bold mb-1">Previous Change Summary:</p>
                <p className="text-muted-foreground">{selectedVersion?.changeSummary || 'No details provided.'}</p>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Note: This operation will increment the version number to v{(rule?.version || 1) + 1} with the snapshot copy of v{selectedVersion?.version}.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteRollback}
              disabled={isRollingBack}
              className="bg-primary text-primary-foreground hover:bg-primary/95"
            >
              {isRollingBack ? 'Rolling back...' : 'Confirm Rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
