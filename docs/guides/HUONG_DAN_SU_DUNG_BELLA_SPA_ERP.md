# 📖 HƯỚNG DẪN SỬ DỤNG HỆ THỐNG BELLA SPA ERP
**Dành cho**: Chủ Spa • Kế Toán • Hành Chính • Kỹ Thuật Viên (KTV) • Khách Hàng  
**Phiên bản**: 2.0 — Cập nhật tháng 07/2026  
**Hỗ trợ**: Hotline 0865 701 493 | Email: support@bellaspa.vn

---

## 📋 MỤC LỤC

1. [Giới thiệu hệ thống](#1-giới-thiệu-hệ-thống)
2. [Đăng nhập & Phân quyền](#2-đăng-nhập--phân-quyền)
3. [Hướng dẫn dành cho Chủ Spa / Admin](#3-hướng-dẫn-dành-cho-chủ-spa--admin)
   - 3.1 [Dashboard Tổng Quan](#31-dashboard-tổng-quan)
   - 3.2 [Quản lý Khách Hàng](#32-quản-lý-khách-hàng)
   - 3.3 [Quản lý Đặt Lịch (Booking)](#33-quản-lý-đặt-lịch-booking)
   - 3.4 [Lịch KTV & Phân Ca](#34-lịch-ktv--phân-ca)
   - 3.5 [Tài Chính & Đối Soát](#35-tài-chính--đối-soát)
   - 3.6 [Kho Vận & Vật Tư](#36-kho-vận--vật-tư)
   - 3.7 [Quản lý Nhân Sự (HR)](#37-quản-lý-nhân-sự-hr)
   - 3.8 [Bảng Lương & KPI](#38-bảng-lương--kpi)
   - 3.9 [AI Copilot & Decision Engine](#39-ai-copilot--decision-engine)
   - 3.10 [Báo Cáo & Phân Tích](#310-báo-cáo--phân-tích)
   - 3.11 [Cài Đặt Hệ Thống](#311-cài-đặt-hệ-thống)
4. [Hướng dẫn dành cho Kỹ Thuật Viên (KTV)](#4-hướng-dẫn-dành-cho-kỹ-thuật-viên-ktv)
   - 4.1 [Truy cập KTV Portal](#41-truy-cập-ktv-portal)
   - 4.2 [Xem Lịch Ca Hôm Nay](#42-xem-lịch-ca-hôm-nay)
   - 4.3 [Check-in GPS Bắt Đầu Ca](#43-check-in-gps-bắt-đầu-ca)
   - 4.4 [Kết Thúc Ca & Check-out](#44-kết-thúc-ca--check-out)
   - 4.5 [Xem Bảng Lương & Hoa Hồng](#45-xem-bảng-lương--hoa-hồng)
5. [Hướng dẫn dành cho Kế Toán](#5-hướng-dẫn-dành-cho-kế-toán)
6. [Hướng dẫn dành cho Khách Hàng (Customer Portal)](#6-hướng-dẫn-dành-cho-khách-hàng-customer-portal)
7. [Quy trình vận hành theo ngày / tháng](#7-quy-trình-vận-hành-theo-ngày--tháng)
8. [Câu hỏi thường gặp (FAQ)](#8-câu-hỏi-thường-gặp-faq)
9. [Xử lý sự cố phổ biến](#9-xử-lý-sự-cố-phổ-biến)

---

## 1. Giới thiệu hệ thống

**Bella Spa ERP** là phần mềm quản lý toàn diện được thiết kế riêng cho spa chăm sóc **Mẹ Bầu & Bé Sau Sinh**. Hệ thống giúp số hóa 100% quy trình vận hành, từ đặt lịch, quản lý KTV, tính lương tự động, đến kiểm soát tài chính thời gian thực.

### Lợi ích chính

| Trước khi có ERP | Sau khi dùng Bella Spa ERP |
|:---|:---|
| Ghi sổ tay, nhắn Zalo thủ công | Lịch tự động, thông báo tức thì |
| KTV hay quên ca / trùng lịch | Calendar màu sắc (Xanh/Cam/Đỏ), cảnh báo xung đột |
| Tích buổi bằng thẻ giấy dễ mất | Thẻ liệu trình điện tử, bất biến sau khi tích |
| Tính lương mất 1-2 ngày, dễ sai | Tính lương tự động trong 30 giây |
| Không biết doanh thu thực tế | Báo cáo P&L thời gian thực |
| Khó phát hiện thất thoát | Hệ thống đối soát tự động, cảnh báo lệch |

### Các phân hệ chính

```
🏠 Dashboard Tổng Quan       → Chỉ số kinh doanh theo giờ/ngày/tháng
👥 Khách Hàng                → Hồ sơ mẹ & bé, lịch sử dịch vụ
📅 Đặt Lịch (Booking)        → Quản lý hợp đồng gói dịch vụ
🗓️ Lịch KTV                 → Calendar phân ca, check-in GPS
💰 Tài Chính                 → Doanh thu, chi phí, đối soát
📦 Kho Vận                   → Tồn kho, định mức tiêu hao
👨‍💼 Nhân Sự (HR)             → Chấm công, vi phạm, KPI
💵 Bảng Lương               → Tính lương tự động, phê duyệt
🤖 AI Copilot               → Gợi ý thông minh, tự động hóa
📊 Báo Cáo                  → Phân tích doanh thu, dự báo
```

---

## 2. Đăng Nhập & Phân Quyền

### Cách đăng nhập

1. Mở trình duyệt và truy cập địa chỉ hệ thống được cấp (ví dụ: `https://app.bellaspa.vn`)
2. Nhập **Email** và **Mật khẩu** do Admin cấp phát
3. Nhấn **"Đăng nhập"**

> **Lưu ý bảo mật:** Không chia sẻ mật khẩu với người khác. Nếu quên mật khẩu, liên hệ Admin để cấp lại.

### Bảng phân quyền theo vai trò

| Vai trò | Quyền truy cập | Giao diện |
|:---|:---|:---|
| **Admin / Chủ Spa** | Toàn bộ hệ thống, cấu hình, báo cáo | Web + Mobile |
| **KTV Trưởng** | Quản lý team, phân ca, duyệt lương nhóm | Web + Mobile |
| **KTV** | Check-in/out, xem lịch ca, thu nhập cá nhân | Mobile (tối ưu điện thoại) |
| **Hành Chính** | Nhân sự, kho, chấm công | Web + Mobile |
| **Kế Toán** | Tài chính, báo cáo, xuất hóa đơn | Web |
| **Khách Hàng** | Xem tiến độ liệu trình, đánh giá KTV | Link 1-click qua Zalo |

---

## 3. Hướng Dẫn Dành Cho Chủ Spa / Admin

### 3.1 Dashboard Tổng Quan

Sau khi đăng nhập, màn hình **Dashboard** hiển thị ngay các chỉ số quan trọng:

**Khu vực Chỉ số Nhanh (Top Cards):**
- 📈 **Doanh thu tháng này** — So sánh với tháng trước (% tăng/giảm)
- 👥 **Khách hàng đang hoạt động** — Số khách đang trong liệu trình
- 📅 **Ca làm hôm nay** — Tổng số ca, ca đang thực hiện, ca hoàn thành
- 💰 **Lợi nhuận ước tính (P&L)** — Doanh thu - Chi phí - Lương KTV tạm tính

**Biểu đồ trực quan:**
- **Bar Chart**: Doanh thu tháng này vs tháng trước
- **Pie Chart**: Cơ cấu gói dịch vụ (Tiết Kiệm / Hạnh Phúc / VIP)
- **Line Chart**: Xu hướng 12 tháng qua
- **Calendar**: Tổng quan lịch KTV hôm nay

**Hoạt động gần đây:**
- Danh sách ca vừa check-in / check-out
- Giao dịch thanh toán mới
- Cảnh báo (lệch đối soát, vi phạm GPS, v.v.)

---

### 3.2 Quản Lý Khách Hàng

**Truy cập:** Nhấn **"Khách Hàng"** trên thanh menu bên trái.

#### Tìm kiếm khách hàng

Sử dụng ô tìm kiếm ở đầu trang, hỗ trợ tìm theo:
- Tên mẹ
- Tên bé
- Số điện thoại
- Mã booking

#### Thêm khách hàng mới

1. Nhấn nút **"+ Thêm Khách Hàng"** (góc trên bên phải)
2. Điền thông tin vào form:
   - **Tên mẹ** *(bắt buộc)*
   - **Số điện thoại** *(bắt buộc, dùng để gửi Zalo)*
   - **Tên bé** (nếu đã sinh)
   - **Ngày sinh bé** hoặc **Ngày dự sinh** (nếu chưa sinh)
   - **Địa chỉ** và **Quận/Huyện**
   - **Nguồn giới thiệu**: Bạn bè / Facebook / Google Maps / Khác
   - **Người giới thiệu**: Chọn khách hàng hiện tại trong hệ thống (nếu có)
   - **Ghi chú** thêm (tình trạng sức khỏe đặc biệt, v.v.)
3. Nhấn **"Lưu"**

#### Xem chi tiết khách hàng

Click vào tên khách hàng để vào trang chi tiết, bao gồm:

- **Thông tin cá nhân**: Hồ sơ mẹ & bé
- **Thẻ liệu trình hiện tại**: Trạng thái gói đang chạy (VD: Hoàn thành 8/16 buổi)
- **Lịch sử booking**: Tất cả gói đã/đang sử dụng
- **Lịch sử thanh toán** *(chỉ Admin)*: Từng giao dịch chi tiết
- **Điểm Loyalty**: Hạng thành viên (Bạc/Vàng/Kim Cương) và điểm tích lũy
- **Nhật ký đánh giá**: Phản hồi từ khách sau mỗi ca

#### Chỉnh sửa gói dịch vụ (Admin only)

Khi cần sửa sai sót trong hợp đồng:

1. Vào trang chi tiết khách hàng
2. Tại thẻ liệu trình đang hoạt động, nhấn nút **"Sửa Gói Dịch Vụ"** (màu vàng/gold)
3. Modal hiện ra, có thể chỉnh:
   - Tên gói dịch vụ
   - Tổng số buổi
   - Ngày bắt đầu / kết thúc
   - Số tiền đã cọc / đã thanh toán
   - Tỷ lệ giảm giá (%)
   - Ghi chú đặc biệt
4. Nhấn **"Lưu Thay Đổi"**

> ⚠️ **Lưu ý quan trọng:** Chỉ chỉnh sửa thông tin booking, không ảnh hưởng đến lịch sử ca làm đã tích. Hoa hồng KTV được bảo toàn.

---

### 3.3 Quản Lý Đặt Lịch (Booking)

**Truy cập:** Nhấn **"Đặt Lịch"** hoặc **"Bookings"** trên menu.

#### Tạo Booking Mới

Quy trình chuẩn khi khách hàng đăng ký gói dịch vụ:

```
Bước 1: Chọn khách hàng (hoặc tạo mới nếu khách lần đầu)
Bước 2: Chọn gói dịch vụ
Bước 3: Ghi nhận tiền cọc
Bước 4: Phân ca KTV
Bước 5: Xác nhận & thông báo
```

**Chi tiết từng bước:**

**Bước 1 — Chọn/Tạo Khách Hàng:**
- Tìm kiếm theo số điện thoại
- Nếu khách mới: nhấn "Thêm khách mới" và điền form

**Bước 2 — Chọn Gói Dịch Vụ:**

| Gói | Số Buổi | Giá Niêm Yết | Hệ Số Ca KTV |
|:---|:---:|:---:|:---:|
| **Combo Mẹ & Bé Tiết Kiệm** | 12 buổi | 7,050,000đ | 1.0x |
| **Combo Mẹ & Bé Hạnh Phúc** | 16 buổi | 12,600,000đ | 1.5x |
| **Combo Mẹ & Bé VIP Toàn Diện** | 21 buổi | 21,900,000đ | 2.0x |

> 💡 Hệ số ca ảnh hưởng trực tiếp đến tính toán hoa hồng KTV và bảng lương tự động.

**Bước 3 — Ghi Nhận Tiền Cọc:**
- Nhập số tiền cọc (thường 200,000đ — 1,000,000đ)
- Chọn phương thức: **Tiền mặt** hoặc **Chuyển khoản**
- Hệ thống tự động tạo mã booking: `BK-YYMMDD-XXX`

**Bước 4 — Phân Ca KTV:**
- Chọn KTV phụ trách chính từ danh sách (hiển thị tình trạng lịch)
- Xanh ✅ = còn trống | Cam 🟠 = còn slot | Đỏ ❌ = đã đầy lịch

**Bước 5 — Xác Nhận:**
- Kiểm tra lại toàn bộ thông tin
- Nhấn **"Tạo Booking"**
- Hệ thống tự động gửi thông báo Zalo cho KTV được phân công

#### Trạng thái Booking

| Trạng thái | Ý nghĩa |
|:---|:---|
| `Đặt cọc` | Đã nhận cọc, chưa bắt đầu dịch vụ |
| `Đang thực hiện` | Đã có ít nhất 1 ca hoàn thành |
| `Đang chăm sóc` (🔴 nhấp nháy) | KTV đang ở nhà khách, ca đang diễn ra |
| `Hoàn thành` | Đã hết tất cả buổi trong gói |
| `Hủy` | Booking bị hủy |

---

### 3.4 Lịch KTV & Phân Ca

**Truy cập:** Nhấn **"Lịch KTV"** hoặc **"Schedule"** trên menu.

#### Giao diện Calendar Tháng

Màn hình hiển thị lịch dạng tháng với màu sắc trực quan:

- 🟢 **Xanh** = KTV hoàn toàn trống lịch
- 🟠 **Cam** = KTV còn 1-2 slot (nhận thêm được)
- 🔴 **Đỏ** = KTV đã đầy lịch trong ngày
- ⬜ **Xám** = KTV nghỉ

**Thao tác trên Calendar:**

1. **Lọc theo KTV**: Dùng dropdown ở đầu trang để chọn xem lịch của từng KTV riêng
2. **Click vào ngày**: Mở Timeline giờ chi tiết (07:00 — 19:00)
   - Mỗi thanh = 1 ca, hiển thị: Giờ bắt đầu-kết thúc, tên KTV, tên khách, địa chỉ
3. **Phân ca thủ công**: Click vào slot trống → Chọn booking cần gán

#### Gợi ý KTV thông minh (AI)

Khi tạo booking mới, hệ thống AI tự động gợi ý KTV phù hợp nhất dựa trên:
- Khoảng cách địa lý đến nhà khách (gần nhất)
- Lịch còn trống trong ngày yêu cầu
- Lịch sử chất lượng phục vụ (rating trung bình)
- Số ca trong tháng (cân bằng công việc)

---

### 3.5 Tài Chính & Đối Soát

**Truy cập:** Nhấn **"Tài Chính"** → **"Đối Soát Tài Chính"** hoặc **"Doanh Thu"**.

#### Ghi Nhận Doanh Thu

1. Nhấn **"+ Ghi Nhận Thanh Toán"**
2. Chọn booking liên quan (tìm theo mã booking hoặc tên khách)
3. Nhập số tiền nhận được
4. Chọn loại giao dịch: `Tiền cọc` / `Thanh toán còn lại` / `Phí phát sinh`
5. Chọn phương thức: `Chuyển khoản` / `Tiền mặt`
6. Xác nhận ngày nhận tiền (mặc định là hôm nay)
7. Nhấn **"Xác Nhận Giao Dịch"**

> 💡 Mỗi giao dịch được duyệt sẽ **tự động cộng điểm Loyalty** cho khách hàng theo tỷ lệ **100.000đ = 1 điểm**.

#### Ghi Nhận Hoàn Tiền (Số âm)

Khi khách chuyển thừa tiền hoặc admin nhập nhầm:

1. Nhấn **"+ Ghi Nhận Thanh Toán"**
2. Nhập **số tiền âm** (ví dụ: `-50000`)
3. Ghi chú: *"Hoàn trả tiền thừa đối soát"*
4. Xác nhận

Hệ thống tự động cân bằng sổ cái và **xóa cảnh báo lệch** trên trang đối soát.

#### Điều Tra Lệch Thanh Toán

Khi có cảnh báo lệch (số thu thực tế ≠ giá gói):

1. Vào **"Tài Chính"** → **"Đối Soát Tài Chính"**
2. Tìm booking có cột **"Trạng thái Đối Soát"** hiển thị ❌ Lệch
3. Nhấn nút **"Điều Tra"** màu đỏ
4. Hệ thống tự chuyển hướng đến trang chi tiết khách hàng của booking đó
5. Xem thẻ **"Lịch Sử Thanh Toán & Đối Soát"** để phát hiện giao dịch nhập trùng/thiếu
6. Xử lý bằng cách ghi giao dịch âm (hoàn tiền) hoặc bổ sung giao dịch còn thiếu

#### Báo Cáo Lãi Lỗ (P&L)

Hệ thống tự động tính P&L theo công thức:

```
Lợi Nhuận = Doanh Thu (đã xác nhận)
           - Chi Phí Vận Hành (đã phê duyệt)
           - Lương KTV (tạm tính real-time nếu chưa chốt,
                        hoặc theo bảng lương đã lưu nếu đã chốt)
```

> ⚠️ Chỉ tính doanh thu có trạng thái **"Đã xác nhận"**, không tính khoản đặt cọc chưa xác nhận. Chỉ tính chi phí đã được phê duyệt.

---

### 3.6 Kho Vận & Vật Tư

**Truy cập:** Nhấn **"Kho Vận"** hoặc **"Inventory"** trên menu.

#### Quản Lý Tồn Kho

Màn hình hiển thị danh sách vật tư, gồm:
- Tên vật tư (Dầu massage, Khăn cotton, v.v.)
- Số lượng hiện tại
- Ngưỡng cảnh báo (khi tồn kho dưới mức tối thiểu)
- Ngày cập nhật cuối

#### Tự Động Trừ Kho Theo Ca Làm

Mỗi khi KTV hoàn thành ca, hệ thống **tự động trừ** vật tư theo định mức tiêu hao của gói:

| Gói | Dầu massage | Khăn cotton | Vật tư khác |
|:---|:---:|:---:|:---:|
| Tiết Kiệm | 30ml | 1 cái | Theo cấu hình |
| Hạnh Phúc | 50ml | 2 cái | Theo cấu hình |
| VIP Toàn Diện | 80ml | 3 cái | Theo cấu hình |

#### Nhập Kho Mới

1. Nhấn **"+ Nhập Kho"**
2. Chọn vật tư
3. Nhập số lượng nhập
4. Nhập giá nhập (để tính chi phí)
5. Đính kèm hóa đơn (tùy chọn)
6. Nhấn **"Xác Nhận Nhập Kho"**

#### Cảnh Báo Kho Thấp

Khi tồn kho bất kỳ vật tư xuống dưới mức cảnh báo, hệ thống sẽ:
- Hiển thị badge đỏ trên icon Kho Vận
- Gửi thông báo trong hệ thống cho Admin/Hành Chính
- Hiển thị cảnh báo trên Dashboard

---

### 3.7 Quản Lý Nhân Sự (HR)

**Truy cập:** Nhấn **"Nhân Sự"** hoặc **"HR"** trên menu.

#### Quản Lý Danh Sách KTV

Xem và quản lý toàn bộ nhân viên:
- Danh sách KTV với ảnh đại diện, tên, vai trò, trạng thái
- Click vào KTV để xem hồ sơ: thông tin cá nhân, lịch sử ca làm, KPI, thu nhập

#### Thêm KTV Mới

1. Nhấn **"+ Thêm Nhân Viên"**
2. Điền thông tin: Họ tên, Số điện thoại, Email (sẽ dùng để đăng nhập), Vai trò, Lương cơ bản
3. Nhập mật khẩu tạm thời
4. Nhấn **"Tạo Tài Khoản"**
5. Hệ thống gửi thông tin đăng nhập qua Zalo/Email cho KTV

#### Ghi Nhận Vi Phạm

1. Vào hồ sơ KTV cần ghi vi phạm
2. Nhấn tab **"Vi Phạm"**
3. Nhấn **"+ Thêm Vi Phạm"**
4. Chọn loại vi phạm và mức khấu trừ (% lương):
   - Đi muộn: -5%
   - Không check-in: -10%
   - Vi phạm GPS (làm giả vị trí): -15%
   - Vi phạm nghiêm trọng khác: tùy chỉnh
5. Thêm bằng chứng/ghi chú
6. Nhấn **"Ghi Nhận Vi Phạm"**

> 💡 Vi phạm sẽ **tự động được tính vào bảng lương** tháng tương ứng khi chốt lương.

#### Chấm Công

- **Chấm công tự động**: Mỗi lần KTV check-in/check-out GPS, hệ thống tự ghi vào bảng chấm công
- **Chấm công thủ công**: Admin/Hành Chính có thể điều chỉnh nếu có sự cố kỹ thuật
- **Xem báo cáo chấm công**: Lọc theo KTV / Tháng → Xuất Excel nếu cần

---

### 3.8 Bảng Lương & KPI

**Truy cập:** Nhấn **"Bảng Lương"** hoặc **"Salary"** trên menu.

#### Xem Bảng Lương Tháng

Màn hình hiển thị bảng lương tổng hợp tất cả KTV tháng hiện tại:

| Cột | Ý nghĩa |
|:---|:---|
| **Lương cơ bản** | Lương cứng theo hợp đồng, tính pro-rata nếu nghỉ |
| **Hoa hồng ca làm** | Số ca × Hệ số gói × Đơn giá ca |
| **Thưởng KPI** | Dựa trên điểm đánh giá sao trung bình, tỷ lệ đúng giờ |
| **Thưởng rating** | Bonus thêm cho KTV có đánh giá xuất sắc |
| **Trừ vi phạm** | Tổng khấu trừ từ các vi phạm đã ghi nhận |
| **Thực lĩnh** | Tổng lương = Cơ bản + Hoa hồng + Thưởng - Trừ |

#### Quy Trình Chốt Lương

```
[Draft - Tự động tính] 
    ↓
[Pending - KTV Trưởng xem xét, duyệt team]  
    ↓
[Approved - Chủ Spa/Admin phê duyệt cuối]
    ↓
[Published - KTV xem được bảng lương của mình]
    ↓
[Confirmed - KTV xác nhận đồng ý]
    ↓
[Finalized - Đã chi lương, khóa hoàn toàn]
```

> ⚠️ **Quan trọng:** Một khi bảng lương đạt trạng thái **"Finalized"** (đã chi lương), hệ thống **KHÓA HOÀN TOÀN** — không thể sửa đổi bất kỳ thành phần nào.

#### Chốt Lương Tháng

1. Vào tháng cần chốt
2. Nhấn **"Tính Lương Tự Động"** để hệ thống tổng hợp
3. Kiểm tra từng KTV, điều chỉnh thủ công nếu cần
4. Nhấn **"Gửi Duyệt"** → KTV Trưởng nhận thông báo
5. KTV Trưởng duyệt team của mình
6. Admin/Chủ Spa nhấn **"Phê Duyệt Cuối"**
7. Hệ thống tự gửi phiếu lương (PDF) qua Zalo/Email cho từng KTV

#### KPI Tháng

Xem báo cáo KPI từng KTV:
- Số ca hoàn thành
- Tỷ lệ đúng giờ (%)
- Điểm đánh giá trung bình (sao)
- Số vi phạm GPS
- Thưởng KPI được tính

---

### 3.9 AI Copilot & Decision Engine

**Truy cập:** Nhấn **"AI Copilot"** hoặc **"Decision Engine"** trên menu.

#### AI Copilot là gì?

AI Copilot là trợ lý thông minh giúp bạn:
- **Gợi ý hành động** dựa trên dữ liệu thực tế
- **Phát hiện bất thường** tự động (doanh thu giảm, KTV vắng nhiều)
- **Tự động hóa** các quy trình lặp lại

#### Các tính năng AI chính

**🔍 Phân tích khách hàng thông minh:**
- Phát hiện khách hàng có nguy cơ rời bỏ
- Gợi ý upsell gói nâng cao
- Nhắc sinh nhật bé để chăm sóc sau liệu trình

**📊 Dự báo doanh thu:**
- Dự báo doanh thu tháng tới dựa trên xu hướng
- Cảnh báo sớm nếu có dấu hiệu sụt giảm

**👥 Phân ca thông minh:**
- Gợi ý KTV phù hợp nhất cho từng booking
- Cân bằng khối lượng công việc giữa các KTV

**⚠️ Phát hiện bất thường GPS:**
- Tự động quét các ca check-in nghi ngờ giả vị trí
- Báo cáo và đề xuất hành động cho Admin

**⚙️ Decision Engine — Tự động hóa theo quy tắc:**
- Đặt quy tắc tự động: "Nếu KTV check-in muộn > 15 phút, tự động ghi vi phạm"
- Tùy chỉnh các điều kiện và hành động theo nhu cầu spa

---

### 3.10 Báo Cáo & Phân Tích

**Truy cập:** Nhấn **"Báo Cáo"** hoặc **"Analytics"** trên menu.

#### Các Loại Báo Cáo

**📈 Doanh Thu:**
- Doanh thu theo ngày/tuần/tháng/quý/năm
- So sánh cùng kỳ năm trước
- Cơ cấu gói dịch vụ (Tiết Kiệm vs Hạnh Phúc vs VIP)
- Nguồn khách (Giới thiệu / Zalo / Google Maps / Khác)

**💰 Lợi Nhuận (P&L):**
- Báo cáo lãi lỗ tháng/quý/năm
- Chi phí vận hành theo hạng mục
- Quỹ lương KTV thực tế vs kế hoạch

**👥 Khách Hàng:**
- Số khách mới theo tháng
- Tỷ lệ tái đặt gói (Retention Rate)
- Top khách hàng theo doanh thu
- Bản đồ phân bố khách theo quận/huyện

**📅 Vận Hành:**
- Hiệu suất ca làm (số ca/ngày, tỷ lệ hoàn thành)
- Phân tích mùa vụ (tháng nào nhiều khách nhất)

**👨‍💼 Nhân Sự:**
- KPI tổng hợp theo tháng
- Bảng xếp hạng KTV (Rating trung bình, Số ca, Doanh thu tạo ra)
- Báo cáo vi phạm & chấm công

#### Xuất Báo Cáo

Mỗi trang báo cáo đều có nút:
- **"Xuất Excel"**: Tải file .xlsx để thao tác thêm
- **"In / Xuất PDF"**: Tạo file PDF để báo cáo

---

### 3.11 Cài Đặt Hệ Thống

**Truy cập:** Nhấn **"Cài Đặt"** hoặc **"Settings"** trên menu (chỉ Admin).

#### Cấu Hình Chung

- **Thông tin spa**: Tên, địa chỉ, số điện thoại hotline, logo
- **Múi giờ & Ngôn ngữ**: Mặc định GMT+7 (Việt Nam)
- **Thông báo**: Cấu hình kênh thông báo (Zalo OA, Email, trong hệ thống)

#### Cấu Hình Gói Dịch Vụ

- Thêm/sửa/ẩn các gói dịch vụ
- Cấu hình hệ số ca cho từng gói
- Cấu hình định mức tiêu hao vật tư

#### Cấu Hình Lương

- Quy tắc tính lương: % hoa hồng theo loại gói
- Ngưỡng thưởng KPI
- Mức phạt vi phạm theo loại

#### Quản Lý Chi Nhánh (Multi-tenant)

Nếu có nhiều chi nhánh:
- Xem tổng quan toàn chuỗi từ tài khoản Admin gốc
- Phân quyền Admin riêng cho từng chi nhánh
- Tỷ lệ Royalty (phí nhượng quyền) chuyển về tổng

---

## 4. Hướng Dẫn Dành Cho Kỹ Thuật Viên (KTV)

KTV sử dụng **giao diện Mobile** được tối ưu riêng cho điện thoại. Truy cập cùng địa chỉ website nhưng sẽ tự động hiển thị giao diện phù hợp.

### 4.1 Truy Cập KTV Portal

1. Mở trình duyệt trên điện thoại (Chrome, Safari, hoặc qua Zalo)
2. Truy cập địa chỉ hệ thống
3. Đăng nhập bằng email và mật khẩu do Admin cấp
4. Hệ thống sẽ hiển thị giao diện KTV tối ưu cho điện thoại

> 💡 Nên **lưu trang** vào màn hình chính điện thoại để truy cập nhanh.

### 4.2 Xem Lịch Ca Hôm Nay

Màn hình chính KTV hiển thị ngay:

- **"Lịch ca hôm nay"**: Danh sách các ca theo giờ
- Mỗi ca ghi rõ:
  - Giờ hẹn
  - Tên mẹ & tên bé
  - Địa chỉ đầy đủ
  - Số buổi đang làm (ví dụ: Buổi 8/16)
  - Ghi chú đặc biệt (nếu có)

- **Lịch tuần/tháng**: Swipe để xem lịch các ngày tiếp theo

### 4.3 Check-in GPS Bắt Đầu Ca

**Quy trình check-in:**

1. Đến nhà khách hàng theo địa chỉ đã ghi
2. Trên app, tìm ca làm tương ứng
3. Nhấn nút **▶️ "Bắt Đầu Ca"** (màu xanh)
4. Điện thoại hiện popup yêu cầu **cho phép truy cập vị trí** → Nhấn **"Cho phép"**
5. Hệ thống ghi lại:
   - Tọa độ GPS hiện tại
   - Thời gian bắt đầu chính xác
   - Ca chuyển sang trạng thái **"Đang thực hiện"**
6. Admin sẽ thấy trạng thái khách đang được chăm sóc nhấp nháy trên Dashboard

> ⚠️ **Bắt buộc phải check-in khi đang ở trong nhà khách.** Nếu check-in từ xa (GPS không khớp địa chỉ khách), hệ thống sẽ đánh dấu **"Bất thường GPS"** và có thể bị khấu trừ lương.

### 4.4 Kết Thúc Ca & Check-out

**Quy trình check-out:**

1. Sau khi hoàn thành toàn bộ liệu trình cho mẹ và bé
2. Nhấn nút **⏹️ "Kết Thúc Ca"** (màu đỏ)
3. Điền ghi chú trị liệu vào ô:
   - Ví dụ: *"Bé tắm ngoan, ngủ tốt. Mẹ hồi phục tốt, da dẻ hồng hào hơn."*
4. Nhấn **"Xác Nhận Check-out"**
5. Hệ thống tự động:
   - Ghi lại GPS vị trí kết thúc ca
   - Tăng số buổi hoàn thành của khách lên 1
   - Trừ vật tư kho theo định mức
   - Gửi link đánh giá cho khách qua Zalo
   - Cập nhật thu nhập tạm tính của bạn

> 💡 **Tích buổi là KHÔNG THỂ HỦY** sau khi đã check-out thành công. Nếu check-out nhầm, hãy liên hệ ngay Admin.

### 4.5 Xem Bảng Lương & Hoa Hồng

**Truy cập:** Nhấn **"Thu Nhập"** trên thanh menu dưới của điện thoại.

#### Bảng Lương Tháng

Hiển thị chi tiết:
- **Lương cơ bản**: Mức lương cố định tháng này
- **Tổng ca quy đổi**: Số ca × hệ số gói (ví dụ: 5 ca VIP × 2.0 = 10 ca quy đổi)
- **Hoa hồng tích lũy**: Tiền hoa hồng từ các ca đã hoàn thành
- **Thưởng đánh giá sao**: Bonus từ điểm rating khách hàng
- **Trừ vi phạm**: Tổng các khoản khấu trừ
- **Dự kiến thực lĩnh**: Lương ước tính (sẽ chính thức sau khi Admin chốt)

#### Đối Soát Theo Gói Dịch Vụ

Thẻ **"Đối Soát Theo Gói"** giúp bạn kiểm tra chi tiết:
- Đã làm bao nhiêu buổi cho gói *Combo Mẹ & Bé Hạnh Phúc*
- Đã làm bao nhiêu buổi cho gói *Combo Mẹ & Bé VIP*
- Hoa hồng tương ứng của từng loại gói

> 💡 Nếu thấy số liệu không đúng, hãy báo ngay cho Admin để kiểm tra trong thời gian bảng lương còn ở trạng thái **Draft**.

---

## 5. Hướng Dẫn Dành Cho Kế Toán

### Truy Cập Phân Hệ Kế Toán

Sau khi đăng nhập với tài khoản Kế Toán, menu hiển thị:
- **Doanh Thu**: Ghi nhận, duyệt giao dịch
- **Chi Phí**: Quản lý hóa đơn, phê duyệt chi phí
- **Đối Soát**: Kiểm tra chênh lệch thanh toán
- **Báo Cáo**: Xuất báo cáo tài chính

### Quy Trình Hàng Ngày Của Kế Toán

**Buổi sáng:**
1. Kiểm tra màn hình **Đối Soát Tài Chính** — xem có cảnh báo lệch nào không
2. Xem danh sách giao dịch chờ xác nhận từ hôm qua
3. Xác nhận các giao dịch chuyển khoản đã nhận

**Cuối ngày:**
1. Đối chiếu tổng thu trong ngày với sao kê ngân hàng
2. Ghi nhận các chi phí phát sinh trong ngày
3. Xem P&L tạm tính ngày

**Cuối tháng:**
1. Đóng sổ tháng: Xác nhận tất cả giao dịch
2. Phê duyệt bảng chi phí vận hành
3. Xuất báo cáo P&L tháng để báo cáo chủ spa
4. Ghi nhận chi phí lương vào hệ thống sau khi Admin chốt

### Phê Duyệt Chi Phí

1. Vào **"Chi Phí"** → **"Chờ Phê Duyệt"**
2. Xem từng khoản chi phí được nhân viên nộp
3. Kiểm tra hóa đơn đính kèm
4. Nhấn **"Phê Duyệt"** hoặc **"Từ Chối"** (kèm lý do)

> ⚠️ Chỉ chi phí có trạng thái **"Đã phê duyệt"** mới được tính vào báo cáo P&L.

---

## 6. Hướng Dẫn Dành Cho Khách Hàng (Customer Portal)

Khách hàng **không cần tạo tài khoản** — Bella Spa gửi link cá nhân hóa qua Zalo sau mỗi ca hoàn thành.

### Cách Truy Cập

1. Mở Zalo và kiểm tra tin nhắn từ **Bella Spa Official Account**
2. Nhấn vào **link 1-click** trong tin nhắn
3. Trang cá nhân hóa của bạn tự động mở ra

### Những Gì Bạn Có Thể Xem

#### 📊 Tiến Độ Liệu Trình
- Thanh tiến trình trực quan: **"Hoàn thành 8 / 16 buổi"**
- Lịch sử các buổi đã thực hiện (ngày, KTV phụ trách)
- Số buổi còn lại

#### 👩‍⚕️ Thông Tin KTV Phụ Trách
- Tên và ảnh đại diện của KTV chính
- Thông tin liên hệ khi cần thay đổi lịch

#### 📞 Liên Hệ Nhanh
- Nút **"Hotline 0865 701 493"** màu vàng nổi bật
- Nhấn để gọi ngay cho tổng đài Bella Spa

### Đánh Giá Ca Chăm Sóc

Sau mỗi ca hoàn thành, popup đánh giá tự động xuất hiện:

1. **Chấm sao** từ ⭐ đến ⭐⭐⭐⭐⭐
2. **Ghi ý kiến** (tùy chọn, tối đa 200 ký tự)
3. Nhấn **"Gửi Đánh Giá"**

> 🔒 **Bảo mật:** Ghi chú của bạn được **mã hóa hoàn toàn** và **chỉ Quản lý Bella Spa mới xem được**. KTV không bao giờ đọc được nội dung ghi chú của bạn.

---

## 7. Quy Trình Vận Hành Theo Ngày / Tháng

### 📅 Quy Trình Hàng Ngày

```
07:00 — Admin: Kiểm tra lịch ca hôm nay, xem Dashboard
07:30 — KTV: Nhận lịch ca qua app/Zalo
08:00 — KTV: Bắt đầu di chuyển đến nhà khách đầu tiên
         └─ Check-in GPS khi đến nơi
⏱️  Trong ngày: Admin giám sát trạng thái ca real-time
         └─ Cảnh báo nếu KTV chưa check-in gần giờ hẹn
17:00 — KTV: Hoàn thành ca cuối, check-out, ghi nhận
         └─ Khách nhận link đánh giá tự động
18:00 — Hành Chính: Đối chiếu giao dịch thanh toán ngày
         └─ Xác nhận chuyển khoản với sao kê ngân hàng
19:00 — Kế Toán: Xem P&L tạm tính ngày, ghi nhận chi phí
```

### 📆 Quy Trình Cuối Tháng

```
Ngày 25-28: Admin bắt đầu quy trình chốt lương
  └─ Nhấn "Tính Lương Tự Động" → Hệ thống tổng hợp
  └─ Kiểm tra từng KTV, điều chỉnh nếu cần

Ngày 28-29: KTV Trưởng xem xét và duyệt lương team
  └─ Nhấn "Phê Duyệt" sau khi xác nhận đúng

Ngày 29-30: Admin/Chủ Spa phê duyệt cuối
  └─ Hệ thống gửi phiếu lương cho KTV

Ngày 30-31: Chuyển lương
  └─ Ghi nhận ngày & phương thức chi lương
  └─ Trạng thái chuyển sang "Finalized" — KHÓA HOÀN TOÀN

Ngày 1 tháng mới: Kế Toán xuất báo cáo P&L tháng cũ
  └─ Ghi nhận chi phí lương vào hệ thống
  └─ Đối chiếu tổng thu/chi với ngân hàng
```

---

## 8. Câu Hỏi Thường Gặp (FAQ)

### ❓ Tôi quên mật khẩu, phải làm gì?
Liên hệ Admin của spa để được cấp lại mật khẩu. Admin vào phần **Cài Đặt → Quản Lý Người Dùng → Reset Mật Khẩu**.

### ❓ KTV check-in nhưng GPS báo bất thường, xử lý thế nào?
Admin kiểm tra bản đồ vị trí check-in thực tế trong hồ sơ ca làm. Nếu KTV có lý do hợp lệ (ví dụ: điện thoại GPS kém trong nhà), Admin có thể **xóa cờ bất thường** trong phần chi tiết ca làm. Nếu cố tình gian lận, ghi nhận vi phạm theo quy trình.

### ❓ Khách hàng chuyển tiền nhưng không thấy trong hệ thống?
Kiểm tra: (1) Kế Toán đã ghi nhận giao dịch chưa? (2) Giao dịch đã được **"Xác Nhận"** chưa (phân biệt Pending vs Confirmed)? Chỉ giao dịch **Confirmed** mới hiển thị trong đối soát.

### ❓ Tôi tích sai buổi cho khách, có sửa được không?
Không thể tự sửa. Liên hệ **Admin** và cung cấp: mã booking, số buổi bị tích sai, lý do. Admin sẽ xử lý kỹ thuật và ghi nhận vào audit log.

### ❓ Bảng lương của tôi sao tính sai số ca?
Vào **"Thu Nhập"** → **"Đối Soát Theo Gói"** để tự kiểm tra. Nếu thấy thiếu ca, kiểm tra lại có ca nào check-out thất bại không. Báo cho Admin trong thời gian bảng lương còn trạng thái **Draft** — sau khi Finalized sẽ không sửa được.

### ❓ Khách hàng không nhận được link đánh giá qua Zalo?
Kiểm tra: (1) Số điện thoại khách trong hệ thống có đúng không? (2) Khách đã kết bạn/follow Bella Spa Zalo OA chưa? Nếu chưa, hướng dẫn khách quét mã QR để follow OA.

### ❓ Hệ thống báo "Lệch đối soát" nhưng tôi kiểm tra thấy đúng rồi?
Nhập một giao dịch âm (số tiền = 0đ hoặc số tiền điều chỉnh) với ghi chú giải thích. Hoặc báo Admin kiểm tra lại tổng thu trong bảng `revenue` so với giá trị trong `bookings.full_price`.

### ❓ Có thể xem báo cáo trên điện thoại không?
Có, hệ thống hỗ trợ **responsive** trên cả điện thoại. Tuy nhiên, một số báo cáo phức tạp (bảng lớn, biểu đồ nhiều cột) sẽ hiển thị tốt hơn trên máy tính.

---

## 9. Xử Lý Sự Cố Phổ Biến

### 🔴 Lỗi: "Không thể đăng nhập"
**Kiểm tra:**
- Email nhập có đúng không (phân biệt chữ hoa/thường)?
- Mật khẩu có đúng không?
- Tài khoản có bị Admin vô hiệu hóa không?

**Giải pháp:** Liên hệ Admin spa hoặc hotline hỗ trợ kỹ thuật.

### 🔴 Lỗi: "Không thể check-in GPS"
**Kiểm tra:**
- Đã cấp quyền vị trí cho trình duyệt chưa? (Vào Cài Đặt điện thoại → Ứng dụng → Chrome/Safari → Vị trí → Cho phép)
- Có đang bật GPS/Vị Trí trên điện thoại không?
- Kết nối internet có ổn định không?

**Giải pháp:** Bật GPS, cho phép quyền vị trí, thử lại. Nếu vẫn không được, báo Admin check-in thủ công.

### 🔴 Lỗi: "Trang tải chậm hoặc không tải được"
**Kiểm tra:**
- Kết nối internet (WiFi hoặc 4G)?
- Thử tải lại trang (F5 hoặc kéo xuống trên mobile)?

**Giải pháp:** Xóa cache trình duyệt (Cài Đặt → Xóa lịch sử duyệt web → Dữ liệu đã lưu trong cache).

### 🔴 Lỗi: Bảng lương không tính đúng
**Nguyên nhân thường gặp:**
- Ca làm chưa được check-out đầy đủ
- Vi phạm mới được ghi nhận nhưng chưa refresh
- Cấu hình lương thay đổi giữa chừng

**Giải pháp:** Admin vào **"Bảng Lương"** → Chọn KTV → Nhấn **"Tính Lại"** để hệ thống tính toán lại từ đầu.

### 🔴 Màn hình báo "Phiên làm việc hết hạn"
Tự động đăng nhập lại sau 8 giờ không hoạt động. Nhấn **"Đăng nhập lại"** và nhập lại thông tin.

---

## 📞 Liên Hệ Hỗ Trợ

| Kênh | Thông tin |
|:---|:---|
| **Hotline Spa** | 0865 701 493 |
| **Zalo OA** | Bella Spa Official |
| **Hỗ trợ kỹ thuật** | support@bellaspa.vn |
| **Giờ hỗ trợ** | 08:00 — 20:00, Thứ 2 — Thứ 7 |

---

*Tài liệu này được cập nhật tháng 07/2026. Nếu thấy thông tin chưa chính xác hoặc cần bổ sung, vui lòng phản hồi qua email support@bellaspa.vn.*

---
**© 2026 Bella Spa ERP — Powered by Antigravity AI**
