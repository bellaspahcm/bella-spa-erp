# Hướng dẫn Xử lý Giao diện, Màu sắc Multi-Tenant & Khắc phục Lỗi hiển thị (Theming & UI Troubleshooting Guide)

Tài liệu này ghi chép lại các kiến thức quan trọng về cấu trúc giao diện Multi-Tenant của Bella Spa ERP, các lỗi hiển thị giao diện/màu sắc thường gặp (đặc biệt là trên thiết bị di động hoặc khi thay đổi các cấu hình thương hiệu) và cách xử lý hiệu quả nhất.

---

## 1. Kiến trúc Giao diện Multi-Tenant (Theme Architecture)

Hệ thống hoạt động dưới dạng Multi-Tenant (Nhiều chi nhánh/đối tác khác nhau với cấu hình thương hiệu riêng biệt). Màu sắc chủ đạo được đồng bộ hóa động từ cơ sở dữ liệu dựa trên tenant hiện tại thông qua các thuộc tính dữ liệu (`data-*`) trên thẻ `<html>` và các biến CSS toàn cục:

### Các thuộc tính trên thẻ `<html>`:
* `data-tenant-module`: Xác định loại phân hệ active (ví dụ: `bella_spa`, `beauty_spa`, `industrial_cleaning`, `student_training`).
* `data-tenant-brand-button`: Kiểu dáng nút bấm (`pill`, `rounded`, `minimal`).
* `data-tenant-brand-menu`: Kiểu hiển thị menu (`comfortable`, `compact`).
* `data-tenant-brand-radius`: Kiểu bo góc của thẻ và bảng (`soft`, `sharp`).

### Các biến CSS chủ đạo (CSS Variables):
Hệ thống sử dụng các biến CSS động để định hình bảng màu thay vì mã hóa cứng màu Tailwind:
* `--primary`: Màu chủ đạo của phân hệ (ví dụ: Hồng của Bella Spa, Xanh lục của Beauty Spa, Xanh dương của Dịch vụ vệ sinh).
* `--primary-hover`: Màu khi di chuột qua các thành phần chủ đạo.
* `--primary-foreground`: Màu chữ hiển thị trên nền màu chủ đạo (thường là trắng hoặc kem).
* `--accent`: Màu tạo điểm nhấn (Accent color).
* `--background` và `--foreground`: Màu nền và chữ nền của ứng dụng.

> [!IMPORTANT]
> **Quy tắc Vàng cho Lập trình viên:**
> Khi viết mã nguồn UI, **không bao giờ** mã hóa cứng (hardcode) các lớp màu cụ thể của Tailwind như `bg-pink-500`, `text-pink-600`, `border-purple-200` vào các trang dùng chung. Thay vào đó, hãy sử dụng các lớp ngữ nghĩa động (semantic classes) của Tailwind v4:
> * Thay vì `bg-pink-500` ➔ Sử dụng `bg-primary`
> * Thay vì `hover:bg-pink-600` ➔ Sử dụng `hover:bg-primary-hover`
> * Thay vì `text-pink-500` ➔ Sử dụng `text-primary`
> * Thay vì `text-white` (trên nút bấm) ➔ Sử dụng `text-primary-foreground`

---

## 2. Các lỗi giao diện phổ biến & Hướng dẫn xử lý (Troubleshooting Guide)

### Lỗi 2.1: Chữ bị ẩn hoặc chuyển sang màu trắng trên nền trắng (White-on-White Dropdowns)

#### Mô tả lỗi:
Khi người dùng mở một ô chọn (`select` / `dropdown`), nhãn chữ hiển thị của tùy chọn được chọn hoặc biểu tượng mũi tên (`ChevronDown`) biến mất (chữ trắng trên nền trắng), hoặc nền của ô chọn bị đổi sang màu xám/tối màu không đồng bộ.

#### Nguyên nhân kỹ thuật:
1. **Độ ưu tiên CSS (CSS Specificity) bị đè:**
   Một số quy tắc CSS toàn cục dạng bao quát (ví dụ: `html[data-tenant-module="beauty_spa"] .active-booking-panel span:not(...)`) có độ ưu tiên cao hơn các class Tailwind thường (`text-slate-800`). Điều này vô tình ép tất cả thẻ `span` bên trong nó chuyển sang màu trắng hoặc kem nhạt.
