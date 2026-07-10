import { Suspense } from 'react';
import { Metadata } from 'next';
import RuleEditor from '@/components/rules/RuleEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Create New Rule | Bella ERP',
  description: 'Create a new decision rule',
};

function RuleEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewRulePage() {
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create New Rule</h1>
        <p className="text-muted-foreground mt-2">
          Define conditions and actions for automated decision making
        </p>
      </div>

      <Suspense fallback={<RuleEditorSkeleton />}>
        <RuleEditor mode="create" />
      </Suspense>
    </div>
  );
}
