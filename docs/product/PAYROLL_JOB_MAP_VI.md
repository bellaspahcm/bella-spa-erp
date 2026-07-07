# Bản Đồ Công Việc Payroll

**Phiên bản:** v1.0  
**Ngày:** 2026-06-22  
**Mục đích:** Ghi lại những gì HR thực sự làm, không phải những gì chúng ta nghĩ họ cần

---

## Nguyên Tắc Cốt Lõi

**Jobs-to-be-Done (Công việc cần hoàn thành) trước Information Architecture (Kiến trúc thông tin).**

❌ Không hỏi: "Họ cần những màn hình nào?"  
✅ Hỏi: "Họ đang cố gắng hoàn thành những công việc gì?"

---

## Công Việc #1: Chạy Bảng Lương Tháng

**Người thực hiện:** Quản lý HR  
**Tần suất:** 1 lần/tháng (25-30 hàng tháng)  
**Thời lượng:** 2-4 giờ  
**Trigger:** Cuối tháng sắp tới  

**Các bước (Quy trình thủ công hiện tại):**
1. Thu thập dữ liệu chấm công (từ Excel hoặc hệ thống chấm công)
2. Thu thập dữ liệu hoa hồng (từ hệ thống booking)
3. Thu thập dữ liệu nghỉ phép/vắng mặt (từ hệ thống nghỉ phép)
4. Mở template lương (Excel)
5. Điền dữ liệu cho từng nhân viên (nhập thủ công, dễ sai)
6. Tính tổng (công thức Excel)
7. Kiểm tra các trường hợp bất thường (nhân viên có lương 0, số âm, v.v.)
8. Sửa lỗi → Tính lại
9. Xin duyệt từ quản lý (in PDF, ký tên)
10. Xuất sang hệ thống kế toán (xuất thủ công)
11. Tạo file chuyển khoản ngân hàng (copy-paste sang cổng ngân hàng)

**Các Điểm Đau:**
- ⚠️ Dữ liệu nằm rải rác trên 3-4 hệ thống
- ⚠️ Nhập liệu thủ công (tỷ lệ lỗi cao)
- ⚠️ Công thức Excel vỡ khi thêm nhân viên mới
- ⚠️ Khó giải thích tại sao lương thay đổi theo tháng
- ⚠️ Quy trình duyệt offline (in → ký → scan)
- ⚠️ Tính lại mất 1-2 giờ nếu phát hiện lỗi

**Tiêu Chí Thành Công:**
- Tất cả nhân viên đã có lương được tính
- Không có lỗi (lương âm, thiếu dữ liệu)
- Quản lý đã duyệt
- Đã xuất sang kế toán + ngân hàng

**Điều họ KHÔNG quan tâm:**
- Công thức hoạt động thế nào
- Dữ liệu lưu ở đâu
- Kiến trúc hệ thống

---

## Công Việc #2: Giải Thích Tại Sao Lương Nhân Viên Thay Đổi

**Người thực hiện:** Nhân viên HR  
**Tần suất:** 5-10 lần/tháng  
**Thời lượng:** 5-30 phút/trường hợp  
**Trigger:** Nhân viên hỏi về lương, Kế toán audit, Quản lý yêu cầu  

**Các bước (Quy trình thủ công hiện tại):**
1. Nhân viên hỏi: "Tại sao lương tháng này giảm 900k?"
2. HR mở file lương Excel
3. So sánh tháng này vs tháng trước (diff thủ công)
4. Kiểm tra log chấm công → "À, vắng 2 ngày"
5. Kiểm tra log hoa hồng → "Giống tháng trước"
6. Kiểm tra phạt → "Đi muộn 1 ngày"
7. Tính thủ công: `-2 ngày × (6M/26) = -462k, -1 muộn × 50k = -50k, tổng -512k` (không phải 900k!)
8. Kiểm tra lại tất cả nguồn → Tìm thấy lỗi trong log chấm công
9. Giải thích cho nhân viên (nói hoặc email)

**Các Điểm Đau:**
- ⚠️ So sánh thủ công (dễ sai)
- ⚠️ Dữ liệu rải rác → khó truy vết
- ⚠️ Không có audit trail ("Ai sửa log chấm công?")
- ⚠️ Lỗi tính toán khi giải thích (xấu hổ)
- ⚠️ Mất 30 phút để trả lời câu hỏi đơn giản