2. **Thành phần dùng chung (Portal components) bị ảnh hưởng:**
   Các thư viện dropdown hoặc thành phần tùy chỉnh khi hiển thị danh sách (Dropdown List) thường tạo một Portal nằm trực tiếp dưới thẻ `<body>` (ngoài cấu trúc cây DOM của thẻ cha). Do đó, các bộ lọc CSS theo cấu trúc cha-con thông thường sẽ không tác dụng hoặc tác dụng sai lệch lên danh sách này.

#### Cách khắc phục triệt để:
1. **Ép kiểu kiểu inline (Inline Styles) làm chốt chặn bảo vệ:**
   Đối với các thành phần điều khiển toàn cục như `PremiumSelect`, sử dụng thuộc tính `style` trực tiếp trên các thẻ nhãn chữ và biểu tượng để đảm bảo độ ưu tiên cao nhất, không bị các lớp CSS toàn cục của các theme ghi đè:
   ```tsx
   <span 
     className={cn("text-sm font-semibold truncate", selectedOption ? "text-slate-800" : "text-slate-700")}
     style={{ color: '#1e293b' }} // Đảm bảo luôn có màu xám đậm trên nền trắng
   >
     {selectedOption?.label}
   </span>
   ```
2. **Sử dụng bộ chọn Tailwind v4 có độ ưu tiên cao (`!` modifier):**
   Trong trường hợp cần override thông qua class, hãy sử dụng hậu tố `!` (ví dụ: `!text-slate-900` thay vì `text-slate-900`). Trong file `globals.css`, khai báo thêm các quy tắc hướng đối tượng cụ thể:
   ```css
   html[data-tenant-module="beauty_spa"] .absolute.z-50 button span,
   html[data-tenant-module="beauty_spa"] div.absolute.z-50 button span {
     color: rgb(30 41 59) !important; /* Buộc màu tối cho chữ trong dropdown list */
   }
   ```
3. **Loại bỏ nền xám cố định khi di chuột:**
   Đảm bảo các trạng thái hover được xử lý động bằng `hover:bg-slate-100` thay vì thiết lập cứng màu nền của dòng. Màu nền đặc biệt (như màu xanh hoặc hồng nhạt) chỉ nên áp dụng cho dòng đã được chọn (`active / selected item`).

---

### Lỗi 2.2: Giao diện trang bị cắt dữ liệu, bảng không cuộn ngang trên điện thoại (Mobile Table Clipping)

#### Mô tả lỗi:
Bảng dữ liệu có nhiều cột (như trang Nhật ký hệ thống - Audit Trail) khi hiển thị trên điện thoại di động chỉ xem được 2 cột đầu (`Thời gian` và `Người thực hiện`). Các cột còn lại bị cắt mất và không thể vuốt/cuộn sang phải để xem tiếp.

```
+---------------------------+  <- Biên màn hình điện thoại
| Thời gian   | Người thực. | 
| 13:40:34    | Cao Thị V.  |  <- Bị cắt mất cột Hành động, Chi tiết...
+---------------------------+  <- Không có thanh cuộn hoặc cử chỉ vuốt
```

#### Nguyên nhân kỹ thuật:
1. **Thiếu ràng buộc kích thước tối thiểu của bảng (`min-width`):**
   Nếu bảng chỉ có thuộc tính `w-full` (width: 100%), trình duyệt sẽ cố gắng nén toàn bộ các cột vào chiều rộng hẹp của màn hình điện thoại (khoảng 350px - 400px). Việc này làm các cột sau bị thu nhỏ kích thước về 0px hoặc bị đẩy hoàn toàn ra ngoài vùng hiển thị.
2. **Mất thanh cuộn ngang do CSS Flexbox/Grid của container cha:**
   Nếu thẻ div bọc bảng có class `w-full overflow-x-auto` nhưng thẻ cha của nó nằm trong một chuỗi bố cục Flexbox/Grid không giới hạn chiều rộng (`min-w-0`), thẻ cha sẽ tự giãn rộng ra bằng chiều rộng thực tế của bảng (1100px) thay vì giới hạn theo chiều rộng màn hình. Điều này khiến thanh cuộn không xuất hiện và giao diện bị tràn.
3. **Thiếu chỉ dẫn trực quan cho người dùng:**
   Trên các thiết bị cảm ứng, thanh cuộn mặc định sẽ ẩn đi nếu người dùng không tương tác. Nếu không có bóng mờ ở cạnh phải, người dùng sẽ nghĩ giao diện bị lỗi hiển thị thay vì biết rằng có thể cuộn ngang.

#### Cách khắc phục triệt để:
Có hai cách tiếp cận chính tùy vào độ phức tạp của dữ liệu:

