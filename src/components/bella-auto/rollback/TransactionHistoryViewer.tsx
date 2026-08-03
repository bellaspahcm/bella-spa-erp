/**
 * Transaction History Viewer
 * 
 * Displays transaction history for an entity with filtering and drill-down.
 * Used in vehicle detail, booking detail, service appointment pages.
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Transaction {
  id: string;
  transactionType: string;
  status: 'pending' | 'committed' | 'rolled_back' | 'failed';
  entityType: string;
  entityId: string;
  createdAt: string;
  createdBy?: string;
  rollbackReason?: string;
  rolledBackAt?: string;
  rolledBackBy?: string;
  stepCount: number;
}

interface TransactionHistoryViewerProps {
  entityType: string;
  entityId: string;
  onViewDetails?: (transactionId: string) => void;
  onRollback?: (transactionId: string) => void;
}

export function TransactionHistoryViewer({
  entityType,
  entityId,
  onViewDetails,
  onRollback,
}: TransactionHistoryViewerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadTransactions();
  }, [entityType, entityId, filterStatus, filterType]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
      });
      
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterType !== 'all') params.append('type', filterType);

      const response = await fetch(`/api/bella-auto/transactions?${params}`);
      const data = await response.json();
      
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'committed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'rolled_back':
        return <RotateCcw className="w-4 h-4 text-orange-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      committed: 'default',
      rolled_back: 'destructive',
      failed: 'destructive',
      pending: 'secondary',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const canRollback = (tx: Transaction) => {
    return tx.status === 'committed' && onRollback;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-4">
        <Filter className="w-4 h-4 text-gray-500" />
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="committed">Committed</SelectItem>
            <SelectItem value="rolled_back">Rolled Back</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vehicle_delivery">Vehicle Delivery</SelectItem>
            <SelectItem value="service_complete">Service Complete</SelectItem>
            <SelectItem value="trade_in_approval">Trade-In Approval</SelectItem>
            <SelectItem value="loan_disbursement">Loan Disbursement</SelectItem>
            <SelectItem value="quotation_approval">Quotation Approval</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-gray-500 ml-auto">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-gray-400 mb-2">
              <RotateCcw className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600">No transactions found</p>
            <p className="text-sm text-gray-500 mt-1">
              Transactions will appear here once business operations are performed
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <Card key={tx.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Status icon */}
                  <div className="mt-1">
                    {getStatusIcon(tx.status)}
                  </div>

                  {/* Transaction info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {tx.transactionType.replace(/_/g, ' ')}
                      </span>
                      {getStatusBadge(tx.status)}
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        Created: {format(new Date(tx.createdAt), 'PPp')}
                        {tx.createdBy && ` by ${tx.createdBy}`}
                      </div>
                      
                      {tx.status === 'rolled_back' && tx.rollbackReason && (
                        <div className="flex items-start gap-2 text-orange-600">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium">Rolled back:</div>
                            <div>{tx.rollbackReason}</div>
                            {tx.rolledBackAt && (
                              <div className="text-xs text-gray-500 mt-1">
                                {format(new Date(tx.rolledBackAt), 'PPp')}
                                {tx.rolledBackBy && ` by ${tx.rolledBackBy}`}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
                        {tx.stepCount} step{tx.stepCount !== 1 ? 's' : ''} executed
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {onViewDetails && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewDetails(tx.id)}
                      >
                        View Details
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}

                    {canRollback(tx) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onRollback!(tx.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