**Tiêu Chí Thành Công:**
- HR có thể giải thích chi tiết lương trong <5 phút
- Giải thích chính xác (khớp với cách tính thực tế)
- Có bằng chứng (log chấm công, bản ghi hoa hồng)

**Điều họ KHÔNG quan tâm:**
- Cú pháp công thức
- Hiệu năng calculation engine
- Schema database

---

## Công Việc #3: Sửa Lỗi Bảng Lương Giữa Tháng

**Người thực hiện:** Nhân viên HR  
**Tần suất:** 2-3 lần/tháng  
**Thời lượng:** 15 phút - 2 giờ  
**Trigger:** Nhân viên báo lỗi, HR phát hiện sai, Chấm công được sửa  

**Các bước (Quy trình thủ công hiện tại):**
1. Phát hiện lỗi (VD: "Quên thêm hoa hồng cho Nguyễn Văn A")
2. Kiểm tra xem bảng lương đã khóa chưa (nếu đã khóa, cần kế toán mở khóa)
3. Mở Excel → Tìm hàng nhân viên
4. Cập nhật dữ liệu (thêm hoa hồng thiếu)
5. Tính lại → Kiểm tra xem đúng chưa
6. **Vấn đề:** Công thức của nhân viên khác có thể vỡ khi sửa
7. Tính lại TẤT CẢ nhân viên (Excel chậm, 5-10 phút)
8. Kiểm tra lỗi mới do việc sửa gây ra
9. Xin duyệt lại từ quản lý (nếu đã duyệt rồi)
10. Xuất lại sang kế toán/ngân hàng

**Các Điểm Đau:**
- ⚠️ Bảng lương đã khóa = không sửa dễ dàng
- ⚠️ Sửa 1 nhân viên → làm vỡ nhân viên khác (tham chiếu công thức Excel)
- ⚠️ Tính lại toàn bộ chậm (10 phút cho 50 nhân viên)
- ⚠️ Không có lịch sử (không thấy thay đổi gì, ai thay đổi, khi nào)
- ⚠️ Duyệt lại rất đau (quản lý đã duyệt một lần rồi)

**Tiêu Chí Thành Công:**
- Sửa lỗi mà không làm vỡ nhân viên khác
- Nhanh (< 2 phút)
- Quản lý được thông báo về thay đổi (không cần duyệt lại toàn bộ)

**Điều họ KHÔNG quan tâm:**
- Cách tính lại hoạt động bên trong
- Database transactions
- Phụ thuộc tính toán

---

## Công Việc #4: Điều Chỉnh Chính Sách Lương (Hiếm)

**Người thực hiện:** Quản lý HR + Quản lý Tài chính  
**Tần suất:** 2-3 lần/năm  
**Thời lượng:** 1 giờ  
**Trigger:** Thay đổi chính sách công ty, Điều chỉnh lạm phát, Đợt thăng chức  

**Ví dụ:**
- "Tăng hệ số Senior từ 1.2 lên 1.3"
- "Thêm phụ cấp xăng xe 500k/tháng cho tất cả KTV"
- "Đổi thưởng KPI từ 1M → theo bậc (30-35 ca: 500k, 35-40 ca: 1M, >40 ca: 1.5M)"

**Các bước (Quy trình thủ công hiện tại):**
1. Quản lý quyết định thay đổi chính sách (họp, email)
2. HR cập nhật template Excel (sửa công thức hoặc thêm cột)
3. Test với 1-2 nhân viên (tính thủ công để xác minh)
4. Áp dụng cho tất cả nhân viên vào tháng sau
5. **Vấn đề:** Khó ước tính tác động trước khi áp dụng

**Các Điểm Đau:**
- ⚠️ Không có xem trước tác động ("Nếu tăng hệ số Senior, chi phí tăng bao nhiêu?")
- ⚠️ Công thức Excel khó sửa (cần kỹ năng Excel)
- ⚠️ Ngày hiệu lực không rõ (áp dụng tháng này hay tháng sau?)
- ⚠️ Không có version control (không thể rollback nếu sai)

