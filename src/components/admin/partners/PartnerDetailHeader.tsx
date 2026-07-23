'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, CheckCircle2, AlertCircle, Globe, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { APIPartner } from '@/types/api-gateway';

interface PartnerDetailHeaderProps {
  partner: APIPartner;
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  pos: 'Hệ thống POS',
  payment: 'Cổng thanh toán',
  invoice: 'Hóa đơn điện tử',
  franchise: 'Nhượng quyền',
  hr: 'Quản lý nhân sự',
  analytics: 'Phân tích dữ liệu',
  mobile_app: 'Ứng dụng di động',
  other: 'Tích hợp khác',
};

export function PartnerDetailHeader({ partner }: PartnerDetailHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get('embedded') === 'true';
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể xóa đối tác');
      }

      toast.success(`Đã xóa đối tác ${partner.partner_name} thành công`);
      setDeleteDialogOpen(false);
      
      // Redirect back to list page and refresh data
      router.push(`/dashboard/admin/partners${isEmbedded ? '?embedded=true' : ''}`);
      router.refresh();
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast.error(error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi xóa đối tác');
    } finally {
      setIsDeleting(false);
    }
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-slate-100 dark:border-slate-800/80 pb-6">
      {/* Left section: Back button & Partner Info */}
      <div className="flex items-start gap-4 flex-1">
        <Link href={`/dashboard/admin/partners${isEmbedded ? '?embedded=true' : ''}`}>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {partner.partner_name}
            </h1>
            <Badge 
              variant="outline"
              className="capitalize text-xs font-semibold px-2.5 py-0.5 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400"
            >
              {PARTNER_TYPE_LABELS[partner.partner_type] || partner.partner_type}
            </Badge>
          </div>
          
          {/* Metadata badges row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Environment Badge */}
            {partner.is_sandbox ? (
              <Badge 
                variant="outline" 
                className="bg-amber-50/70 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400 px-2 py-0.5 font-medium flex items-center gap-1"
              >
                <Cpu className="h-3 w-3" />
                🧪 Sandbox Environment
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className="bg-indigo-50/70 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900 dark:text-indigo-400 px-2 py-0.5 font-medium flex items-center gap-1"
              >
                <Globe className="h-3 w-3" />
                🚀 Production Environment
              </Badge>
            )}

            {/* Active/Inactive Badge */}
            {partner.is_active ? (
              <Badge 
                variant="outline" 
                className="bg-emerald-50/70 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400 px-2 py-0.5 font-medium flex items-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Đang hoạt động
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className="bg-rose-50/70 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 px-2 py-0.5 font-medium flex items-center gap-1"
              >
                <AlertCircle className="h-3 w-3 text-rose-500" />
                Ngừng hoạt động
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Right section: Header Action Buttons */}
      <div className="flex items-center gap-3 shrink-0">
        <Link href={`/dashboard/admin/partners/${partner.id}/edit${isEmbedded ? '?embedded=true' : ''}`}>
          <Button 
            variant="outline" 
            className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-all duration-300"
          >
            <Edit className="mr-2 h-4 w-4 text-slate-500" />
            Chỉnh Sửa
          </Button>
        </Link>
        <Button 
          variant="outline" 
          onClick={() => setDeleteDialogOpen(true)}
          className="rounded-xl border-rose-200 hover:border-rose-300 dark:border-rose-900 bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-semibold shadow-sm transition-all duration-300"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Xóa
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-5 w-5" />
              Xóa đối tác API?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400 pt-2 leading-relaxed">
              Bạn có chắc muốn xóa đối tác <strong>{partner.partner_name}</strong>?
              <br />
              <br />
              Hành động này sẽ tạm dừng hoạt động và thu hồi mọi kết nối API hiện tại của đối tác này đối với tenant của bạn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel 
              disabled={isDeleting}
              className="rounded-xl border-slate-200 dark:border-slate-800"
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-md transition-all duration-300"
            >
              {isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
