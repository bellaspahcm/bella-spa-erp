import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('CRM page error handling UI', () => {
  it('surfaces CRM load failures instead of showing silent empty states', () => {
    const pageSource = read('src/app/dashboard/crm/page.tsx');
    const dataHookSource = read('src/app/dashboard/crm/hooks/useCrmPageData.ts');
    const bannerSource = read('src/app/dashboard/crm/components/CrmLoadErrorBanner.tsx');
    const remindersSource = read('src/app/dashboard/crm/components/CrmRemindersTab.tsx');
    const marketingSource = read('src/app/dashboard/crm/components/CrmMarketingTab.tsx');
    const logsSource = read('src/app/dashboard/crm/components/CrmLogsTab.tsx');

    expect(pageSource).toContain('useCrmPageData');
    expect(pageSource).toContain('<CrmLoadErrorBanner');
    expect(dataHookSource).toContain('const [loadError, setLoadError]');
    expect(dataHookSource).toContain('setLoadError');
    expect(bannerSource).toContain('onRetry');
    expect(bannerSource).toContain('loading');
    expect(remindersSource).toContain('loadError ?');
    expect(marketingSource).toContain('loadError ?');
    expect(logsSource).toContain('loadError ?');
  });

  it('keeps manual Zalo batch scan quota skip details visible', () => {
    const actionHookSource = read('src/app/dashboard/crm/hooks/useCrmPageActions.ts');

    expect(actionHookSource).toContain('quotaSkipped?: string[]');
    expect(actionHookSource).toContain('skippedDetails');
  });

  it('routes page chrome and tab bodies through dedicated CRM components', () => {
    const pageSource = read('src/app/dashboard/crm/page.tsx');
    const headerSource = read('src/app/dashboard/crm/components/CrmHeader.tsx');
    const tabsSource = read('src/app/dashboard/crm/components/CrmTabs.tsx');
    const overviewSource = read('src/app/dashboard/crm/components/CrmOverviewTab.tsx');
    const remindersSource = read('src/app/dashboard/crm/components/CrmRemindersTab.tsx');
    const marketingSource = read('src/app/dashboard/crm/components/CrmMarketingTab.tsx');
    const logsSource = read('src/app/dashboard/crm/components/CrmLogsTab.tsx');
    const voucherModalSource = read('src/app/dashboard/crm/components/CrmVoucherModal.tsx');

    expect(pageSource).toContain('<CrmHeader');
    expect(pageSource).toContain('<CrmTabs');
    expect(pageSource).toContain('<CrmOverviewTab');
    expect(pageSource).toContain('<CrmRemindersTab');
    expect(pageSource).toContain('<CrmMarketingTab');
    expect(pageSource).toContain('<CrmLogsTab');
    expect(pageSource).toContain('<CrmVoucherModal');
    expect(headerSource).toContain('onManualScan');
    expect(tabsSource).toContain('onTabChange');
    expect(overviewSource).toContain('setZaloConfig');
    expect(remindersSource).toContain('onSendSingleReminder');
    expect(marketingSource).toContain('onSendBirthday');
    expect(logsSource).toContain('format(new Date(log.createdAt)');
    expect(voucherModalSource).toContain('onSubmit={onSubmit}');
  });
});
