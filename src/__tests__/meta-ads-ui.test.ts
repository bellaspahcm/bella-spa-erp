import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const mojibakePattern = /\uFFFD|\u00EF\u00BF\u00BD|\u00C3|\u00C4|\u00C2|\u00F0\u0178|\u00E1\u00BA|\u00E1\u00BB|\u00C6|\u00E2\u20AC|\u00E2\u20AC\u00A2/;

function read(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Meta Ads UI integration', () => {
  it('keeps Meta Ads UI copy free from mojibake markers', () => {
    [
      'src/app/dashboard/marketing/page.tsx',
      'src/app/dashboard/settings/components/MetaAdsSettingsTab.tsx',
    ].forEach((file) => {
      expect(read(file)).not.toMatch(mojibakePattern);
    });
  });

  it('wires Meta Ads into settings and dashboard navigation', () => {
    const settingsSource = read('src/app/dashboard/settings/page.tsx');
    const sidebarSource = read('src/components/layout/sidebar.tsx');
    
    // Check permissions module exports correctly (via @bella/shared re-export)
    const { SIDEBAR_MODULE_BY_LABEL } = require('../lib/business-rules/permissions');

    expect(settingsSource).toContain('MetaAdsSettingsTab');
    expect(settingsSource).toContain('meta-ads');
    expect(sidebarSource).toContain("href: '/dashboard/marketing'");
    expect(sidebarSource.indexOf("href: '/dashboard/crm'")).toBeLessThan(
      sidebarSource.indexOf("href: '/dashboard/marketing'"),
    );
    expect(sidebarSource.indexOf("href: '/dashboard/marketing'")).toBeLessThan(
      sidebarSource.indexOf("href: '/dashboard/services'"),
    );
    
    // Verify Meta Ads is properly mapped (runtime check instead of source check)
    expect(SIDEBAR_MODULE_BY_LABEL['Meta Ads']).toBe('marketing_ads');
  });

  it('uses shared dropdown UI and horizontal table scrolling', () => {
    const settingsTabSource = read('src/app/dashboard/settings/components/MetaAdsSettingsTab.tsx');
    const dashboardSource = read('src/app/dashboard/marketing/page.tsx');

    expect(settingsTabSource).toContain('PremiumSelect');
    expect(settingsTabSource).not.toContain('<select');
    expect(settingsTabSource).toContain('type="password"');
    expect(settingsTabSource).toContain('token_last_four');
    expect(settingsTabSource).toContain('deleteUnusedMetaAdAccountConnection');
    expect(settingsTabSource).toContain('Trash2');
    expect(dashboardSource).toContain('PremiumSelect');
    expect(dashboardSource).toContain('overflow-x-auto');
    expect(dashboardSource).toContain('min-w-[1280px]');
    expect(dashboardSource).toContain('recognizeMetaAdsSpendAsExpense');
    expect(dashboardSource).toContain('Ghi nhận chi phí');
    expect(dashboardSource).toContain('isRecognizingExpense');
    expect(dashboardSource).not.toContain('sticky');
  });

  it('does not expose encrypted Meta tokens through read-facing selects', () => {
    const serviceSource = read('src/services/marketing/meta-ads.ts');

    expect(serviceSource).toContain('META_AD_ACCOUNT_SAFE_SELECT');
    expect(serviceSource).toContain('access_token_encrypted');
    expect(serviceSource).not.toContain(".from('marketing_meta_ad_accounts')\n    .select('*')");
  });
});
