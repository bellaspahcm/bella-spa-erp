/**
 * Automation Studio - Template Customization Page
 * 
 * This page allows users to customize a selected template.
 * 
 * UX Flow:
 * 1. User clicks template from gallery
 * 2. Land here with 90% pre-filled fields
 * 3. User adjusts 1-2 values (e.g., discount percentage)
 * 4. Preview updates live
 * 5. Test with real customer (Simulation)
 * 6. Save automation
 * 
 * URL: /dashboard/automation/new?template=promo-vip-discount
 * 
 * @author Automation Studio Team
 * @date 2026-07-09
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Sparkles,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { getTemplateById, type AutomationTemplate } from '@/lib/automation/templates';
import { PreviewPanel, EmptyStateCard, SimulationTool } from '@/components/automation';

function NewAutomationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');

  const [template, setTemplate] = useState<AutomationTemplate | null>(null);
  const [currentStep, setCurrentStep] = useState<'customize' | 'simulate' | 'review'>('customize');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (templateId) {
      const foundTemplate = getTemplateById(templateId);
      if (foundTemplate) {
        setTemplate(foundTemplate);
      }
    }
  }, [templateId]);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Integrate with Decision Engine API
    setTimeout(() => {
      setIsSaving(false);
      router.push('/dashboard/automation');
    }, 1500);
  };

  if (!template) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6">
        <div className="max-w-4xl mx-auto">
          <EmptyStateCard
            icon="⚠️"
            headline="Template không tồn tại"
            description="Không tìm thấy template này. Vui lòng chọn template khác."
            primaryAction={{
              label: "← Về trang chủ",
              onClick: () => router.push('/dashboard/automation')
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-rose-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back button + Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-rose-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại
              </button>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{template.icon}</span>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {template.name}
                  </h1>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {template.description}
                </p>
              </div>
            </div>

            {/* Right: Save button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl font-medium shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu automation
                </>
              )}
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { id: 'customize', label: 'Tùy chỉnh', icon: Sparkles },
              { id: 'simulate', label: 'Thử nghiệm', icon: Eye },
              { id: 'review', label: 'Xem lại', icon: Clock },
            ].map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = ['customize', 'simulate'].indexOf(currentStep) > ['customize', 'simulate', 'review'].indexOf(step.id);
              
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.id as typeof currentStep)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-rose-100 text-rose-700'
                        : isCompleted
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{step.label}</span>
                  </button>
                  {index < 2 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Customization Form (2/3 width) */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              {currentStep === 'customize' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      ⚙️ Tùy chỉnh automation
                    </h2>
                    <p className="text-sm text-gray-500">
                      Điều chỉnh các điều kiện và hành động theo nhu cầu của bạn
                    </p>
                  </div>

                  {/* Conditions Section */}
                  <div className="mb-8">
                    <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-blue-500">📋</span>
                      Khi nào Bella sẽ chạy?
                    </h3>
                    <div className="space-y-3">
                      {template.conditions.map((condition, index) => (
                        <div
                          key={index}
                          className="p-4 bg-blue-50 border border-blue-200 rounded-xl"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{condition.icon}</span>
                            <div>
                              <p className="font-medium text-gray-900">
                                {condition.label}
                              </p>
                              <p className="text-sm text-gray-500">
                                {condition.description}
                              </p>
                            </div>
                          </div>
                          {/* TODO: Add input controls based on condition.type */}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div>
                    <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-green-500">⚡</span>
                      Bella sẽ làm gì?
                    </h3>
                    <div className="space-y-3">
                      {template.actions.map((action, index) => (
                        <div
                          key={index}
                          className="p-4 bg-green-50 border border-green-200 rounded-xl"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{action.icon}</span>
                            <div>
                              <p className="font-medium text-gray-900">
                                {action.label}
                              </p>
                              <p className="text-sm text-gray-500">
                                {action.description}
                              </p>
                            </div>
                          </div>
                          {/* TODO: Add input controls based on action.type */}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Step Button */}
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setCurrentStep('simulate')}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
                    >
                      Tiếp theo: Thử nghiệm
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'simulate' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      🧪 Thử nghiệm với dữ liệu thật
                    </h2>
                    <p className="text-sm text-gray-500">
                      Chọn một khách hàng để xem Bella sẽ làm gì
                    </p>
                  </div>

                  <SimulationTool template={template} onComplete={() => setCurrentStep('review')} />

                  {/* Navigation back option */}
                  <div className="mt-6 flex justify-start">
                    <button
                      onClick={() => setCurrentStep('customize')}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all text-xs"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Quay lại tùy chỉnh
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'review' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      ✅ Xem lại automation
                    </h2>
                    <p className="text-sm text-gray-500">
                      Kiểm tra lại trước khi lưu
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{template.icon}</span>
                        <h3 className="font-semibold text-gray-900">
                          {template.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-purple-600">
                          <Clock className="w-4 h-4" />
                          <span>{template.estimatedSetupTime}</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600">
                          <Sparkles className="w-4 h-4" />
                          <span>{template.valueProp}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <h4 className="font-medium text-gray-900 mb-2">
                        📋 Điều kiện ({template.conditions.length})
                      </h4>
                      <ul className="space-y-1">
                        {template.conditions.map((condition, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-center gap-2">
                            <span>{condition.icon}</span>
                            <span>{condition.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <h4 className="font-medium text-gray-900 mb-2">
                        ⚡ Hành động ({template.actions.length})
                      </h4>
                      <ul className="space-y-1">
                        {template.actions.map((action, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-center gap-2">
                            <span>{action.icon}</span>
                            <span>{action.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="mt-6 flex justify-between">
                    <button
                      onClick={() => setCurrentStep('simulate')}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Quay lại
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          🎉 Xong rồi! Lưu automation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right: Live Preview (1/3 width, sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <PreviewPanel
                conditions={template.conditions.map(c => c.label)}
                actions={template.actions.map(a => a.label)}
                jsonData={{
                  template: template.name,
                  conditions: template.conditions.map(c => c.label),
                  actions: template.actions.map(a => a.label),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewAutomationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p className="text-gray-600 font-bold uppercase text-[10px] tracking-widest">Đang tải...</p>
        </div>
      </div>
    }>
      <NewAutomationContent />
    </Suspense>
  );
}
