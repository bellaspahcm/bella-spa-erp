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
        throw new Error(error.error || 'Không thể lưu quy tắc luật');
      }

      const result = await response.json();

      toast({
        title: 'Thành công',
        description: mode === 'create' ? 'Tạo quy tắc luật thành công' : 'Cập nhật quy tắc luật thành công',
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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Vui lòng sửa các lỗi sau:
            <ul className="list-disc list-inside mt-2">
              {Object.entries(validationErrors).map(([key, error]) => (
                <li key={key} className="text-sm">
                  {error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin Quy tắc Luật</CardTitle>
          <CardDescription>
            Định nghĩa các thuộc tính cơ bản của quy tắc luật
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RuleMetadataForm
            data={formData}
            onChange={setFormData}
          />
        </CardContent>
      </Card>

      {/* Conditions Builder - Phase 3 */}
      <RuleConditionsBuilder
        provider={formData.provider}
        conditions={formData.conditions || []}
        onChange={(conditions) => setFormData({ ...formData, conditions })}
        logicalOperator={formData.logicalOperator || 'and'}
        onLogicalOperatorChange={(operator) => setFormData({ ...formData, logicalOperator: operator })}
        errors={validationErrors}
        disabled={isSaving}
      />

      {/* Actions Builder - Phase 3 */}
      <RuleActionsBuilder
        provider={formData.provider}
        actions={formData.actions || []}
        onChange={(actions) => setFormData({ ...formData, actions })}
        errors={validationErrors}
        disabled={isSaving}
      />
      
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="mr-2 h-4 w-4" />
          Hủy bỏ
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu...
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
