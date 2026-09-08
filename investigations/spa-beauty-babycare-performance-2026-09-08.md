# Phân tích tải dữ liệu và lưu thay đổi — Beauty Spa / Babycare

Ngày: 2026-09-08. Trạng thái: hoàn tất phân tích source; chưa đo runtime hiện tại. Phạm vi: chỉ phân tích, không sửa code/cấu hình/database.

## Yêu cầu và phạm vi

Người dùng phản ánh: chỉnh sửa gói dịch vụ xong lưu chậm, thay đổi/dời lịch chậm, dữ liệu loading chậm trên toàn hệ thống. Phân tích hai module beauty_spa và babycare cùng các lớp dashboard dùng chung. Chưa xác định môi trường xảy ra, bản deploy, kích thước dữ liệu và thời gian chờ thực tế.

## Nguồn bằng chứng

- Checkout hiện tại: HEAD f0bce4e7, có nhiều thay đổi chưa commit từ các công việc khác.
- Source code: có thể xác nhận thứ tự gọi, vòng lặp, điểm chờ UI, cache và invalidation.
- Báo cáo cũ: docs/performance/SPA_APPOINTMENT_PERFORMANCE_AUDIT_2026_08_30.md, môi trường local dev/mock auth, không đại diện số đo production hiện tại.
- Thiếu: HAR/browser timings của thao tác thật; trace từng server action; query plans/lock wait trên DB của môi trường bị chậm.

## Điểm neo đã xác nhận

src/proxy.ts:126 gọi auth.getUser; khi có user, dòng 149 đọc users.role nối tiếp. Matcher dòng 224-230 áp dụng rộng, gồm dashboard và API. Đây là overhead cấu trúc; chưa có số đo hiện tại về thời gian overhead này.

## Phân loại kết luận

- Xác nhận trong mã: hành vi trực tiếp có thể kiểm chứng bằng source.
- Suy luận: cơ chế có thể tạo độ trễ từ chuỗi gọi đã xác nhận.
- Chưa chứng minh: nguyên nhân chiếm bao nhiêu thời gian ở môi trường người dùng.

## Kết luận chính

Mã hiện tại cho thấy nguyên nhân cấu trúc phù hợp với cả ba triệu chứng: một thao tác người dùng phải chờ nhiều lượt gọi nối tiếp, dời lịch xử lý từng buổi, và tải trang bị chặn bởi nhiều lớp khởi tạo/nhóm dữ liệu. Beauty Spa và Babycare dùng chung các đường này; khác biệt chủ yếu là số buổi còn lại và có dùng tài nguyên đặt lịch hay không. Độ tin cậy cao về chuỗi xử lý trong source, trung bình về mức độ giải thích trải nghiệm thực tế, chưa có bằng chứng để kết luận database/server hiện tại quá tải hoặc phân bổ tỷ lệ thời gian.

### 1. Lưu gói dịch vụ chờ cả ghi lại định mức vật tư

