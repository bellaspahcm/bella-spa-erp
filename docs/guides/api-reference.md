# Bella ERP API Reference

Tai lieu nay mo ta cac API HTTP dang ton tai trong `src/app/api`. Muc tieu la giup doi noi bo, doi tich hop va AI agent hieu dung API nao dang live, API nao chi dung noi bo, cach xac thuc, dau vao dau ra va tac dong du lieu quan trong.

## Nguyen Tac Chung

- API dung cho nguoi dung dang dang nhap se kiem tra phien dang nhap va vai tro truoc khi xu ly.
- API cron va webhook bat buoc dung secret rieng tren server. Neu secret chua cau hinh, API tra loi loi cau hinh server thay vi chay ngam.
- API co tac dong du lieu phai tra loi ro thanh cong hay that bai. Cac loi ghi du lieu quan trong khong duoc nuot im.
- Tai lieu nay chi ghi cac route da co file `route.ts`; khong ghi cac endpoint dang o muc y tuong trong roadmap.

## Bang Tong Hop Endpoint

| Endpoint | Muc dich | Xac thuc | Ghi chu van hanh |
| --- | --- | --- | --- |
| `POST /api/webhooks/payment` | Nhan giao dich ngan hang/VietQR va doi soat booking hoac gia han subscription | `PAYMENT_WEBHOOK_SECRET` qua `Authorization: Bearer ...` hoac gia tri token truc tiep | Co xu ly chong trung giao dich va tao revenue/accounting side effects |
| `POST /api/v1/ai/coo-orchestrator` | Cho admin/ke toan goi AI COO phan tich dieu hanh | Phien dang nhap, vai tro `admin` hoac `accountant` | Tra ve bao cao dieu hanh tu AI COO |
| `POST /api/v1/ai/action-approval` | Tao thong bao phe duyet hanh dong AI de nguoi co quyen xem va quyet dinh | Phien dang nhap, vai tro `admin`, `super_admin`, hoac `accountant` | Tao notification va log; neu log loi thi rollback notification |
| `POST /api/v1/ai/telegram-webhook` | Nhan lenh `/coo` tu Telegram va gui bao cao AI COO ve chat | Tuy chon `TELEGRAM_WEBHOOK_SECRET`; neu cau hinh thi bat buoc header secret hoac bearer | Loi nghiem trong van tra HTTP 200 de tranh Telegram retry lien tuc |
| `GET /api/cron/accounting-worker` | Lay hang doi accounting outbox va tao but toan tu dong | `CRON_SECRET` qua `Authorization: Bearer ...` | Xu ly batch toi da 50 event, co ket qua chi tiet tung event |
| `GET /api/cron/ai-autopilot` | Chay AI autopilot dinh ky, quet canh bao va gui Telegram | `CRON_SECRET` qua `Authorization: Bearer ...` | Quet cac tenant dang active va bao cao partial failure neu co tenant loi |
| `GET /api/cron/zalo-reminders` | Gui nhac lich hen Zalo dinh ky | `CRON_SECRET` qua `Authorization: Bearer ...` hoac query `?secret=...` | Dung cho job scheduler noi bo |
| `GET /api/cron/gate3-monitor` | Giám sát trạng thái hoạt động của hệ thống | `CRON_SECRET` qua `Authorization: Bearer ...` | Job nội bộ kiểm tra tình trạng Gate 3 |
| `GET /api/cron/monitor-replica` | Giám sát tình trạng đồng bộ bản sao cơ sở dữ liệu | `CRON_SECRET` qua `Authorization: Bearer ...` | Kiểm tra độ trễ replica |
| `GET /api/cron/sync-external-ads` | Đồng bộ dữ liệu quảng cáo từ các nền tảng ngoài | `CRON_SECRET` qua `Authorization: Bearer ...` | Lấy báo cáo chi phí quảng cáo tự động |
| `POST /api/cron/sync-external-ads` | Kích hoạt đồng bộ dữ liệu quảng cáo thủ công | `CRON_SECRET` qua `Authorization: Bearer ...` | Hỗ trợ đẩy payload đồng bộ trực tiếp |
| `GET /api/test-upcoming` | Kiem tra nhanh lich sap toi cua KTV trong moi truong dev/test | Local-only neu khong co secret; remote can `TEST_UPCOMING_SECRET` hoac `CRON_SECRET` | Production tra 404 |
| `GET /api/v1/orders` | Danh sách đơn hàng (hỗ trợ phân trang, lọc và sandbox mode) | API key authentication (pk_test_... hoặc pk_live_...) | Tự động phân tách schema dữ liệu thật và sandbox dựa trên API key |
| `POST /api/v1/orders` | Tạo mới đơn hàng (hỗ trợ sandbox mode) | API key authentication (pk_test_... hoặc pk_live_...) | Ghi đè tự động schema sandbox.orders nếu dùng key test |