**Tiêu Chí Thành Công:**
- Xem tác động trước khi áp dụng (ước tính chi phí)
- Áp dụng an toàn (không làm vỡ bảng lương hiện tại)
- Có thể rollback nếu cần

**Điều họ KHÔNG quan tâm:**
- Cú pháp DSL
- Hệ thống versioning công thức
- Quản lý cấu hình

---

## Công Việc #5: Xử Lý Nhân Viên Nghỉ Việc

**Người thực hiện:** Nhân viên HR  
**Tần suất:** 2-5 lần/tháng  
**Thời lượng:** 10-20 phút  
**Trigger:** Nhân viên nộp đơn xin nghỉ  

**Các bước (Quy trình thủ công hiện tại):**
1. Nhân viên nghỉ việc (VD: nghỉ 15/6)
2. HR tính lương theo tỷ lệ:
   - Cơ bản: `6M × (15/26) = 3.46M`
   - Hoa hồng: Chỉ tính ca trước 15/6
   - KPI: Thường là 0 (không làm đủ tháng)
3. **Vấn đề:** Công thức Excel vẫn dùng cả tháng
4. HR override thủ công (xóa công thức, gõ giá trị cố định)
5. Thêm ghi chú: "Nghỉ việc 15/6"
6. Tính lại
7. Xử lý thanh toán cuối cùng (bao gồm phép chưa dùng, trợ cấp thôi việc nếu có)

**Các Điểm Đau:**
- ⚠️ Tính tỷ lệ thủ công (dễ sai)
- ⚠️ Override công thức Excel = làm vỡ các tháng sau
- ⚠️ Khó tách: lương + phép chưa dùng + trợ cấp
- ⚠️ Không có workflow nghỉ việc (chỉ ghi chú thủ công)

**Tiêu Chí Thành Công:**
- Lương tỷ lệ chính xác (đến ngày nghỉ việc)
- Chi tiết rõ ràng (lương vs phép vs trợ cấp)
- Nhanh (10 phút)

**Điều họ KHÔNG quan tâm:**
- Hệ thống tracking ngày nghỉ việc
- Thuật toán tính tỷ lệ
- Calculation engine số dư phép

---

## Công Việc #6: Xin Quản Lý Duyệt Lương Cao

**Người thực hiện:** Nhân viên HR → Quản lý → (đôi khi) Tài chính/CEO  
**Tần suất:** 5-10 lần/tháng  
**Thời lượng:** 30 phút - 2 ngày  
**Trigger:** Lương nhân viên > 15M, hoặc tăng đột ngột >20%  

**Các bước (Quy trình thủ công hiện tại):**
1. HR tạo bảng lương
2. Thấy: "Trần Văn C: 18.5M (tháng trước: 12M, +54%)"
3. Kiểm tra tại sao: "À, nhận 3 gói VIP + OT ngày lễ"
4. Chuẩn bị tài liệu giải thích (Word/Email)
5. Gửi cho Quản lý xin duyệt (email/chat)
6. **Quản lý hỏi:** "Tại sao tăng 54%?" (cần chi tiết)
7. HR chuẩn bị chi tiết (ảnh chụp Excel)
8. Quản lý duyệt (email reply hoặc nói)
9. **Vấn đề:** Nếu Quản lý nghỉ → Kẹt
10. HR tiến hành bảng lương

**Các Điểm Đau:**
- ⚠️ Yêu cầu duyệt thủ công (email/chat, không tracking)
- ⚠️ Khó chuẩn bị giải thích (ảnh chụp màn hình, chi tiết thủ công)
- ⚠️ Duyệt bị block nếu Quản lý không có
- ⚠️ Không có audit trail (chỉ chuỗi email)
- ⚠️ Quy tắc duyệt không rõ (>15M? Tăng >20%? Cả hai?)

**Tiêu Chí Thành Công:**
- Quản lý thấy case + giải thích ở một chỗ
- Duyệt/Từ chối trong < 5 phút
- Có audit trail (ai duyệt, khi nào, tại sao)
- Escalation nếu Quản lý không có

**Điều họ KHÔNG quan tâm:**
- Approval workflow engine
- Rule-based routing
- Kiến trúc hệ thống thông báo

---

