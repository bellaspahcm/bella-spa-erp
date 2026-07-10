'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import RuleMetadataForm from './RuleMetadataForm';
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
  const [formData, setFormData] = useState(initialData || {
    name: '',
    description: '',
    provider: 'booking',
    category: '',
    priority: 100,
    status: 'draft',
    conditions: [
      {
        field: 'customer.tier',
        operator: 'equals',
        value: 'VIP'
      }
    ],
    actions: [
      {
        type: 'set_priority',
        value: 1000
      }
    ],
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validation
      if (!formData.name || !formData.provider) {
        toast({
          title: 'Validation Error',
          description: 'Name and Provider are required',
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
        throw new Error(error.error || 'Failed to save rule');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description: mode === 'create' ? 'Rule created successfully' : 'Rule updated successfully',
      });

      router.push(`/dashboard/rules/${result.data?.id || result.id || ''}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Discard changes?')) {
      router.push('/dashboard/rules');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rule Information</CardTitle>
          <CardDescription>
            Define the basic properties of your rule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RuleMetadataForm
            data={formData}
            onChange={setFormData}
          />
        </CardContent>
      </Card>

      {/* Conditions and Actions will be added in Phase 3 */}
      
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Rule
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
