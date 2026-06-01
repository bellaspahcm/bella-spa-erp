import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('CRM page error handling UI', () => {
  it('surfaces CRM load failures instead of showing silent empty states', () => {
    const pageSource = read('src/app/dashboard/crm/page.tsx');

    expect(pageSource).toContain('const [loadError, setLoadError]');
    expect(pageSource).toContain('Không thể tải dữ liệu CRM');
    expect(pageSource).toContain('Lỗi tải dữ liệu CRM');
    expect(pageSource).toContain('Thử lại');
    expect(pageSource).toContain('Không thể tải danh sách lịch nhắc hẹn.');
    expect(pageSource).toContain('Không thể tải danh sách sinh nhật trong tháng.');
    expect(pageSource).toContain('Không thể tải nhật ký gửi tin nhắn.');
  });

  it('keeps manual Zalo batch scan quota skip details visible', () => {
    const pageSource = read('src/app/dashboard/crm/page.tsx');

    expect(pageSource).toContain('quotaSkipped?: string[]');
    expect(pageSource).toContain('Bị bỏ qua do hạn ngạch');
  });
});