## Công Việc #7: Xuất Bảng Lương Sang Kế Toán/Ngân Hàng

**Người thực hiện:** Nhân viên HR  
**Tần suất:** 1 lần/tháng (sau khi khóa bảng lương)  
**Thời lượng:** 15-30 phút  
**Trigger:** Bảng lương đã duyệt và khóa  

**Các bước (Quy trình thủ công hiện tại):**
1. Xuất Excel sang PDF (để lưu trữ)
2. Mở hệ thống kế toán (Misa, Fast, hoặc khác)
3. Nhập thủ công các bút toán lương:
   - Nợ: Chi phí lương
   - Có: Lương phải trả
   - Cho từng nhân viên (50 bút toán!)
4. Mở cổng ngân hàng (VCB, ACB, v.v.)
5. Tạo file chuyển khoản (copy-paste thủ công từ Excel):
   - Tên nhân viên, tài khoản ngân hàng, số tiền
6. Upload lên ngân hàng
7. **Vấn đề:** Nếu có lỗi → Làm lại từ bước 2

**Các Điểm Đau:**
- ⚠️ Nhập liệu thủ công vào hệ thống kế toán (50 bút toán × 2 phút = 100 phút!)
- ⚠️ Copy-paste thủ công sang ngân hàng (dễ sai)
- ⚠️ Không có xuất tự động (phải copy từng trường)
- ⚠️ Định dạng ngân hàng khác nhau (VCB ≠ ACB ≠ Techcombank)

**Tiêu Chí Thành Công:**
- Xuất một cú click sang hệ thống kế toán (JSON/API)
- Xuất một cú click sang ngân hàng (định dạng chuẩn)
- Không nhập thủ công
- Không có lỗi

**Điều họ KHÔNG quan tâm:**
- Đặc tả định dạng export
- Chi tiết tích hợp API
- Tiêu chuẩn định dạng file

---

## Bản Đồ Tần Suất Công Việc

| Công việc | Tần suất | Thời lượng | Mức độ đau |
|-----------|----------|------------|------------|
| Chạy bảng lương tháng | 1×/tháng | 2-4 giờ | 🔥🔥🔥 Cao |
| Giải thích thay đổi lương | 5-10×/tháng | 5-30 phút | 🔥🔥 Trung bình |
| Sửa lỗi bảng lương | 2-3×/tháng | 15 phút - 2 giờ | 🔥🔥🔥 Cao |
| Điều chỉnh chính sách lương | 2-3×/năm | 1 giờ | 🔥 Thấp |
| Xử lý nghỉ việc | 2-5×/tháng | 10-20 phút | 🔥 Thấp |
| Xin duyệt | 5-10×/tháng | 30 phút - 2 ngày | 🔥🔥 Trung bình |
| Xuất sang Kế toán/Ngân hàng | 1×/tháng | 15-30 phút | 🔥 Thấp |

**Phát hiện:** Hầu hết điểm đau nằm ở **công việc vận hành** (Chạy, Giải thích, Sửa), không phải **công việc thiết lập** (Điều chỉnh chính sách).

**Ý nghĩa:** IA nên ưu tiên workflows vận hành, không phải màn hình cấu hình.

---

## Những Phát Hiện Chính

### 1. HR dành 80% thời gian cho Vận hành, 20% cho Cấu hình
**Sai lầm IA hiện tại:** Configuration là top-level, tầm quan trọng ngang Operations.  
**IA đúng:** Operations trước (Run, Review, Fix), Configuration lồng vào.

### 2. "Giải thích Tại sao" là điểm đau #1
**IA hiện tại:** Employee Detail tồn tại, nhưng không dễ tìm.  
**IA đúng:** Employee Detail nên cách 1 click từ bất cứ đâu.

### 3. Approval là inline, không phải module riêng
**IA hiện tại:** Approval Queue là module top-level riêng.  
**IA đúng:** Approval inline trong Payroll Run (3 case chờ, click để duyệt).

### 4. Sửa công thức hiếm, sửa data thường xuyên
**IA hiện tại:** Formula lồng dưới Configuration.  
**Xác thực:** Cần user testing. HR có thể không bao giờ động đến formulas, chỉ sửa data (tỷ lệ, bậc, số tiền).

