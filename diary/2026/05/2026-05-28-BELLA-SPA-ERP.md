# Project DevLog: BELLA SPA ERP
* **📅 Date**: 2026-05-28
* **🏷️ Tags**: `#Project` `#DevLog` `#Inventory` `#PackageMaterials` `#Reconciliation` `#KhoVan` `#DinhMuc` `#KiemKe`

---

> 🎯 **Progress Summary**
> Triển khai hoàn chỉnh luồng **Quản lý Tiêu hao Kho vận** — bao gồm hai tính năng trọng tâm: (1) Thiết lập **định mức tiêu hao vật tư mỗi buổi theo từng gói liệu trình** ngay trong modal Thêm/Sửa gói dịch vụ (bảng `package_materials`), liên thông với cờ `auto_consume_inventory` đã bật ở Cài đặt; (2) Tab **Kiểm kê Tồn Kho Cuối Tháng** trong trang Kho Vật Tư — cho phép nhập tồn thực tế đếm tay, so sánh với tồn dự kiến (hệ thống đã tự trừ), ghi nhận chênh lệch vào `inventory_logs(reason='monthly_reconciliation')` để đối soát hao hụt. Thêm 3 server actions mới (`upsertPackageMaterials`, `getMonthlyReconciliation`, `saveMonthlyReconciliation`) tuân thủ AGENTS.md §1–§3. TypeScript compile pass sạch.

### 🛠️ Execution Details & Changes

* **Core File Modifications**:

  * 📄 `src/services/inventory-actions.ts`:
    - Mở rộng `getPackageMaterials` để trả thêm cột `item_id` (cần thiết cho UI map lại dữ liệu).
    - Thêm `upsertPackageMaterials(packageId, rows[])`: xóa toàn bộ định mức cũ của gói, chèn lại danh sách mới — đảm bảo atomic, return `{ success, error?, inserted }` để caller assert side-effect.
    - Thêm `getMonthlyReconciliation(year, month)`: trả về mảng per-item gồm `nhap`, `tieu_hao`, `expected` (tổng hợp từ `inventory_items` + `inventory_logs` trong tháng chỉ định).
    - Thêm `saveMonthlyReconciliation(year, month, entries[])`: với mỗi item — đọc `stock_level` hiện hành, tính `variance = actual - expected`, cập nhật `stock_level = actual`, ghi `inventory_logs(reason='monthly_reconciliation', change_amount=variance)` kèm note chi tiết (kể cả khi variance = 0 để có audit trail đầy đủ).

  * 📄 `src/app/dashboard/services/page.tsx`:
    - Import thêm `getPackageMaterials`, `upsertPackageMaterials`, `getInventoryItems`.
    - Thêm type `MaterialRow = { item_id, quantity_per_session, name?, unit? }`.
    - Thêm state: `inventoryItems`, `materialRows`, `loadingMaterials`.
    - `useEffect` mount: load `inventoryItems` một lần (dropdown chọn vật tư).
    - `openEditModal` chuyển sang `async`: sau khi mở modal, gọi `getPackageMaterials(service.id)` và map vào `materialRows`.
    - Thêm handlers: `addMaterialRow`, `updateMaterialRow`, `removeMaterialRow`.
    - `handleSubmit`: sau khi upsert gói (edit/add), lấy `packageId` từ kết quả `.select('id').single()`, validate không trùng `item_id`, gọi `upsertPackageMaterials`.
    - Thêm section UI **"Định mức tiêu hao vật tư mỗi buổi"** vào modal (trước nút submit):
      - Add mode: hiển thị hint "Lưu gói trước, mở lại để thiết lập định mức".
      - Edit mode + inventoryItems rỗng: cảnh báo chưa có vật tư trong kho.
      - Edit mode bình thường: bảng `PremiumSelect × input số lượng × đơn vị × nút xóa` + nút "+ Thêm vật tư vào định mức".
    - Import icon `Database`, `Trash2`, `RefreshCw`.

  * 📄 `src/app/dashboard/inventory/page.tsx`:
    - Import `getMonthlyReconciliation`, `saveMonthlyReconciliation`, `ClipboardCheck`.
    - Thêm type `ReconRow = { item_id, name, unit, price_per_unit, nhap, tieu_hao, expected, actual, notes }`.
    - Đổi kiểu `activeTab` từ `'stock' | 'requests'` thành `'stock' | 'requests' | 'reconciliation'`.
    - Thêm state: `reconMonth`, `reconYear`, `reconRows`, `reconLoading`, `reconSaving`.
    - Thêm `useEffect` theo dõi `reconMonth`/`reconYear` để reload báo cáo.
    - Thêm `fetchReconciliation()`, `handleSaveReconciliation()`, `updateReconRow()`.
    - Thêm tab button thứ 3 **"Kiểm kê cuối tháng"** vào navigation bar.
    - Chuyển ternary render từ 2 nhánh thành 3 nhánh (`activeTab === 'requests' ? ... : ...`).
    - Render reconciliation tab: header (dropdown tháng/năm) + bảng 7 cột (Vật tư / Nhập / Tiêu hao / Tồn dự kiến / **Tồn thực tế** input / Chênh lệch + ước tiền / Ghi chú) + footer tổng kết + nút "Lưu Kết Quả Kiểm Kê" (confirm dialog trước khi lưu).
    - Thêm label `'monthly_reconciliation'` vào log panel lịch sử kho.

### ⏭️ Luồng vận hành đầy đủ sau khi triển khai
```
[Cài đặt → Bật "Tự động trừ kho"]
        ↓
[Dịch vụ → Edit gói → Thiết lập định mức]  →  package_materials (quantity_per_session)
        ↓ (KTV checkout buổi)
[autoConsumeForSession] đọc định mức        →  inventory_items.stock_level giảm
                                             +  inventory_logs (session_consumption)
        ↓ (cuối tháng)
[Kho → Tab Kiểm kê] nhập tồn thực tế        →  stock_level = actual
                                             +  inventory_logs (monthly_reconciliation, variance)
```
