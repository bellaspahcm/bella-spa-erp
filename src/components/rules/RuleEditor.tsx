'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import RuleMetadataForm from './RuleMetadataForm';
import { RuleConditionsBuilder } from './RuleConditionsBuilder';
import { RuleActionsBuilder } from './RuleActionsBuilder';
import { validateRuleForm } from '@/lib/decision-engine/rule-validation';
import { Loader2, Save, X } from 'lucide-react';

interface RuleEditorProps {
  mode: 'create' | 'edit';
  ruleId?: string;
  initialData?: any;
}

export default function RuleEditor({ mode, ruleId, initialData }: RuleEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState(initialData || {
    name: '',
    description: '',
    provider: 'booking',
    category: '',
    priority: 100,
    status: 'draft',
    conditions: [],
    actions: [],
    logicalOperator: 'and',
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setValidationErrors({});

      // Client-side validation
      const validationResult = validateRuleForm(formData);
      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors);
        toast({
          title: 'Lỗi xác thực',
          description: 'Vui lòng sửa các lỗi trong biểu mẫu trước khi lưu',
          variant: 'destructive',
        });
        return;
      }

      const url = mode === 'create' ? '/api/rules' : `/api/rules/${ruleId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Không thể lưu quy tắc');
      }

      const result = await response.json();

      toast({
        title: 'Thành công',
        description: mode === 'create' ? 'Tạo quy tắc thành công' : 'Cập nhật quy tắc thành công',
      });

      router.push(`/dashboard/rules/${result.data?.id || result.id || ''}`);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Hủy bỏ các thay đổi?')) {
      router.push('/dashboard/rules');
    }
  };

  return (
    <div className="space-y-6">
      {/* Validation Error Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="flex gap-3 items-start rounded-3xl border border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 p-5 shadow-sm animate-in fade-in duration-300">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1.5 w-full">
            <h5 className="font-bold text-sm tracking-wider uppercase">Lỗi xác thực dữ liệu</h5>
            <p className="text-xs text-red-500/80 dark:text-red-400/80">Vui lòng điều chỉnh các thông tin cấu hình luật dưới đây:</p>
            <ul className="list-disc list-inside mt-2 text-xs space-y-1">
              {Object.entries(validationErrors).map(([key, error]) => (
                <li key={key} className="pl-1">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Metadata card info */}
      <Card className="bg-white/50 dark:bg-zinc-950/40 backdrop-blur-md border border-slate-200/60 dark:border-zinc-800/40 shadow-md rounded-3xl overflow-hidden relative">
        {/* Top Gradient Ribbon (Canva Style) */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-violet-500 via-primary to-accent" />

        <CardHeader className="pt-7 pb-5">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
            Thông tin Quy tắc
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Thiết lập tên, mô tả, mức độ ưu tiên và nghiệp vụ quyết định áp dụng
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-7">
          <RuleMetadataForm
            data={formData}
            onChange={setFormData}
          />
        </CardContent>
      </Card>

      {/* Conditions Builder */}
      <RuleConditionsBuilder
        provider={formData.provider}
        conditions={formData.conditions || []}
        onChange={(conditions) => setFormData({ ...formData, conditions })}
        logicalOperator={formData.logicalOperator || 'and'}
        onLogicalOperatorChange={(operator) => setFormData({ ...formData, logicalOperator: operator })}
        errors={validationErrors}
        disabled={isSaving}
      />

      {/* Actions Builder */}
      <RuleActionsBuilder
        provider={formData.provider}
        actions={formData.actions || []}
        onChange={(actions) => setFormData({ ...formData, actions })}
        errors={validationErrors}
        disabled={isSaving}
      />

      {/* Bottom Button Actions row */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-11 px-6 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-600 dark:text-zinc-350 text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95"
        >
          <X className="mr-2 h-4 w-4" />
          Hủy bỏ thay đổi
        </Button>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 px-6 rounded-2xl bg-gradient-to-r from-primary via-primary-hover to-accent hover:from-primary/90 hover:to-accent/90 text-white font-extrabold text-xs uppercase tracking-widest shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu quy tắc...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Lưu Quy tắc
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