### 5. Reports không phải module, mà là nút bấm
**IA hiện tại:** Reports & Export là module top-level.  
**IA đúng:** Nút Export trong Payroll Run (sau khi khóa).

---

## Các Bước Tiếp Theo

### Phase 1: Xác thực Jobs với HR thật ✅
- [ ] Phỏng vấn 2-3 nhân viên HR (không tech, người dùng thực tế)
- [ ] Quan sát họ làm bảng lương (quay màn hình + think-aloud)
- [ ] Thu thập điểm đau (việc gì mất lâu nhất? Việc gì vỡ nhiều nhất?)
- [ ] Cập nhật job map dựa trên phát hiện

### Phase 2: IA Theo Công Việc ⏳
- [ ] Map jobs → screens (1 job có thể cần 2-3 screens, hoặc 1 screen phục vụ 3 jobs)
- [ ] Ưu tiên theo tần suất × mức đau (tần suất cao + đau nhiều = phải tối ưu)
- [ ] Trì hoãn jobs ít dùng (Điều chỉnh chính sách có thể có UX tệ hơn, nó hiếm)

### Phase 3: Screen Flow ⏳
- [ ] Vẽ user journeys cho top 3 jobs
- [ ] Xác định patterns có thể tái sử dụng (drill-down, inline edit, approval toast)

### Phase 4: Wireframe ⏳
- [ ] Chỉ cho các jobs đã xác thực
- [ ] Không polish, chỉ layout

### Phase 5: User Testing ⏳
- [ ] Đưa wireframe cho HR thật
- [ ] Quan sát họ thất bại (đó là data chúng ta cần)
- [ ] Lặp lại

**KHÔNG thiết kế IA trước khi Phase 1 hoàn thành.**

---

## Anti-Patterns Cần Tránh

### ❌ Anti-pattern #1: Thiết kế cho edge cases
**Ví dụ:** "Nếu Quản lý nghỉ và CFO cần duyệt thì sao?"  
**Thực tế:** Xảy ra 1×/năm. Đừng over-design cho nó.

### ❌ Anti-pattern #2: Copy kiến trúc hệ thống vào UI
**Ví dụ:** Master Data → Calculations → Policy (phản ánh cấu trúc backend)  
**Thực tế:** HR không nghĩ theo các tầng hệ thống.

### ❌ Anti-pattern #3: Làm nổi bật configuration
**Ví dụ:** Configuration là menu top-level  
**Thực tế:** HR đổi configuration 2-3×/năm, chạy lương 12×/năm.

### ❌ Anti-pattern #4: Giả định HR muốn tính linh hoạt
**Ví dụ:** "Cho HR tạo công thức tùy chỉnh"  
**Thực tế:** HR muốn công thức có sẵn hoạt động tốt, không phải formula editor.

### ❌ Anti-pattern #5: Build cho quy mô trước khi xác thực core job
**Ví dụ:** "Hỗ trợ 100+ approval rules"  
**Thực tế:** Hầu hết công ty có 3-5 rules. Bắt đầu từ đó.

---

## Phụ Lục: Cách Jobs Định Hình IA

### Job: "Chạy bảng lương tháng" → IA: Payroll Runs (danh sách theo thời gian)
- Không phải "Create Payroll" (dựa trên động từ)
- Không phải "Payroll Management" (quá chung chung)

### Job: "Giải thích tại sao lương thay đổi" → IA: Employee Detail (drill-down)
- Không phải module "Explanation Report" riêng
- Inline, cách 1 click từ màn hình nào có lương

### Job: "Sửa lỗi bảng lương" → IA: Inline edit + nút Recalculate
- Không phải module "Edit Payroll"
- Sửa ngay chỗ hiện lỗi (không chuyển context)

### Job: "Xin duyệt" → IA: Inline approval (không phải queue riêng)
- Hiện số lượng chờ trong Payroll Run: "3 cần duyệt"
- Click → Modal với cases → Duyệt/Từ chối → Xong

### Job: "Xuất" → IA: Nút trong Payroll Run
- Không phải module "Reports" riêng
- Export là hành động cuối workflow, không phải task khám phá

**Pattern:** Jobs tự nhiên lộ ra cấu trúc UI. Đừng thiết kế UI trước.
