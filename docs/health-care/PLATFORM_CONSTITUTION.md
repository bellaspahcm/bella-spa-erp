# Bella Platform Constitution — Enterprise Core Rules (v4 Platform Core & Vertical Plugins)

Tài liệu quy định và định hướng phát triển kiến trúc lâu dài (15–20 năm) cho **Bella AI Platform**, đảm bảo tính tách biệt tuyệt đối giữa **Platform Core (Hạ tầng dùng chung)** và các **Vertical Plugins (Nghiệp vụ chuyên ngành như Healthcare, Beauty, Real Estate, Automotive)**.

---

## I. Mission & Philosophy
Bella AI Platform được xây dựng để trở thành hệ điều hành doanh nghiệp đa ngành thời gian thực. Sứ mệnh cốt lõi là cung cấp một hạ tầng phân tán, hướng sự kiện (Event-Driven), hỗ trợ mở rộng không giới hạn mà không làm tăng nợ kỹ thuật (Technical Debt) theo thời gian.

---

## II. BBounded Contexts & Domain Rules

### 1. Tách biệt Platform Core & Vertical Plugins
- **Platform Core**: Chỉ chịu trách nhiệm cho các dịch vụ dùng chung:
  - Identity & Access Management (IAM)
  - Workflow Engine (Trình điều khiển quy trình nghiệp vụ)
  - Policy Engine (Trình đánh giá quy tắc & chính sách)
  - AI Engine Registry (Đăng ký và điều phối các mô hình AI)
  - Event Bus, Event Store & Transactional Outbox (Hệ thống truyền tin tin cậy)
  - Telemetry, Observability & Telemetry Tracing
- **Vertical Plugins**: Chỉ tập trung vào nghiệp vụ chuyên ngành đặc thù (e.g. Healthcare, Automotive, Real Estate).
  - Không tự thiết kế lại các hệ thống Identity, Workflow hay Event Bus riêng.
  - Phải đăng ký thông qua lớp **Capability Registry** của Platform Core.

### 2. Naming Conventions cho Domain Events
Tất cả Domain Events trong hệ thống phải tuân thủ quy ước nhất quán để phục vụ cả developer debug lẫn AI consumption:
- Naming format: `[Context].[Aggregate].[Action].[Version]`
- Ví dụ:
  - `Scheduling.Appointment.Created.v1`
  - `Encounter.Patient.Arrived.v1`
  - `Clinical.Tooth.Updated.v1`
  - `Pharmacy.Prescription.Approved.v2`

### 3. Outbox Pattern & Event Sourcing Invariants
- Mọi thay đổi trạng thái Aggregate phải sinh ra Domain Event tương ứng.
- Domain Event phải được ghi vào bảng **Outbox Table** trong cùng một database transaction với trạng thái Aggregate để đảm bảo tính an toàn giao dịch tối đa.
- Hệ thống Projector sẽ đọc từ Outbox và đảm bảo gửi sự kiện thành công tới Event Bus ít nhất một lần (At-least-once delivery).

---

## III. Integration & Anti-Corruption Layer (ACL)
Khi kết nối với các hệ thống bên ngoài (ví dụ: Bảo hiểm Y tế BHYT, hệ thống HIS bệnh viện, PACS hình ảnh nha khoa, thiết bị IoT):
1. **Tuyệt đối không** cho phép các hệ thống ngoài gọi trực tiếp vào Domain Model của Platform.
2. Phải đi qua lớp **Anti-Corruption Layer (ACL)** để dịch cấu trúc dữ liệu bên ngoài thành các Commands/Events hợp lệ của Bella.
3. Thiết lập **Integration Context** độc lập phục vụ cho các định dạng chuẩn công nghiệp như **HL7, FHIR, DICOM**.

---

## IV. Saga & Process Manager (Quy trình liên miền)
Đối với các quy trình nghiệp vụ phức tạp đi qua nhiều Bounded Contexts khác nhau:
- Phải sử dụng **Saga / Process Manager** (ví dụ: `EncounterSaga`) để điều phối, thay vì để các Aggregate gọi lẫn nhau trực tiếp.
- Saga lắng nghe Domain Events từ Event Bus và sinh ra các Command tương ứng gửi tới các Context đích.
- Mỗi Saga phải định nghĩa sẵn các **Compensating Transactions** (Giao dịch bù trừ) để khôi phục trạng thái khi một bước trong quy trình bị lỗi.

---

## V. AI Engine Registry & Capability Registry
- Các Vertical đăng ký tính năng của mình qua **Capability Manifest** để Core Platform thực hiện cấp quyền (Gatekeeping) và License Management.
- Các mô hình phân tích lâm sàng, chẩn đoán, hoặc dự báo công suất phải được đăng ký vào **AI Engine Registry** để tối ưu hóa việc phân bổ tài nguyên tính toán (CPU/GPU) và nâng cao khả năng tái sử dụng.