## Chi Tiet Endpoint

### `POST /api/webhooks/payment`

Dung de nhan payload giao dich tu cac nen tang thanh toan/ngan hang nhu Casso, SePay, PayOS hoac danh sach giao dich truc tiep.

Xac thuc:

- Bien moi truong bat buoc: `PAYMENT_WEBHOOK_SECRET`.
- Header hop le: `Authorization: Bearer <PAYMENT_WEBHOOK_SECRET>` hoac `Authorization: <PAYMENT_WEBHOOK_SECRET>`.

Dau vao chinh:

- Payload co the la mot giao dich, `data` cua mot giao dich, mang giao dich, hoac object co danh sach giao dich.
- Moi giao dich can co ma giao dich, so tien, noi dung chuyen khoan va ngay nhan neu nha cung cap gui kem.
- Noi dung chuyen khoan co mau booking `BELLA...` se duoc doi soat booking.
- Noi dung chuyen khoan co mau subscription `SUB...` se goi gia han subscription.

Tra loi thanh cong:

- Khong co giao dich hop le: `{ "success": true, "message": "No valid transactions found in payload" }`.
- Co xu ly: `{ "success": true, "processedCount": number, "details": [...] }`.

Loi quan trong:

- `500` neu thieu secret thanh toan hoac thieu thong tin server can de ghi du lieu.
- `401` neu token sai.
- `500` neu loi he thong ngoai le.

Tac dong du lieu:

- Booking thanh cong se duoc cap nhat trang thai thanh da xac nhan.
- Tao revenue tu giao dich thanh toan va accounting side effects lien quan.
- Co kiem tra trung giao dich bang metadata va ghi chu cu de tranh ghi doanh thu hai lan.

### `POST /api/v1/ai/coo-orchestrator`

Dung cho Tong giam doc hoac Ke toan truong goi AI COO phan tich tinh hinh van hanh.

Xac thuc:

- Bat buoc dang nhap.
- Nguoi dung phai thuoc tenant hop le.
- Vai tro hop le: `admin`, `accountant`.

Body:

| Truong | Bat buoc | Mo ta |
| --- | --- | --- |
| `command` | Co | Cau lenh phan tich gui cho AI COO |
| `monthYear` | Khong | Thang can phan tich neu co |

Tra loi:

- Thanh cong: tra ve bao cao dieu hanh do AI COO tao.
- `401` neu chua dang nhap.
- `403` neu khong co ho so nguoi dung, khong thuoc tenant hop le, hoac sai vai tro.
- `400` neu thieu `command`.
- `500` neu loi nghiem trong khi xu ly.

### `POST /api/v1/ai/action-approval`

Dung de luu mot hanh dong AI dang de xuat thanh notification cho nguoi co quyen phe duyet.

Xac thuc:

- Bat buoc dang nhap.
- Vai tro hop le: `admin`, `super_admin`, `accountant`.

Body:

| Truong | Bat buoc | Mo ta |
| --- | --- | --- |
| `type` | Co | Loai hanh dong AI de xuat |
| `recipient` | Co | Nguoi/nhom nhan de xuat |
| `reason` | Co | Ly do AI de xuat |
| `draftMessage` | Co | Noi dung nhap de nguoi co quyen duyet |

Tra loi thanh cong:

- `{ "success": true, "message": "...", "notificationId": "..." }`.

Tac dong du lieu:

- Tao ban ghi notification.
- Tao log AI agent de phuc vu audit.
- Neu tao log that bai, route xoa notification vua tao va tra loi loi thay vi bao thanh cong gia.

### `POST /api/v1/ai/telegram-webhook`

Nhan update tu Telegram. Chi lenh bat dau bang `/coo` moi duoc xu ly.

Xac thuc:

- Neu `TELEGRAM_WEBHOOK_SECRET` duoc cau hinh, request phai co mot trong hai cach:
  - Header `x-telegram-webhook-secret`.
  - Header `Authorization: Bearer <TELEGRAM_WEBHOOK_SECRET>`.