#### Giải pháp 1: Tách biệt giao diện Mobile và Desktop (Khuyên dùng cho dữ liệu cực kỳ phức tạp)
Thay vì cố gắng hiển thị một bảng 6-7 cột trên màn hình điện thoại, hãy tách biệt mã nguồn hiển thị:
* **Trên Mobile (dưới `md` - 768px):** Chuyển đổi bảng thành danh sách dạng thẻ (**stacked cards**). Mỗi dòng dữ liệu tương ứng với một thẻ riêng biệt, xếp chồng theo chiều dọc để tận dụng tối đa chiều rộng màn hình.
* **Trên Desktop (từ `md` trở lên):** Hiển thị bảng dạng lưới truyền thống.

```tsx
{/* Mobile View (hiển thị danh sách thẻ) */}
<div className="block md:hidden divide-y divide-slate-100">
  {paginatedLogs.map((log) => (
    <div key={log.id} className="p-5 space-y-3">
      <div className="flex justify-between">
        <span className="font-semibold">{log.user_name}</span>
        <span className="badge">{log.action}</span>
      </div>
      <div className="text-sm text-slate-600">{renderReadableChanges(log)}</div>
    </div>
  ))}
</div>

{/* Desktop View (hiển thị bảng lưới) */}
<div className="hidden md:block w-full overflow-x-auto">
  <table className="bella-data-table w-full" style={{ minWidth: '1100px' }}>
    ...
  </table>
</div>
```

#### Giải pháp 2: Ràng buộc kích thước và thêm bóng đổ chỉ hướng cuộn
Nếu bắt buộc phải dùng bảng trên mobile, hãy đảm bảo cấu trúc HTML luôn tuân thủ:
1. Thẻ bọc bảng phải có class: `w-full overflow-x-auto overscroll-x-contain custom-scrollbar shadow-[inset_-18px_0_18px_-18px_rgba(0,0,0,0.15)]`. Bộ bóng đổ này sẽ tạo vệt mờ trực quan bên phải báo hiệu có dữ liệu ẩn phía sau.
2. Thẻ `<table>` phải được gán cứng độ rộng tối thiểu thông qua inline style `style={{ minWidth: '1100px' }}` (hoặc rem tương đương) để ngăn trình duyệt tự động co cột.
3. Đảm bảo toàn bộ các thẻ cha của khối này (lên đến thẻ `<main>`) đều có thuộc tính `min-w-0` or `max-w-full` để ngăn việc tự động giãn rộng cây DOM vượt quá màn hình.

---

### Lỗi 2.3: Thẻ thống kê, tiêu đề, và biểu đồ bị nén cột hoặc chồng chéo chữ trên điện thoại (Dashboard Card & Grid Overlaps)

#### Mô tả lỗi:
Khi hiển thị trên màn hình nhỏ (Mobile):
* Tiêu đề trang và các nút bộ lọc/nút bấm bị ép nằm ngang, làm cho chữ tiêu đề bị ngắt dòng bất thường (ví dụ: `Executive\nDashboard`) hoặc đẩy nút bấm ra ngoài biên màn hình.
* Các nhóm chỉ số phụ (ví dụ: danh sách Top nguồn doanh thu, hay các ô thống kê nhỏ) hiển thị ở dạng cột hẹp (2 hoặc 3 cột), dẫn đến việc chữ và số bị dính sát vào nhau, mất khoảng cách trắng, hoặc chồng chéo đè lên nhau gây khó đọc (ví dụ: `remaining_payment9.100.000đ`).
* Biểu đồ đường hay biểu đồ cột bị cố định một màu sắc riêng lẻ (như màu xanh lục mặc định), không tự động điều chỉnh theo dải màu của tenant đang chạy.

#### Nguyên nhân kỹ thuật:
1. **Sử dụng grid số cột cố định (`grid-cols-2`, `grid-cols-3`):**
   Khi màn hình hẹp lại còn 320px - 390px, nếu chia làm 2 hoặc 3 cột thì mỗi cột chỉ còn khoảng 90px - 150px. Kích thước này quá hẹp để chứa các dòng văn bản dài (như tên phương thức thanh toán hoặc số tiền tệ định dạng dạng VND đầy đủ chữ `đ`).
2. **Khóa cứng Header bằng `flex-row` hoặc `justify-between` mà không có wrap:**
   Thanh công cụ tiêu đề trang thường được xếp bằng `flex items-center justify-between`. Trên thiết bị di động, chiều ngang không đủ cho cả tiêu đề dài và các dropdown lọc dữ liệu cùng hiển thị trên một hàng.
