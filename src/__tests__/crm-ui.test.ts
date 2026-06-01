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

    expect(pageSource).toContain('useCrmPageData');
    expect(pageSource).toContain('<CrmLoadErrorBanner');
    expect(dataHookSource).toContain('const [loadError, setLoadError]');
    expect(dataHookSource).toContain('Không thể tải dữ liệu CRM');
    expect(bannerSource).toContain('Lỗi tải dữ liệu CRM');
    expect(bannerSource).toContain('Thử lại');
    expect(pageSource).toContain('Không thể tải danh sách lịch nhắc hẹn.');
    expect(pageSource).toContain('Không thể tải danh sách sinh nhật trong tháng.');
    expect(pageSource).toContain('Không thể tải nhật ký gửi tin nhắn.');
  });

  it('keeps manual Zalo batch scan quota skip details visible', () => {
    const actionHookSource = read('src/app/dashboard/crm/hooks/useCrmPageActions.ts');

    expect(actionHookSource).toContain('quotaSkipped?: string[]');
    expect(actionHookSource).toContain('Bị bỏ qua do hạn ngạch');
  });

  it('routes page chrome through dedicated CRM components', () => {
    const pageSource = read('src/app/dashboard/crm/page.tsx');
    const headerSource = read('src/app/dashboard/crm/components/CrmHeader.tsx');
    const tabsSource = read('src/app/dashboard/crm/components/CrmTabs.tsx');

    expect(pageSource).toContain('<CrmHeader');
    expect(pageSource).toContain('<CrmTabs');
    expect(headerSource).toContain('QUÉT LỊCH HẸN HÔM NAY');
    expect(tabsSource).toContain('TỔNG QUAN & CÀI ĐẶT ZALO');
  });
});