- Neu secret khong cau hinh, route van nhan webhook. Nen cau hinh secret trong moi truong that.

Body chinh:

- Payload Telegram co `message.text` va `message.chat.id`.

Tra loi:

- `{ "ok": true, "status": "success" }` khi xu ly thanh cong.
- `{ "ok": true, "status": "ignored" }` neu payload khong co message/chat/text.
- `{ "ok": true, "status": "ignored_no_prefix" }` neu khong phai lenh `/coo`.
- `{ "ok": true, "status": "ignored_empty_command" }` neu lenh rong.
- `{ "ok": true, "status": "no_active_config" }` neu chat chua cau hinh AI active.
- `{ "ok": false, "status": "no_admin_user" }` neu tenant khong co user dai dien phu hop.
- `401` neu secret sai.
- Loi nghiem trong tra HTTP 200 voi `{ "ok": false, "error": "..." }` de Telegram khong retry lien tuc.

Tac dong du lieu:

- Thiet lap tenant context theo cau hinh Telegram.
- Goi AI COO.
- Gui tin nhan phan hoi ve Telegram neu co bot token.

### `GET /api/cron/accounting-worker`

Job noi bo de xu ly hang doi accounting outbox va tao but toan tu dong.

Xac thuc:

- Bien moi truong bat buoc: `CRON_SECRET`.
- Header bat buoc: `Authorization: Bearer <CRON_SECRET>`.

Xu ly:

- Claim toi da 50 event dang cho xu ly.
- Ho tro cac loai event: `PACKAGE_SALE`, `SESSION_DONE`, `EXPENSE_RECORDED`, `SALARY_PAID`, `INVENTORY_CONSUMED`, `REFUND_ISSUED`, `MANUAL_ENTRY`.
- Kiem tra but toan da ton tai de tranh ghi trung.
- Event `SESSION_DONE` cu/khong con hop le duoc chuyen sang dead letter.

Tra loi:

- Khong co event: `{ "success": true, "processed": 0 }`.
- Co event: `{ "success": boolean, "status": "success" | "partial_failure" | "critical_failure", "processed": number, "successCount": number, "deadLetterCount": number, "failureCount": number, "criticalFailureCount": number, "details": [...] }`.
- `401` neu token sai.
- `500` neu thieu secret, claim batch loi, hoac loi toan cuc.

### `GET /api/cron/ai-autopilot`

Job noi bo de quet canh bao van hanh theo tenant va gui Telegram neu can.

Xac thuc:

- Bien moi truong bat buoc: `CRON_SECRET`.
- Header bat buoc: `Authorization: Bearer <CRON_SECRET>`.

Tra loi:

- `{ "success": boolean, "status": "success" | "partial_failure", "date": "...", "tenants_checked": number, "alerts_sent": number, "alerts_failed": number, "tenant_errors": [...] }`.
- `tenant_errors` chi co khi mot hoac nhieu tenant loi.
- `401` neu token sai.
- `500` neu thieu secret hoac loi toan cuc.

### `GET /api/cron/zalo-reminders`

Job noi bo de gui nhac lich hen Zalo.

Xac thuc:

- Bien moi truong bat buoc: `CRON_SECRET`.
- Chap nhan `Authorization: Bearer <CRON_SECRET>` hoac query `?secret=<CRON_SECRET>`.

Tra loi:

- Thanh cong: `{ "success": true, "timestamp": "...", ... }` kem ket qua tu service gui reminder.
- `401` neu token sai.
- `500` neu thieu secret, service tra loi loi, hoac loi toan cuc.

### `GET /api/test-upcoming`

Endpoint chan doan nhanh lich sap toi cua KTV.

Pham vi:

- Chi dung cho dev/test.
- Trong production luon tra `404` voi `{ "error": "Not found." }`.
- Ngoai production, request local tu `localhost`, `127.0.0.1` hoac `::1` duoc phep chay khong can secret.
- Request khong phai local phai gui `TEST_UPCOMING_SECRET` hoac fallback `CRON_SECRET` qua `Authorization: Bearer ...` hoac query `?secret=...`.

Tra loi ngoai production:

- Thanh cong: `{ "success": true, "count": number, "sessions": [...] }`.
- `403` neu khong phai local va token sai/thieu.
- `500` neu service lay lich loi.

