import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('HQ subscription quota UI wiring', () => {
  it('adds a dedicated subscription quota tab to the HQ dashboard chrome', () => {
    const chromeSource = read('src/app/hq/components/HqDashboardChrome.tsx');

    expect(chromeSource).toContain("'subscriptions'");
    expect(chromeSource).toContain('Thuê bao & Hạn ngạch');
  });

  it('routes the HQ dashboard subscription tab to the quota console', () => {
    const clientSource = read('src/app/hq/hq-dashboard-client.tsx');

    expect(clientSource).toContain("activeTab === 'subscriptions'");
    expect(clientSource).toContain('<HqSubscriptionQuotaConsole');
    expect(clientSource).toContain('subscriptionRefreshSignal');
    expect(clientSource).toContain('onTenantSubscriptionChanged={handleTenantSubscriptionChanged}');
  });

  it('wires the quota console through audited HQ subscription server actions', () => {
    const consoleSource = read('src/app/hq/components/HqSubscriptionQuotaConsole.tsx');

    expect(consoleSource).toContain('getHqSubscriptionOverview');
    expect(consoleSource).toContain('updateTenantSubscriptionPlan');
    expect(consoleSource).toContain('setTenantQuotaOverride');
    expect(consoleSource).toContain('resetTenantUsageCounter');
    expect(consoleSource).toContain('toast.error(result.error');
    expect(consoleSource).toContain('window.confirm');
  });
});
