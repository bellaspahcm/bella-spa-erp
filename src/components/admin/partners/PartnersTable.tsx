/**
 * Partners Table Component
 * 
 * Displays partners in a data table with:
 * - Partner info (name, type, status)
 * - API key (masked)
 * - Scopes count
 * - Last request
 * - Quick actions (view, edit, regenerate key, delete)
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Key,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn, copyToClipboard } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { APIPartner } from '@/types/api-gateway';

interface PartnersTableProps {
  partners: APIPartner[];
  loading: boolean;
  onRefresh: () => void;
}

export function PartnersTable({ partners, loading, onRefresh }: PartnersTableProps) {
  const router = useRouter();
  
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    partner: APIPartner | null;
  }>({ open: false, partner: null });
  
  const [regenerateDialog, setRegenerateDialog] = useState<{
    open: boolean;
    partner: APIPartner | null;
  }>({ open: false, partner: null });

  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get('embedded') === 'true';

  // Handlers
  const handleView = (partner: APIPartner) => {
    router.push(`/dashboard/admin/partners/${partner.id}${isEmbedded ? '?embedded=true' : ''}`);
  };

  const handleEdit = (partner: APIPartner) => {
    router.push(`/dashboard/admin/partners/${partner.id}/edit${isEmbedded ? '?embedded=true' : ''}`);
  };

  const handleCopyApiKey = async (apiKey: string) => {
    const success = await copyToClipboard(apiKey);
    if (success) {
      toast.success('API key copied to clipboard');
    } else {
      toast.error('Failed to copy API key to clipboard');
    }
  };

  const handleRegenerateKey = async (partner: APIPartner) => {
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/regenerate-key`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate API key');
      }

      toast.success(`New API key generated for ${partner.partner_name}`);

      onRefresh();
      setRegenerateDialog({ open: false, partner: null });
    } catch (_error) {
      toast.error('Failed to regenerate API key');
    }
  };

  const handleDelete = async (partner: APIPartner) => {
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete partner');
      }

      toast.success(`${partner.partner_name} has been deleted`);

      onRefresh();
      setDeleteDialog({ open: false, partner: null });
    } catch (_error) {
      toast.error('Failed to delete partner');
    }
  };

  // Helpers
  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  };

  const getPartnerTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pos: 'POS',
      payment: 'Payment',
      invoice: 'Invoice',
      franchise: 'Franchise',
      hr: 'HR',
      analytics: 'Analytics',
      mobile_app: 'Mobile App',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getPartnerTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      pos: 'bg-blue-100 text-blue-800',
      payment: 'bg-green-100 text-green-800',
      invoice: 'bg-purple-100 text-purple-800',
      franchise: 'bg-orange-100 text-orange-800',
      hr: 'bg-pink-100 text-pink-800',
      analytics: 'bg-indigo-100 text-indigo-800',
      mobile_app: 'bg-cyan-100 text-cyan-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Last Request</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <div className="h-12 bg-muted animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No partners found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first API partner to get started
        </p>
        <Button className="mt-4" onClick={() => router.push(`/dashboard/admin/partners/new${isEmbedded ? '?embedded=true' : ''}`)}>
          Create Partner
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Last Request</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((partner) => (
              <TableRow key={partner.id} className="cursor-pointer hover:bg-muted/50">
                {/* Partner Info */}
                <TableCell onClick={() => handleView(partner)}>
                  <div>
                    <div className="font-medium">{partner.partner_name}</div>
                    {partner.is_sandbox && (
                      <Badge variant="outline" className="mt-1">
                        Sandbox
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell onClick={() => handleView(partner)}>
                  <Badge className={getPartnerTypeColor(partner.partner_type)}>
                    {getPartnerTypeLabel(partner.partner_type)}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell onClick={() => handleView(partner)}>
                  {partner.is_active ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>Inactive</span>
                    </div>
                  )}
                </TableCell>

                {/* API Key */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {maskApiKey(partner.api_key)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopyApiKey(partner.api_key)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>

                {/* Scopes */}
                <TableCell onClick={() => handleView(partner)}>
                  <span className="text-sm text-muted-foreground">
                    {partner.allowed_scopes.length} scopes
                  </span>
                </TableCell>

                {/* Last Request */}
                <TableCell onClick={() => handleView(partner)}>
                  {partner.last_request_at ? (
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(partner.last_request_at), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Never</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleView(partner)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(partner)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Partner
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyApiKey(partner.api_key)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy API Key
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setRegenerateDialog({ open: true, partner })}
                      >
                        <Key className="mr-2 h-4 w-4" />
                        Regenerate Key
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteDialog({ open: true, partner })}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Partner
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open: boolean) => setDeleteDialog({ open, partner: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Partner</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.partner?.partner_name}</strong>?
              This will immediately revoke their API access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.partner && handleDelete(deleteDialog.partner)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Partner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Key Confirmation Dialog */}
      <AlertDialog
        open={regenerateDialog.open}
        onOpenChange={(open: boolean) => setRegenerateDialog({ open, partner: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to regenerate the API key for{' '}
              <strong>{regenerateDialog.partner?.partner_name}</strong>? Their current API key will
              immediately stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                regenerateDialog.partner && handleRegenerateKey(regenerateDialog.partner)
              }
            >
              Regenerate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
