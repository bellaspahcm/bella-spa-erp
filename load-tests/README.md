# Bella Spa ERP — Load Testing Suite (k6)

Bộ load test với [Grafana k6](https://k6.io) — verify hệ thống Bella chịu được tải thực tế của một spa chuỗi: cao điểm sáng 8h, 50 nhân viên online cùng lúc, stress booking đồng thời, soak test phát hiện memory leak.

## Cấu trúc

```
load-tests/
├── config/
│   ├── env.js              # Biến môi trường (BASE_URL, SUPABASE_*, ADMIN_*)
│   └── thresholds.js       # SLO chuẩn (base / strict / relaxed)
├── helpers/
│   ├── auth.js             # loginViaApi(), authHeaders(), serviceHeaders()
│   └── data.js             # getHqTenantId, getAnyKtv, randomVnPhone...
├── scripts/
│   ├── 01-smoke.js              # 1 VU, 30s — kiểm tra môi trường
│   ├── 02-dashboard-load.js     # Ramp 0→50 VU, 5 phút — tải thực
│   ├── 03-booking-stress.js     # 50 VU concurrent INSERT booking
│   ├── 04-login-spike.js        # 5→100 VU đột biến (auth burst)
│   └── 05-checkout-soak.js      # 10 VU × 30 phút (memory leak detection)
└── results/                # Output JSON / HTML reports (gitignored)
```

## 1. Cài k6

k6 là Go binary — **KHÔNG phải npm package**. Cài 1 trong các cách:

### Windows (chọn 1)

```powershell
# Cách 1: winget (Windows 10/11) — khuyên dùng
winget install k6 --source winget

# Cách 2: Chocolatey
choco install k6

# Cách 3: Download trực tiếp
# https://github.com/grafana/k6/releases — tải file .msi
```

### macOS
```bash
brew install k6
```

### Linux
```bash
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

### Docker (không cần cài)
```bash
docker run -i grafana/k6 run - < load-tests/scripts/01-smoke.js
```

Verify đã cài:
```bash
k6 version
# Expect: k6 v0.50+
```

## 2. Cấu hình môi trường

Tạo `.env.local` (nếu chưa có) với:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # CẦN cho stress + soak tests
```

Sau đó export ra shell trước khi chạy k6:

### Windows PowerShell
```powershell
$env:BASE_URL="http://localhost:3000"
$env:SUPABASE_URL="https://xxxxx.supabase.co"
$env:SUPABASE_ANON_KEY="eyJ..."
$env:SUPABASE_SERVICE_KEY="eyJ..."
$env:ADMIN_EMAIL="admin@bellaspa.com.vn"
$env:ADMIN_PASSWORD="password123"

npm run load:smoke
```

### Bash / Git Bash
```bash
export BASE_URL=http://localhost:3000
export SUPABASE_URL=https://xxxxx.supabase.co
export SUPABASE_ANON_KEY=eyJ...
export SUPABASE_SERVICE_KEY=eyJ...
export ADMIN_EMAIL=admin@bellaspa.com.vn
export ADMIN_PASSWORD=password123

npm run load:smoke
```

### Truyền trực tiếp qua flag `-e`
```bash
k6 run -e BASE_URL=http://localhost:3000 \
       -e SUPABASE_URL=https://xxxxx.supabase.co \
       -e SUPABASE_ANON_KEY=eyJ... \
       load-tests/scripts/01-smoke.js
```

## 3. Chạy tests

```bash
# Smoke: 30s, 1 VU — chạy ĐẦU TIÊN để verify môi trường
npm run load:smoke

# Load: 5 phút, 50 VU steady — mô phỏng tải bình thường
npm run load:dashboard

# Stress: 2 phút, 50 VU concurrent INSERT — phá race condition
npm run load:stress

# Spike: 100 VU đột biến login — verify rate limit + auth
npm run load:spike

# Soak: 30 phút (dài) — phát hiện memory leak
npm run load:soak

# Soak nhanh 5 phút (dev)
npm run load:soak:short

# Smoke với JSON output để xử lý sau
npm run load:report
```

## 4. Đọc kết quả

k6 in real-time vào terminal:

```
     ✓ login status 200
     ✓ rest customers 200

     checks.........................: 100.00% ✓ 60      ✗ 0
     http_req_duration..............: avg=125ms min=45ms med=110ms max=320ms p(90)=185ms p(95)=220ms
     http_req_failed................: 0.00%   ✓ 0       ✗ 30
     iterations.....................: 30      0.99/s
     vus............................: 1       min=1   max=1
```

### Output JSON cho dashboard
```bash
k6 run --out json=load-tests/results/dashboard-load.json load-tests/scripts/02-dashboard-load.js

# Sau đó xử lý JSON:
cat load-tests/results/dashboard-load.json | jq '.metric=="http_req_duration"'
```

### Output cho Grafana / InfluxDB
```bash
k6 run --out influxdb=http://localhost:8086/k6 load-tests/scripts/02-dashboard-load.js
```

## 5. Hiểu các loại test

| Loại | Mục đích | Stages tiêu biểu |
|---|---|---|
| **Smoke** | Verify app hoạt động trước khi load thật | 1 VU × 30s |
| **Load** | Mô phỏng tải bình thường | Ramp lên steady state |
| **Stress** | Tìm breaking point | Đẩy quá normal load |
| **Spike** | Verify đột biến traffic | Burst nhanh rồi recover |
| **Soak** | Memory leak, slow degradation | Steady kéo dài 30m+ |

## 6. SLO mặc định (`config/thresholds.js`)

```js
BASE_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],   // 95% < 500ms, 99% < 1s
  http_req_failed:   ['rate<0.01'],                  // < 1% lỗi
  checks:            ['rate>0.99'],                  // > 99% check pass
};
```

Nếu test fail threshold → k6 exit code != 0 → CI fail.

## 7. Pre-flight checklist

Trước khi chạy production load test:

- [ ] **Smoke pass** (`npm run load:smoke` exit 0)
- [ ] **Database staging** (KHÔNG dùng production DB)
- [ ] **Supabase project có credits/budget** — load test có thể dùng nhiều quota
- [ ] **Đã backup** trước khi chạy stress (script tự cleanup nhưng phòng hờ)
- [ ] **Dev server đang chạy** (`npm run dev`) nếu test Next.js routes
- [ ] **Disable Sentry** trong staging — tránh spam alerts trong load test
- [ ] **Rate limit Supabase**: gói Free có giới hạn ~500 req/min — gói Pro mới đủ cho stress test

## 8. Troubleshooting

**`k6: command not found`** → cài k6 (xem mục 1)

**`Setup login failed`** → check `ADMIN_EMAIL` + `ADMIN_PASSWORD` đúng; verify user đó tồn tại và password đúng

**`Cần SUPABASE_SERVICE_KEY`** → stress + soak cần service role; chỉ load + smoke có thể chạy chỉ với anon key

**Threshold `p(95)<500` fail** → app đang chậm hơn SLO. Check:
- Dev server có warmup chưa (request đầu tiên hay chậm)
- Supabase tier có đủ resource không
- Có process khác đang ăn CPU/RAM không

**Stress test sinh nhiều bookings không cleanup** → teardown chỉ chạy nếu test không bị Ctrl+C. Chạy tay:
```sql
DELETE FROM bookings WHERE booking_number LIKE 'LOAD-%';
DELETE FROM customers WHERE name_mother LIKE 'Load Test %';
```

**`ECONNREFUSED localhost:3000`** → dev server không chạy. Bật `npm run dev` ở terminal khác.

**Soak test out-of-memory** → giảm VU hoặc kéo `SOAK_MINUTES` ngắn lại

## 9. Khi nào CHẠY load test

| Tình huống | Khuyến nghị |
|---|---|
| Trước release lớn | Smoke + Load + Spike |
| Sau thay đổi DB schema | Smoke + Dashboard |
| Trước Black Friday / KM lớn | Stress + Spike |
| Hàng tháng (regression) | Soak (30 phút) |
| Sau optimize query | Trước & sau, so sánh baseline |

## 10. CI/CD integration

Thêm vào GitHub Actions:

```yaml
- name: k6 smoke test
  uses: grafana/k6-action@v0.3.1
  with:
    filename: load-tests/scripts/01-smoke.js
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
    ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
```

Smoke pass = OK merge. Load/stress/soak chạy hàng đêm hoặc cuối tuần.