3. **Mã hóa cứng màu sắc trong biểu đồ Recharts:**
   Các thẻ vẽ biểu đồ `<Line>` hay `<Area>` có thuộc tính màu sắc nét vẽ (`stroke`) hoặc màu tô nền (`fill`) bị gán cứng giá trị hex (ví dụ: `#10b981`).

#### Cách khắc phục triệt để:
1. **Thiết lập cột thích ứng linh hoạt (Responsive Grid):**
   Thay đổi các class phân chia cột cố định thành dạng tự co giãn theo kích thước màn hình. Trên di động xếp chồng 1 cột, trên màn hình máy tính hiển thị nhiều cột:
   * Sử dụng: `grid grid-cols-1 sm:grid-cols-2 gap-6` (cho các panel hai cột) hoặc `grid grid-cols-1 sm:grid-cols-3 gap-4` (cho các thẻ thông số).
2. **Cho phép Header tự động ngắt dòng và xếp dọc:**
   Sử dụng cấu trúc flexbox xếp dọc trên mobile và chuyển sang hàng ngang trên máy tính:
   ```tsx
   <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
     <div>
       <h1 className="text-2xl sm:text-3xl font-bold ...">Tiêu đề</h1>
     </div>
     <div className="flex items-center gap-3 w-full sm:w-auto">
       {/* Ô chọn và nút bấm sẽ chiếm trọn chiều rộng hàng mới trên mobile */}
     </div>
   </div>
   ```
3. **Sử dụng các nhãn chữ hiển thị đã được định dạng và dịch thuật:**
   Với các giá trị khóa hệ thống từ API (ví dụ: `remaining_payment`), hãy tạo đối tượng map ngôn ngữ để chuyển thành tiếng Việt có dấu ngắn gọn trước khi render, giúp tiết kiệm không gian ngang và tăng tính chuyên nghiệp:
   ```tsx
   const REVENUE_SOURCE_LABELS: Record<string, string> = {
     remaining_payment: 'Thanh toán còn lại',
     deposit: 'Tiền đặt cọc',
     package_payment: 'Thanh toán trọn gói',
   };
   ```
4. **Liên kết biểu đồ với biến CSS động của Tenant:**
   Trong các tệp biểu đồ Recharts, thay thế mã hex màu sắc cứng bằng biến CSS chủ đạo:
   ```tsx
   <Line
     type="monotone"
     dataKey="revenue"
     stroke="var(--primary)" // Lấy động màu hồng, xanh lục hoặc xanh dương tùy phân hệ
     strokeWidth={2.5}
     dot={{ fill: "var(--primary)", r: 4 }}
   />
   ```

---

## 3. Quy trình Kiểm thử & Xác minh (Verification Checklist)

Khi bạn thực hiện bất kỳ thay đổi nào liên quan đến giao diện người dùng (CSS/HTML/JS) trong hệ thống Multi-Tenant này, hãy kiểm tra danh sách sau trước khi commit code:

- [ ] **Kiểm tra đa phân hệ (Multi-tenant check):** Chuyển đổi tenant để kiểm tra xem màu sắc của các nút, ô chọn và tab liên kết có tự động chuyển đổi từ Hồng (Bella Spa) sang Xanh lục (Beauty Spa) hoặc Xanh dương (Dịch vụ vệ sinh) hay không.
- [ ] **Kiểm tra độ tương phản màu chữ (Contrast check):** Mở tất cả các dropdown và các thẻ cảnh báo để chắc chắn không có hiện tượng chữ trắng hiển thị trên nền sáng/trắng hoặc chữ tối trên nền tối.
- [ ] **Kiểm tra trên chế độ di động (Mobile emulator test):** Sử dụng Chrome DevTools giả lập màn hình iPhone SE (320px) hoặc iPhone 12 Pro (390px) để kiểm tra:
  * Thanh cuộn ngang có xuất hiện không?
  * Nội dung các ô nhập và bảng có bị tràn ra ngoài viền màn hình không?
  * Khoảng cách padding/margin có bị quá lớn làm mất không gian hiển thị không?
- [ ] **Kiểm tra Chế độ tối (Dark mode check):** Chuyển đổi giao diện sang chế độ tối (Dark Mode) để đảm bảo các màu sắc và độ mờ nền (backdrop-blur) vẫn giữ nguyên tính thẩm mỹ và dễ đọc thông tin.