**Xác nhận:** [useServicesPageState.ts:717](../src/app/dashboard/services/hooks/useServicesPageState.ts#L717) chờ updatePackage, sau đó [dòng 743/751](../src/app/dashboard/services/hooks/useServicesPageState.ts#L743) tiếp tục chờ upsertPackageMaterials. Không so sánh vật tư đã thay đổi hay chưa. Gói không có vật tư vẫn gọi upsertPackageMaterials(packageId, []).

Toast cập nhật gói thành công xuất hiện ở dòng 720, nhưng modal chỉ đóng ở dòng 754 và isSubmitting chỉ reset ở dòng 761. Điều này giải thích vì sao có thể thấy đã cập nhật mà biểu mẫu vẫn bận.

Đường chờ thành công của một lần sửa gói hiện có:

```text
Bấm Lưu
  → xác thực/quyền
  → đọc module tenant
  → đọc gói cũ
  → UPDATE gói
  → INSERT audit
  → toast cập nhật gói
  → action thứ hai: xác thực/quyền sở hữu
  → đọc vật tư cũ
  → DELETE vật tư cũ
  → INSERT vật tư mới nếu có
  → đóng modal, hết trạng thái đang lưu
```

**Bằng chứng backend:** [package-actions.ts:335](../src/services/package-actions.ts#L335), module lookup [132](../src/services/package-actions.ts#L132), old row [354](../src/services/package-actions.ts#L354), update [390](../src/services/package-actions.ts#L390), audit [404](../src/services/package-actions.ts#L404). Materials: [inventory-actions.ts:279](../src/services/inventory-actions.ts#L279), ownership [91](../src/services/inventory-actions.ts#L91), snapshot [298](../src/services/inventory-actions.ts#L298), delete [310](../src/services/inventory-actions.ts#L310), insert [335](../src/services/inventory-actions.ts#L335).

**Suy luận:** ngay cả chỉ đổi tên/giá gói, nhánh thành công có ít nhất 7 thao tác DB tường minh nối tiếp khi danh sách vật tư rỗng, hoặc 9 khi có vật tư hợp lệ. Số này chưa tính auth/profile, request middleware, retry, hoặc render/revalidation; không phải số đo Network. Hai server action nối tiếp khiến độ trễ mỗi lượt tới backend/DB cộng dồn.

**Phản chứng đã kiểm tra:** loadData sau lưu chạy nền bằng void ở dòng 756; không phải toàn bộ thời gian tải lại danh sách đều giữ nút Lưu. Audit và kiểm tra tenant bảo vệ tính đúng đắn, không được suy ra rằng có thể bỏ chúng.

### 2. Dời lịch xử lý cả chuỗi buổi tương lai theo thứ tự

[reschedule-session-action.ts:69](../src/core/services/order/reschedule-session-action.ts#L69) lấy các buổi scheduled từ session_number được chọn trở đi. [Dòng 98](../src/core/services/order/reschedule-session-action.ts#L98) kiểm tra từng buổi bằng await trong vòng lặp; [dòng 133](../src/core/services/order/reschedule-session-action.ts#L133) lại UPDATE từng buổi bằng await trong vòng lặp thứ hai. Sau đó còn chờ audit ở dòng 156 và đọc customer_id ở dòng 223.

Với N buổi bị dời và R buổi có đủ tài nguyên/ngày/giờ để kiểm tra: **N request UPDATE nối tiếp + 2R request đọc kiểm tra tài nguyên/xung đột**, cộng phần chuẩn bị, auth và audit. Guard có hai query tại [booking-resource-schedule-guard.ts:57](../src/core/services/order/booking-resource-schedule-guard.ts#L57) và [77](../src/core/services/order/booking-resource-schedule-guard.ts#L77).

**Hệ quả:** thao tác nhìn như đổi một ngày có thể thực sự thay cả chuỗi lịch. Gói nhiều buổi chờ lâu hơn theo cấu trúc hiện tại. Babycare không gán tài nguyên tránh được hai lượt đọc mỗi buổi nhưng vẫn cập nhật lần lượt. Beauty Spa có phòng/giường/tài nguyên chịu thêm kiểm tra xung đột. Đây là điều kiện theo dữ liệu, không phải khẳng định mọi tenant Beauty đều chậm hơn Babycare.

**Phản chứng:** thiếu tài nguyên/ngày/giờ thì guard return sớm ở dòng 48; conflict query limit(1). Notification và revalidation trong reschedule đã chạy nền ở dòng 181 và 237, không cộng chúng như phần await giữ nút Lưu.

### 3. Đổi nhiều thuộc tính lịch có thể chờ nhiều server action nối tiếp

Trong [useBookingsPageActions.ts:319](../src/app/dashboard/bookings/hooks/useBookingsPageActions.ts#L319):

```text
checkBookingConflicts
  → rescheduleSession nếu đổi ngày
  → updateBooking nếu đổi KTV
  → updateSessionLog nếu còn trường thực sự thay đổi
  → báo thành công / đóng modal
```

Bằng chứng: dòng 356, 365, 399, 408. Đổi ngày đơn thuần đi qua conflict check và reschedule; đổi cả ngày/KTV/giờ có thể tới bốn action. Mỗi action có công việc DB phía trong; không thể nhìn một cú bấm để suy ra một UPDATE.

**Phản chứng:** payload đã chỉ lấy trường thay đổi, không update ngày lần nữa sau reschedule, không gọi updateSessionLog nếu không còn thay đổi. Refetch sessions/bookings sau thành công đã chạy nền qua scheduleBackgroundRefresh/Promise.all ở dòng 410, không chờ trước đóng modal.

### 4. Tải ban đầu phải đi qua nhiều lớp chờ dùng chung

```text
Proxy: xác thực → đọc role
  → client TenantContextProvider: /api/tenant/context
      → xác thực → users.tenant_id → tenants
  → DashboardLayout: user + tenant settings (song song trong lớp này)
  → tải dữ liệu màn hình
```

**Bằng chứng:** [proxy.ts:126](../src/proxy.ts#L126), [149](../src/proxy.ts#L149); [TenantContextProvider.tsx:161](../src/core/providers/TenantContextProvider.tsx#L161) và loading thay children ở [288](../src/core/providers/TenantContextProvider.tsx#L288); API [tenant/context/route.ts:147](../src/app/api/tenant/context/route.ts#L147), 177, 216; [dashboard/layout.tsx:88](../src/app/dashboard/layout.tsx#L88), 150, 194.

**Hệ quả:** cold open/hard reload chịu tổng độ trễ của các lớp phụ thuộc. Proxy matcher áp rộng cả dashboard và API. Đây là ứng viên giải thích chậm ở nhiều màn hình hơn một query riêng lẻ.

**Không được diễn giải quá mức:** user/tenant client cache đã có TTL 5 phút và in-flight reuse ([dashboard-client-context.ts:12](../src/lib/dashboard-client-context.ts#L12), 45, 77). getCurrentUser có React cache và Redis ([user-actions.ts:88](../src/services/user-actions.ts#L88), 102). Gọi helper nhiều lần trong source không đồng nghĩa cùng số request auth vật lý. Tuy nhiên auth.getUser nằm trước lookup Redis trong getCurrentUser, nên Redis profile hit không có nghĩa toàn bộ bước xác thực được bỏ.

### 5. Dashboard chờ nhóm dữ liệu lớn; realtime có thể kéo theo nhiều lượt đọc lại

Primary data dùng Promise.all(stats, upcoming sessions, inventory) ở [dashboard-actions.ts:981](../src/core/services/analytics/dashboard-actions.ts#L981); spinner chỉ tắt sau bundle tại [dashboard/page.tsx:198](../src/app/dashboard/page.tsx#L198). Promise.all chạy song song nhưng kết quả UI vẫn phải chờ nhánh chậm nhất.

- Stats có 6 select/count và hai leaderboard lookup/RPC khi cache miss: [dashboard-actions.ts:238](../src/core/services/analytics/dashboard-actions.ts#L238).
- Inventory summary lấy các dòng inventory của tenant rồi filter/reduce tại Node: [499](../src/core/services/analytics/dashboard-actions.ts#L499). Chi phí phụ thuộc số dòng; chưa đo cardinality.
- Secondary analytics bắt đầu sau 200ms, không đợi primary xong: [dashboard/page.tsx:265](../src/app/dashboard/page.tsx#L265). Monthly performance đọc revenue/expenses/customers của 6 tháng và có 6 leaderboard cache/RPC khi miss: [dashboard-actions.ts:599](../src/core/services/analytics/dashboard-actions.ts#L599).
- Realtime session_logs/bookings/revenue/session_reviews debounce 500ms rồi refresh cả primary và secondary: [dashboard/page.tsx:276](../src/app/dashboard/page.tsx#L276), 299.
- Notification Bell có đường refresh riêng; dashboard secondary gọi getImportantAlerts trực tiếp, không qua cache cục bộ của Bell: [AdminNotificationBell.tsx:34](../src/components/common/AdminNotificationBell.tsx#L34), 113, 152; [dashboard-actions.ts:997](../src/core/services/analytics/dashboard-actions.ts#L997).

**Hệ quả:** lần ghi đã xong vẫn có thể kéo theo hoạt động loading/network ở nhiều widget. Đây là chi phí đọc sau thay đổi, cần tách khỏi thời gian commit khi đo.

**Phản chứng:** Bell đã có cache 15 giây và in-flight dedup; không kết luận hai Bell chắc chắn gửi hai request. Primary/secondary đã tách progressive; upcoming sessions/alerts có limit; leaderboard có Redis; một số modal đã lazy-load. React Query provider có cache nhưng dashboard server-action/useState flow không tự động hưởng cache của React Query.

### 6. Trang gói dịch vụ và lịch có lượt tải dữ liệu phụ rộng

**Trang gói dịch vụ:** [useServicesPageState.ts:440](../src/app/dashboard/services/hooks/useServicesPageState.ts#L440) khởi packages, inventory catalog và module config song song. Danh mục kho đã được tải trước khi mở form chỉnh sửa ([372](../src/app/dashboard/services/hooks/useServicesPageState.ts#L372)). getPackages và getInventoryItems dùng select toàn bộ cột, không phân trang ở tầng ứng dụng: [package-actions.ts:240](../src/services/package-actions.ts#L240), [inventory-actions.ts:176](../src/services/inventory-actions.ts#L176). Số dòng/payload có thể tăng theo dữ liệu tenant; vẫn có thể chịu giới hạn mặc định phía server, nên không khẳng định nhận vô hạn dòng.

**Phản chứng:** spinner packages chỉ chờ getPackages, không chờ toàn inventory. Vật tư của từng gói chỉ lazy-load khi mở editor ở dòng 499, không phải mọi định mức của mọi gói đều tải từ đầu. Beauty Spa tải tài nguyên sau khi có module config; Babycare bỏ qua nhánh đó.

**Trang lịch:** calendar tải ngay, bookings/users/resources bắt đầu sau 200ms tại [useBookingsPageData.ts:139](../src/app/dashboard/bookings/hooks/useBookingsPageData.ts#L139). Calendar có date bounds theo tháng hiển thị ([session-query-actions.ts:261](../src/core/services/order/session-query-actions.ts#L261)), nhưng projection gồm session_logs *, bookings * và nhiều joins ([225](../src/core/services/order/session-query-actions.ts#L225)). getBookings phụ tải booking + customer/package joins không filter ngày/trạng thái hoặc phân trang ở tầng ứng dụng: [query-actions.ts:48](../src/core/services/order/query-actions.ts#L48).

**Sau lưu:** có explicit background refresh ở [useBookingsPageActions.ts:410](../src/app/dashboard/bookings/hooks/useBookingsPageActions.ts#L410) và refresh do realtime ở [useBookingsPageData.ts:158](../src/app/dashboard/bookings/hooks/useBookingsPageData.ts#L158). Hook calendar không có shared in-flight promise, forced booking reload bỏ qua freshness/in-flight reuse ở [bookings-page-client-cache.ts:21](../src/lib/bookings-page-client-cache.ts#L21). Vì vậy có khả năng đọc trùng sau một lần lưu; cần trace event/request mới kết luận đã trùng trong phiên người dùng.

**Phản chứng:** có cache booking 30 giây, user/resource 5 phút, debounce 400ms và non-forced in-flight reuse. Không có cơ sở kết luận app hoàn toàn không cache.

## Bằng chứng lịch sử và giới hạn

1. [Audit 2026-08-30](../docs/performance/SPA_APPOINTMENT_PERFORMANCE_AUDIT_2026_08_30.md#L30): local Next dev, mock auth. Đo session update khoảng 239–267ms, tenant context 262–482ms. Sau tối ưu alerts còn khoảng 548–550ms ở bookings (dòng 232), và post-commit UI refresh đã được chuyển nền. Không dùng số đo đầu kỳ alerts 712–1.019ms như trạng thái hiện tại; cũng không coi mock conflict check 7–13ms là hiệu năng kiểm tra xung đột thực.
2. [Benchmark 2026-08-15](../load-tests/results/k6-performance-benchmark-v4.md#L85): booking_check P95 480ms tại 100 virtual users, 5.195ms tại 150, 24.202ms tại 200. Đây là bằng chứng lịch sử về rủi ro nghẽn tải, không chứng minh môi trường hiện tại đang ở mức tải đó, và không phải số đo thao tác lưu gói.
3. Repo có index cho session booking, lịch tài nguyên và packages theo tenant/module; không đủ cơ sở quy chung là thiếu index. Ví dụ [20260611130000_add_session_booking_resource.sql:15](../supabase/migrations/20260611130000_add_session_booking_resource.sql#L15) và [20260608110000_create_beauty_spa_phase2_foundation.sql:80](../supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql#L80).
4. Migration audit trigger cho packages/session_logs có thể thêm công việc khi ghi; chưa xác nhận trigger đang deploy và thời gian thực, nên không gọi audit là bottleneck đã chứng minh. Không có bằng chứng để quy save chậm cho toàn bộ materialized-view refresh; nhiều MV refresh theo lịch.

## Những điều chưa thể kết luận

- Không có số đo hiện tại để nói server yếu, Supabase chậm, Redis hỏng, DB thiếu index, mạng người dùng chậm, hoặc cần nâng gói hạ tầng.
- Chưa biết prod/local, commit deploy, số buổi mỗi gói, số người đồng thời, CPU/lock wait, cache hit rate.
- Chưa có browser profile để coi font/chart/animation hoặc bundle lớn là nguyên nhân chính.
- Typecheck chậm là vấn đề compiler; không tự chứng minh app đã deploy chạy chậm.
- Beauty Spa legacy theme có thể phát sinh read/write nâng theme trước khi dashboard mở; Babycare không qua nhánh này. Đây là tình huống có điều kiện, không giải thích chậm thường xuyên toàn hệ thống.

## Bước đo để chốt nguyên nhân, chưa thực hiện

| Luồng | Cần tách thời gian | Phép so sánh hữu ích |
|---|---|---|
| Lưu gói | updatePackage, upsertPackageMaterials, đóng modal, tải lại | Chỉ đổi tên/giá so với đổi vật tư; gói 0 và nhiều dòng vật tư |
| Dời lịch | conflict check, reschedule, updateBooking, updateSessionLog | Cùng điều kiện nhưng 1/5/10 buổi; có và không có tài nguyên |
| Mở màn hình | TTFB/proxy, tenant context, primary data, UI ready | Hard reload và lần mở lại; cùng tenant và vai trò |
| Database | Query time, network time, lock wait, active connections | Đúng timestamp thao tác chậm; EXPLAIN/read-only metadata trên môi trường đó |

Ưu tiên đo **lưu gói chỉ đổi tên/giá** và **dời lịch theo số buổi** vì source đã chỉ ra đường chờ rất cụ thể. Không cần thay nghiệp vụ để thu thập bằng chứng. Chưa triển khai bất kỳ sửa đổi hay thử nghiệm ghi dữ liệu nào trong phiên phân tích này.

## Follow-up 2026-09-08: tình trạng đo đạc hiện có

Tiếp tục phân tích read-only cho thấy repo đã có nền đo hiệu năng, nhưng chưa nằm đúng hai thao tác người dùng đang phản ánh rõ nhất.

### Đã có thể đo

1. Endpoint `/api/bookings/check-ktv-availability` đã có cache telemetry và `Server-Timing` cho redis/db/compute/total. Bằng chứng: [check-ktv-availability/route.ts:117](../src/app/api/bookings/check-ktv-availability/route.ts#L117), [191](../src/app/api/bookings/check-ktv-availability/route.ts#L191), [242](../src/app/api/bookings/check-ktv-availability/route.ts#L242), [271](../src/app/api/bookings/check-ktv-availability/route.ts#L271).
2. K6 v3/v4 đo `customer_read`, `booking_check` và `health`, có ngưỡng P95 và tách Redis/DB cho booking check. Bằng chứng: [24-k6-3v4-post-optimization.js:14](../load-tests/scripts/24-k6-3v4-post-optimization.js#L14), [170](../load-tests/scripts/24-k6-3v4-post-optimization.js#L170), [187](../load-tests/scripts/24-k6-3v4-post-optimization.js#L187), [323](../load-tests/scripts/24-k6-3v4-post-optimization.js#L323).
3. Có một spec Playwright đo cảm nhận người dùng cho appointment flow, gồm `savedSignalMs`, `interactiveMs`, số POST và thời gian POST. Bằng chứng: [15-spa-appointment-performance-measurement.spec.ts:16](../e2e/tests/15-spa-appointment-performance-measurement.spec.ts#L16), [112](../e2e/tests/15-spa-appointment-performance-measurement.spec.ts#L112), [165](../e2e/tests/15-spa-appointment-performance-measurement.spec.ts#L165).

### Chưa đo đúng điểm đau hiện tại

1. Chưa thấy test/benchmark đo thao tác **lưu gói dịch vụ** qua UI, đặc biệt case chỉ đổi tên/giá nhưng vẫn gọi `upsertPackageMaterials`. Search chỉ tìm thấy unit test cho action và E2E appointment, chưa có metric UI cho trang services.
2. Spec appointment hiện tại chỉ chạy local mock auth/service-role và skip nếu không phải local: [15-spa-appointment-performance-measurement.spec.ts:178](../e2e/tests/15-spa-appointment-performance-measurement.spec.ts#L178), [180](../e2e/tests/15-spa-appointment-performance-measurement.spec.ts#L180). Vì vậy nó không chứng minh latency production hiện tại.
3. K6 hiện tại đo `booking_check`, không đo server action `rescheduleSession`, `updateBooking`, `updateSessionLog`, `updatePackage`, `upsertPackageMaterials`. Nó có ích để chẩn đoán capacity/DB saturation, nhưng không đủ để kết luận vì sao một lần bấm Lưu cụ thể bị chậm.
4. Một số script load test dùng tenant/test credential cố định và có thể tạo tải cao. Không nên chạy tự động trên production khi mục tiêu là phân tích không ảnh hưởng vận hành.

### Hàm ý chẩn đoán

Nếu chỉ được chọn một phép đo kế tiếp, nên đo **UI save package** trước, vì source đã chỉ ra một bất thường có xác suất cao: dù chỉ đổi metadata của gói, UI vẫn chờ action vật tư. Phép đo cần tách bốn mốc:

```text
click Save
  -> updatePackage returned
  -> upsertPackageMaterials returned
  -> modal closed / button interactive
  -> background reload finished
```

Nếu phép đo cho thấy `upsertPackageMaterials` chiếm phần lớn thời gian ngay cả khi vật tư không đổi, hướng tối ưu sẽ rất hẹp và ít rủi ro: tránh gọi nhánh vật tư khi dữ liệu vật tư không thay đổi hoặc không liên quan. Nếu `updatePackage` đã chậm trước khi tới vật tư, cần nhìn tiếp audit/auth/DB trace.

Phép đo thứ hai nên là **reschedule theo số buổi còn lại**: cùng một tenant, đo 1 buổi, 5 buổi, 10 buổi; tách có tài nguyên và không có tài nguyên. Nếu latency tăng gần tuyến tính theo số buổi, nguyên nhân chính là vòng lặp await tuần tự trong reschedule. Nếu latency không tăng theo số buổi, cần ưu tiên DB lock/network/action overhead thay vì tối ưu vòng lặp.

### Không chạy trong phiên này

Không chạy k6, không chạy Playwright ghi dữ liệu, không gọi API production, không thay code instrumentation. Lý do: yêu cầu hiện tại là phân tích và báo cáo, và các phép đo có sẵn hoặc tạo dữ liệu test hoặc tạo tải đáng kể; chạy tự động có thể ảnh hưởng môi trường vận hành.

## Follow-up 2026-09-08 #2: chốt trạng thái điều tra

Phân tích hiện tại đủ mạnh để chốt **đã tìm thấy các structural latency candidates có bằng chứng source**, nhưng chưa đủ để chốt **runtime root cause**. Không chuyển từ "source có chuỗi await dài" sang "đây chắc chắn là bottleneck production" khi chưa có measurement đúng thao tác, đúng môi trường, đúng timestamp.

```text
Beauty Spa / Babycare Performance Investigation
───────────────────────────────────────────────

Source-path analysis                 COMPLETE
Structural latency candidates        EVIDENCED

Package save serial write path       HIGH PRIORITY
Reschedule serial N-session path      HIGH PRIORITY
Global bootstrap critical path        HIGH PRIORITY
Post-write read amplification         PLAUSIBLE / NEEDS TRACE
Large tenant data payloads            DATA-DEPENDENT

DB overload                           NOT PROVEN
Missing indexes                       NOT PROVEN
Supabase/server capacity issue        NOT PROVEN
Redis issue                           NOT PROVEN
Network/client issue                  NOT PROVEN

Runtime root cause                    NOT YET CLOSED
Code remediation                      DO NOT START YET
```

Ba vấn đề đáng chú ý là vấn đề hệ thống, không phải các lỗi rời rạc:

1. **Write path quá chatty.** Một thao tác UI nhỏ có thể bị tách thành nhiều server action và nhiều DB round-trip nối tiếp. Lưu package đi qua `updatePackage` rồi `upsertPackageMaterials`; reschedule đi qua từng session và từng guard theo thứ tự. Từng query có thể không chậm, nhưng tổng thời gian vẫn dài vì cộng nhiều latency nhỏ.
2. **Read path có nhiều blocking boundaries.** Proxy, auth, role, tenant context, dashboard layout và page data tạo critical path dài cho cold/hard reload. Cache giúp warm path nhưng không xóa critical path ban đầu.
3. **Sau write có khả năng read amplification.** Explicit background refresh, realtime refresh và các widget có refresh riêng có thể làm DB/network bận ngay sau khi commit đã xong. Đây là ứng viên giải thích cảm giác "save xong vẫn ì".

Thứ tự điều tra tiếp theo không nên mở rộng thêm hàng trăm file. Nên đo hai luồng có signal sạch nhất:

1. **Package metadata-only save:** cùng một package, chỉ đổi tên hoặc giá, không đổi materials. Nếu `upsertPackageMaterials` vẫn chiếm đáng kể thời gian, optimization candidate rất hẹp: tránh làm lại domain vật tư khi domain đó không đổi.
2. **Reschedule 1/5/10 sessions:** cùng tenant và điều kiện, đo số buổi còn lại khác nhau; tách có tài nguyên và không có tài nguyên. Nếu latency tăng gần tuyến tính với N, vòng lặp tuần tự là nguyên nhân chính. Nếu không tăng theo N, cần nhìn fixed overhead như auth, transport, lock hoặc DB/network latency.

Không tối ưu bằng cách bỏ audit, tenant validation hoặc conflict guard. Các phần đó thuộc correctness/security boundary. Hướng tối ưu đúng, nếu measurement xác nhận, là giảm round-trip, tránh công việc không thay đổi, batch hóa có kiểm soát, hoặc chuyển việc độc lập khỏi critical path.

Nếu runtime evidence xác nhận pattern "một user intent → nhiều server action nối tiếp → mỗi action tự auth/tenant lookup" xuất hiện ở nhiều module, đây nên được nâng thành một defect class cho Factory/Architecture: interactive critical path không nên có server-action chains hoặc `await` per-row loops không có lý do nghiệp vụ rõ ràng. Điều này chưa phải yêu cầu xây governance mới; trước mắt chỉ là candidate rule sau khi có measurement.

## Canonical checkpoint: Phase 1 closed

```text
CURRENT CANONICAL STATUS
────────────────────────────────────────

Source analysis                         COMPLETE
Structural latency candidates           EVIDENCED
Runtime measurement                     NOT YET PERFORMED

Package metadata-only save              MEASURE FIRST
Reschedule 1/5/10 sessions              MEASURE SECOND
Bootstrap critical path                 MEASURE AFTERWARD
Post-write read amplification           TRACE IF NEEDED

Runtime root cause                      OPEN
Remediation design                      BLOCKED
Code/config/database changes            BLOCKED

Production bottleneck claim             NOT ALLOWED YET
Infrastructure upgrade recommendation   NOT JUSTIFIED
```

**Investigation Phase 1 — Source Structural Analysis: CLOSED.**  
**Investigation Phase 2 — Runtime Measurement: NEXT.**  
**Remediation: BLOCKED until measurement.**

Không cần tiếp tục source archaeology rộng hơn trừ khi phép đo runtime mở ra một nhánh mới. Đọc thêm hàng trăm file ở thời điểm này có nguy cơ tạo thêm giả thuyết mà không tăng độ chắc chắn.

Hai experiment kế tiếp là **root-cause discrimination tests**, không phải benchmark chung.

### TEST A — Package metadata-only save

```text
Hold constant:
tenant
package
materials
user/role

Change:
name or price only

Measure:
click
→ updatePackage return
→ materials action return
→ modal interactive
→ background refresh complete

Question:
Is unrelated materials work materially extending
the interactive critical path?
```

Nếu TEST A xác nhận materials branch chiếm thời gian đáng kể, có thể mở một surgical remediation nhỏ: tránh chạy domain vật tư khi domain đó không đổi, vẫn giữ audit/tenant validation/correctness boundary.

### TEST B — Reschedule scaling

```text
Hold constant:
tenant
booking type
user
environment

Compare:
1 session
5 sessions
10 sessions

Split:
with resource guards
without resource guards

Question:
Does latency scale with affected-session count?
```

Nếu TEST B xác nhận latency gần tuyến tính theo số buổi, khi đó mới đủ bằng chứng để thiết kế batch/transactional reschedule, với conflict safety, tenant isolation và audit provenance giữ nguyên.

Nếu cả hai test không giải thích phần lớn latency, chuyển xuống tầng tiếp theo theo thứ tự:

```text
auth / proxy
→ transport/server action
→ DB query time
→ lock wait
→ connection saturation
→ post-write refresh amplification
```

Candidate defect class được giữ lại, chưa build thành rule/gate:

```text
Interactive user intent bị phân mảnh thành nhiều synchronous backend boundaries
hoặc per-row serial awaits.
```

Chỉ sau khi runtime evidence xác nhận ít nhất một trường hợp thật, mới hợp lý nâng discovery này thành Factory governance/performance guard.
