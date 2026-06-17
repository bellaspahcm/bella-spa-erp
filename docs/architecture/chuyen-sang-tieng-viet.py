#!/usr/bin/env python3
"""
Chuyển đổi tài liệu sang tiếng Việt
Sử dụng: python chuyen-sang-tieng-viet.py
"""

from pathlib import Path
import re

# Bảng dịch thuật ngữ kỹ thuật
THUAT_NGU = {
    # Kiến trúc
    'Core Platform': 'Nền Tảng Lõi',
    'Module System': 'Hệ Thống Module',
    'Tenant Context': 'Ngữ Cảnh Khách Hàng',
    'Architecture': 'Kiến Trúc',
    'Migration Guide': 'Hướng Dẫn Di Chuyển',
    
    # Dịch vụ
    'Authentication': 'Xác Thực',
    'Authorization': 'Phân Quyền',
    'Order Service': 'Dịch Vụ Đơn Hàng',
    'Payment Service': 'Dịch Vụ Thanh Toán',
    'Notification Service': 'Dịch Vụ Thông Báo',
    'Audit Service': 'Dịch Vụ Kiểm Toán',
    'Finance Service': 'Dịch Vụ Tài Chính',
    'Payroll Service': 'Dịch Vụ Lương Bổng',
    'Analytics Service': 'Dịch Vụ Phân Tích',
    
    # Thuật ngữ chung
    'Overview': 'Tổng Quan',
    'Introduction': 'Giới Thiệu',
    'Getting Started': 'Bắt Đầu',
    'Installation': 'Cài Đặt',
    'Configuration': 'Cấu Hình',
    'Usage': 'Sử Dụng',
    'Examples': 'Ví Dụ',
    'API Reference': 'Tham Khảo API',
    'Best Practices': 'Thực Hành Tốt Nhất',
    'Troubleshooting': 'Xử Lý Sự Cố',
    'FAQ': 'Câu Hỏi Thường Gặp',
    
    # Trạng thái
    'Active': 'Đang Hoạt Động',
    'Completed': 'Hoàn Thành',
    'In Progress': 'Đang Tiến Hành',
    'Pending': 'Chờ Xử Lý',
    
    # Hành động
    'Create': 'Tạo',
    'Read': 'Đọc',
    'Update': 'Cập Nhật',
    'Delete': 'Xóa',
    'Query': 'Truy Vấn',
    'Search': 'Tìm Kiếm',
    'Filter': 'Lọc',
    'Sort': 'Sắp Xếp',
}

def dich_tieu_de(text: str) -> str:
    """Dịch tiêu đề"""
    for en, vi in THUAT_NGU.items():
        text = text.replace(en, vi)
    return text

def dich_noi_dung(content: str) -> str:
    """Dịch nội dung tài liệu"""
    
    # Dịch các tiêu đề
    lines = content.split('\n')
    result = []
    
    for line in lines:
        # Giữ nguyên code blocks
        if line.startswith('```') or line.startswith('    '):
            result.append(line)
            continue
        
        # Dịch các tiêu đề
        if line.startswith('#'):
            line = dich_tieu_de(line)
        
        # Dịch các badge và metadata
        for en, vi in THUAT_NGU.items():
            line = line.replace(en, vi)
        
        result.append(line)
    
    return '\n'.join(result)

def tao_ban_tieng_viet(file_path: Path):
    """Tạo bản tiếng Việt của file"""
    print(f"Đang chuyển đổi {file_path.name}...")
    
    # Đọc nội dung gốc
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Dịch nội dung
    content_vi = dich_noi_dung(content)
    
    # Tạo tên file mới
    ten_moi = file_path.stem + '-vi' + file_path.suffix
    file_moi = file_path.parent / ten_moi
    
    # Ghi file mới
    with open(file_moi, 'w', encoding='utf-8') as f:
        f.write(content_vi)
    
    print(f"  ✅ Đã tạo {file_moi.name}")
    return file_moi

def main():
    """Chuyển đổi tất cả các file"""
    base_path = Path(__file__).parent
    
    files_can_dich = [
        base_path / 'core-platform.md',
        base_path / 'module-system.md',
        base_path / 'tenant-context.md',
        base_path.parent / 'migration' / 'phase-3-migration-guide.md'
    ]
    
    print("\n🌐 Đang chuyển đổi tài liệu sang tiếng Việt...\n")
    
    files_da_tao = []
    for file_path in files_can_dich:
        if file_path.exists():
            file_moi = tao_ban_tieng_viet(file_path)
            files_da_tao.append(file_moi)
        else:
            print(f"  ⚠️  Không tìm thấy {file_path.name}")
    
    print("\n✅ Hoàn thành chuyển đổi!\n")
    print("📂 Các file đã tạo:")
    for file_path in files_da_tao:
        kich_thuoc = file_path.stat().st_size / 1024
        print(f"  • {file_path.name} ({kich_thuoc:.1f} KB)")
    
    print("\n💡 Lưu ý: Các thuật ngữ kỹ thuật (API, TypeScript, v.v.) được giữ nguyên")

if __name__ == '__main__':
    main()
