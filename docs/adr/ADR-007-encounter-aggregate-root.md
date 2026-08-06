# ADR-007: Encounter làm Aggregate Root cho EMR

> **Trạng thái:** ACCEPTED  
> **Ngày quyết định:** 2026-08-06  
> **Người đưa ra quyết định:** Enterprise Architecture Board & AI Agent  

## Bối Cảnh (Context)
Trong môi trường y tế (Phòng khám & Bệnh viện), một đợt khám bệnh / lượt điều trị phát sinh rất nhiều dữ liệu y khoa liên quan (Chẩn đoán, Chỉ định cận lâm sàng, Đơn thuốc, Thủ thuật, Tái khám). Nếu không có một Aggregate Root duy nhất, các thông tin này sẽ bị rời rạc và khó quản lý vẹn toàn.

## Quyết Định (Decision)
Thống nhất quy định **`Encounter` (Lượt khám / Đợt điều trị)** làm **Aggregate Root** duy nhất cho mọi thông tin y tế lâm sàng:
- `Encounter` làm trung tâm quản lý vòng đời và tính toàn vẹn (Invariants) của `SOAP Notes`, `Diagnoses (ICD10)`, `Clinical Orders (LIS/RIS)`, `Prescriptions`, `Procedures` và `Follow-up/Referral`.
- Duy trì một **Encounter Granular Timeline** theo dõi chính xác thời gian diễn biến từng bước của lượt khám.

## Hệ Quả (Consequences)
- **Tích cực:** Quản lý nhất quán toàn bộ hồ sơ bệnh án EMR, dễ dàng truy vết nhật ký khám và xuất dữ liệu báo cáo y tế.
- **Thách thức:** Mọi lệnh ghi dữ liệu lâm sàng phải đi qua Encounter Boundary.
