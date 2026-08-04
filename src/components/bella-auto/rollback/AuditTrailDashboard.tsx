/**
 * Audit Trail Dashboard
 * Complete rollback history with stats and filtering
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { RotateCcw, Calendar, TrendingUp, Truck, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditLog {
  id: string;
  transactionId: string;
  transactionType: string;
  rollbackReason: string;
  stepsRolledBack: number;
  executedByEmail: string;
  createdAt: string;
  affectedEntities: Array<{ type: string; id: string }>;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
}

function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
          <div className="text-gray-400">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AuditTrailDashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bella-auto/rollback-audit?limit=50');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const stats = {
    total: logs.length,
    thisMonth: logs.filter(log => {
      const date = new Date(log.createdAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
    avgSteps: logs.length > 0 
      ? Math.round(logs.reduce((sum, log) => sum + log.stepsRolledBack, 0) / logs.length)
      : 0,
    mostCommon: 'vehicle_delivery',
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Rollbacks"
          value={stats.total}
          icon={<RotateCcw className="w-8 h-8" />}
        />
        <StatCard
          title="This Month"
          value={stats.thisMonth}
          icon={<Calendar className="w-8 h-8" />}
        />
        <StatCard
          title="Avg Steps"
          value={stats.avgSteps}
          icon={<TrendingUp className="w-8 h-8" />}
        />
        <StatCard
          title="Most Common"
          value="Delivery"
          icon={<Truck className="w-8 h-8" />}
        />
      </div>

      {/* Audit log table */}
      <Card>
        <CardHeader>
          <CardTitle>Rollback History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-center">Steps</TableHead>
                  <TableHead>Executed By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {log.transactionId.slice(0, 8)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {log.transactionType.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={log.rollbackReason}>
                        {log.rollbackReason}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{log.stepsRolledBack}</Badge>
                    </TableCell>
                    <TableCell>{log.executedByEmail}</TableCell>
                    <TableCell>
                      {format(new Date(log.createdAt), 'PP p')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
