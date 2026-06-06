'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CrmHeader } from './components/CrmHeader';
import { CrmLoadErrorBanner } from './components/CrmLoadErrorBanner';
import { CrmLogsTab } from './components/CrmLogsTab';
import { CrmMarketingTab } from './components/CrmMarketingTab';
import { CrmOverviewTab } from './components/CrmOverviewTab';
import { CrmRemindersTab } from './components/CrmRemindersTab';
import { CrmTabs } from './components/CrmTabs';
import { CrmVoucherModal } from './components/CrmVoucherModal';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useCrmPageActions } from './hooks/useCrmPageActions';
import { useCrmPageData } from './hooks/useCrmPageData';
import { useCrmVoucherCampaigns } from './hooks/useCrmVoucherCampaigns';
import type { CrmTabId } from './types';

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<CrmTabId>('overview');
  const {
    stats,
    upcomingSessions,
    birthdayCustomers,
    znsLogs,
    zaloConfig,
    setZaloConfig,
    loading,
    loadError,
    loadData,
  } = useCrmPageData();
  const {
    scanning,
    actionLoading,
    handleManualScan,
    handleSendSingleReminder,
    handleSendBirthday,
    handleSaveConfig,
  } = useCrmPageActions({ loadData, zaloConfig });
  const {
    vouchers,
    isLoadingVouchers,
    voucherError,
    isVoucherModalOpen,
    newVoucher,
    setNewVoucher,
    openVoucherModal,
    closeVoucherModal,
    handleCreateVoucher,
  } = useCrmVoucherCampaigns();

  usePageRefresh(loadData);

  return (
    <div className="flex flex-col flex-1 overflow-auto p-4 lg:p-8 space-y-8 custom-scrollbar bg-slate-50/50">
      <CrmHeader
        loading={loading}
        scanning={scanning}
        onRefresh={loadData}
        onManualScan={handleManualScan}
      />

      <CrmTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {loadError && (
        <CrmLoadErrorBanner
          error={loadError}
          loading={loading}
          onRetry={loadData}
        />
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 opacity-60">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-primary">Đang đồng bộ dữ liệu CRM...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          {activeTab === 'overview' && (
            <CrmOverviewTab
              stats={stats}
              zaloConfig={zaloConfig}
              setZaloConfig={setZaloConfig}
              actionLoading={actionLoading}
              onSaveConfig={handleSaveConfig}
            />
          )}

          {activeTab === 'reminders' && (
            <CrmRemindersTab
              upcomingSessions={upcomingSessions}
              loadError={loadError}
              actionLoading={actionLoading}
              onSendSingleReminder={handleSendSingleReminder}
            />
          )}

          {activeTab === 'marketing' && (
            <CrmMarketingTab
              birthdayCustomers={birthdayCustomers}
              vouchers={vouchers}
              loadError={loadError}
              voucherError={voucherError}
              isLoadingVouchers={isLoadingVouchers}
              actionLoading={actionLoading}
              onSendBirthday={handleSendBirthday}
              onOpenVoucherModal={openVoucherModal}
            />
          )}

          {activeTab === 'logs' && (
            <CrmLogsTab znsLogs={znsLogs} loadError={loadError} />
          )}
        </div>
      )}

      {isVoucherModalOpen && (
        <CrmVoucherModal
          newVoucher={newVoucher}
          onChange={setNewVoucher}
          onClose={closeVoucherModal}
          onSubmit={handleCreateVoucher}
        />
      )}
    </div>
  );
}
