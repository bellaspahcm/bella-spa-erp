import { Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import RuleEditor from '@/components/rules/RuleEditor';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createServerClient } from '@/lib/supabase-server';
import DecisionEngineHeader from '@/components/decision-engine/DecisionEngineHeader';

export const metadata: Metadata = {
  title: 'Chỉnh sửa Quy tắc Luật | Bella ERP',
  description: 'Cập nhật điều kiện và hành động cho quy tắc luật nghiệp vụ',
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
      <Card className="bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border border-white/20 dark:border-white/5 shadow-sm rounded-xl">
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#11100F] transition-colors duration-300">
      {/* Shared Tabs Header */}
      <DecisionEngineHeader />

      <div className="flex flex-col gap-6 p-6 container mx-auto max-w-5xl animate-in fade-in duration-500">
        {/* Action Row / Breadcrumb */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border border-white/20 dark:border-white/5 p-6 rounded-xl shadow-sm">
          <div className="space-y-1">
            <Link
              href={`/dashboard/rules/${ruleId}`}
              className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-primary transition-all mb-2"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Quay lại chi tiết
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Chỉnh Sửa Quy Tắc Luật
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cập nhật các điều kiện và hành động cho quy tắc: <span className="font-semibold text-slate-800 dark:text-slate-200">{rule.name}</span>
            </p>
          </div>
        </div>

        <Suspense fallback={<RuleEditorSkeleton />}>
          <RuleEditor mode="edit" ruleId={ruleId} initialData={rule} />
        </Suspense>
      </div>
    </div>
  );
}
