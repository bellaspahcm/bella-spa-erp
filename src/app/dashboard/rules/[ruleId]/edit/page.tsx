import { Suspense } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RuleEditor from '@/components/rules/RuleEditor';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createServerClient } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Edit Rule | Bella ERP',
  description: 'Edit decision rule',
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

function RuleEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function EditRulePage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  const rule = await getRuleData(ruleId);

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Rule</h1>
        <p className="text-muted-foreground mt-2">
          Modify rule conditions and actions
        </p>
      </div>

      <Suspense fallback={<RuleEditorSkeleton />}>
        <RuleEditor mode="edit" ruleId={ruleId} initialData={rule} />
      </Suspense>
    </div>
  );
}