### `GET /api/v1/orders`

Dùng để lấy danh sách đơn hàng của đối tác liên kết với tenant.

Xác thực:

- Sử dụng API Key của đối tác thông qua header `Authorization: Bearer <API_KEY>`.
- Khóa bắt đầu bằng `pk_test_` sẽ tự động kích hoạt chế độ Sandbox (chỉ truy vấn dữ liệu từ schema `sandbox.orders`).
- Khóa bắt đầu bằng `pk_live_` sẽ truy vấn dữ liệu thực tế (`public.orders`).
- Yêu cầu scope: `order:read`.

Tham số truy vấn (Query parameters):

| Trường | Bắt buộc | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `page` | Không | 1 | Số trang kết quả |
| `per_page` | Không | 20 | Số kết quả trên một trang |
| `status` | Không | - | Lọc theo trạng thái đơn hàng (e.g. pending, completed) |
| `customer_id` | Không | - | Lọc theo mã khách hàng |
| `from_date` | Không | - | Lọc đơn tạo từ ngày (YYYY-MM-DD) |
| `to_date` | Không | - | Lọc đơn tạo đến ngày (YYYY-MM-DD) |
| `search` | Không | - | Tìm kiếm từ khóa trong phần ghi chú (`notes`) |

Trả lời:

- Thành công (200): Phân trang chuẩn với metadata về trang và danh sách đơn hàng. Response headers chứa `X-Environment` và `X-Sandbox-Mode`.
- `401` nếu thiếu hoặc sai API Key.
- `403` nếu API Key thiếu scope `order:read`.
- `500` nếu lỗi hệ thống.

### `POST /api/v1/orders`

Dùng để tạo mới đơn hàng.

Xác thực:

- Sử dụng API Key đối tác qua header `Authorization: Bearer <API_KEY>`.
- Hỗ trợ chế độ Sandbox nếu dùng key test (`pk_test_...`).
- Yêu cầu scope: `order:write`.

Dữ liệu đầu vào (Body JSON):

| Trường | Bắt buộc | Loại | Mô tả |
| --- | --- | --- | --- |
| `customer_id` | Có | string | Mã khách hàng (UUID) |
| `items` | Có | array | Danh sách các mặt hàng / gói dịch vụ trong đơn |
| `notes` | Không | string | Ghi chú đơn hàng |
| `scheduled_date` | Không | string | Ngày hẹn làm dịch vụ (YYYY-MM-DD) |

Trả lời:

- Thành công (201): Trả về thông tin đơn hàng vừa tạo, kèm header `Location` trỏ đến endpoint chi tiết của đơn hàng.
- `400` nếu thiếu trường bắt buộc hoặc dữ liệu sai định dạng.
- `401` nếu thiếu hoặc sai API Key.
- `403` nếu thiếu scope `order:write`.
- `500` nếu lỗi hệ thống.

### `GET /api/cron/gate3-monitor`

Job định kỳ để giám sát hiệu suất và trạng thái của Gate 3.

Xác thực:

- `CRON_SECRET` qua `Authorization: Bearer <CRON_SECRET>`.

Trả lời:

- Thành công (200): Trả về thông tin trạng thái kiểm tra.
- `401` nếu sai token.

### `GET /api/cron/monitor-replica`

Job định kỳ kiểm tra tình trạng đồng bộ dữ liệu của replica database.

Xác thực:

- `CRON_SECRET` qua `Authorization: Bearer <CRON_SECRET>`.

Trả lời:

- Thành công (200): Trả về độ trễ đồng bộ (lag).
- `401` nếu sai token.

### `GET /api/cron/sync-external-ads`

Job định kỳ tự động đồng bộ chiến dịch quảng cáo.

Xác thực:

- `CRON_SECRET` qua `Authorization: Bearer <CRON_SECRET>`.

Trả lời:

- Thành công (200): Trả về số lượng chiến dịch được đồng bộ.
- `401` nếu sai token.

### `POST /api/cron/sync-external-ads`

Endpoint để kích hoạt đồng bộ quảng cáo thủ công hoặc nhận webhook từ nền tảng quảng cáo.

Xác thực:

- `CRON_SECRET` qua `Authorization: Bearer <CRON_SECRET>`.

Trả lời:

- Thành công (200): Kết quả đồng bộ chi tiết.
- `401` nếu sai token.
