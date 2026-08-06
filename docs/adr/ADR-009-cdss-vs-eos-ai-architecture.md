# ADR-009: Phân Định CDSS và Bella EOS AI Layer

> **Trạng thái:** ACCEPTED  
> **Ngày quyết định:** 2026-08-06  
> **Người đưa ra quyết định:** Enterprise Architecture Board & AI Agent  

## Bối Cảnh (Context)
Trí tuệ nhân tạo (AI) phát triển nhanh nhưng có tính xác suất (Probabilistic). Trong y tế, các cảnh báo về tương tác thuốc nguy hiểm, chống chỉ định hay chỉ số sinh hóa sinh sinh tử (Panic Values) đòi hỏi tính chính xác tuyệt đối 100% (Deterministic).

## Quyết Định (Decision)
Phân định rõ ràng vai trò giữa CDSS và Bella EOS AI Layer:
- **Clinical Decision Support System (CDSS):** Là động cơ quy tắc y khoa cứng (Deterministic Business/Medical Logic). Chịu trách nhiệm kiểm tra 100% chính xác các quy tắc an toàn y tế (Dị ứng, Tương tác thuốc nguy hiểm, Chống chỉ định theo độ tuổi, Liều tối đa, Panic Values).
- **Bella EOS Healthcare Intelligence Layer:** Đặt ở tầng thượng tầng quan sát Event Bus & Data Lake. Chịu trách nhiệm tổng hợp thông tin, tóm tắt bệnh án EMR, gợi ý mã hóa ICD10/CPT, và dự báo vận hành. AI đóng vai trò trợ lý hỗ trợ chuyên môn, không thay thế CDSS và quyết định của Bác sĩ.

## Hệ Quả (Consequences)
- **Tích cực:** Đảm bảo an toàn pháp lý y tế tuyệt đối nhờ CDSS trong khi vẫn tận dụng được sức mạnh tổng hợp thông tin của Bella EOS AI.
- **Thách thức:** Cần duy trì bộ cơ sở dữ liệu Dược lâm sàng & Quy tắc CDSS được cập nhật chuẩn xác.
