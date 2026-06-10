# Industry Module Development Playbook

> Cap nhat lan dau: 2026-06-10  
> Ly do tao: Luu lai bai hoc tu qua trinh tach va trien khai phan he Beauty Spa, de cac nganh moi sau nay khong lap lai loi module, tenant, UI, demo data, accounting va quy trinh kiem thu.

## Quy Tac Bat Buoc

Moi phan he nganh moi phai duoc phat trien theo vong doi trong tai lieu nay. Khong duoc chi them giao dien hoac them bang du lieu rieng le ma chua lam ro:

- tenant nao duoc dung module do
- HQ co cap module hay khong
- user cua module moi co duoc thay doi module hay khong
- bang du lieu nao dung chung core, bang nao la rieng cua nganh
- moi query/runtime action co filter tenant/module dung chua
- webhook/worker/sync co chong trung lap khi retry khong
- action nhieu buoc co transaction hoac rollback/fail-closed khong
- nghiep vu tai chinh co di qua accounting outbox thay vi ghi thang so cai khong
- token/API key tich hop co tach theo tenant va khong bi nuot loi khong
- UI co con hard-code thuat ngu cua nganh cu khong
- demo data co tao/xoa an toan khong
- co regression test de chung minh Bella Spa hien tai khong bi anh huong khong

Neu mot thay doi tao them nganh moi ma khong cap nhat playbook nay hoac artifact lien quan, task chua duoc xem la hoan tat.

## Nguyen Tac Kinh Doanh Da Rut Ra Tu Beauty Spa

Beauty Spa khong phai la mot giao dien phu cua Bella Spa. Day la mot hoat dong thuong mai doc lap, su dung chung mot so loi ERP, nhung du lieu, thuong hieu, user, goi dich vu va van hanh phai tach biet.

Quyet dinh chinh:

- Admin HQ la ben duy nhat duoc khoi tao hoac cap module Beauty Spa.
- Admin Beauty Spa khong duoc tu bat/tat hoac chuyen sang Babycare.
- Beauty tenant khong duoc fallback ve Bella Spa khi chua load xong cau hinh.
- Bella Spa admin khong duoc nhin du lieu Beauty Spa.
- Beauty Spa admin khong duoc nhin du lieu Bella Spa.
- Core duoc tai su dung, nhung ngon ngu hien thi va quy trinh nganh phai theo module.
- Branding cua Beauty Spa phai doc tu tenant/brand config cua chinh spa do, khong hard-code Bella Spa.
- Module key la quyen kinh doanh do HQ cap, khong phai feature flag ky thuat de tenant admin tu bat/tat.

## Lich Su Beauty Spa: Qua Trinh, Loi, Cach Sua

Bang nay la nhat ky bai hoc thuc te. Khi lam nganh moi, bat buoc doi chieu tung nhom loi.

| Nhom | Loi da gap | Nguyen nhan | Cach sua/guard can giu |
| --- | --- | --- | --- |
| Module setup | Beauty Spa bi xem nhu tuy chon co the bat/tat | Thiet ke ban dau gan voi module toggle thay vi quy trinh thuong mai HQ cap | HQ-only setup, Beauty admin khong duoc doi module nganh |
| Tenant isolation | Dang nhap Admin Bella Spa van thay khach/demo Beauty | Query/UI read model co diem thieu scope tenant hoac demo data chua tach sach | Moi action doc du lieu phai filter `tenant_id`; them guard test session/dashboard/customer/finance |
| Client direct query | Booking modal/list picker hien KTV/khach Beauty trong tai khoan Bella | UI query truc tiep tu browser vao `users`/`customers` thay vi qua server action tenant-scoped | Khong query client voi bang tenant-sensitive; dung server action co current tenant; them source guard |
| Module isolation | Beauty tenant van hien text Me & Be, KTV, Combo Me Be | UI copy va filter bi hard-code theo Babycare | Dung module-aware copy, service category theo module, khong render babycare UI khi tenant chua load module |
| Loading fallback | F5 hien Bella Spa mot luc roi moi chuyen Beauty Spa | Fallback mac dinh ve Bella/Babycare truoc khi tenant brand/module load xong | Non-Bella tenant khong fallback Bella; dung loading/neutral state den khi co tenant context |
| First-paint theme flash | F5 Beauty Spa hien lop hong truoc khi chuyen sang Jade/Beauty | CSS root/meta theme-color mac dinh Bella truoc khi client xac dinh tenant | App shell phai bootstrap neutral/tenant-scoped truoc paint; session runtime cache chi duoc ghi sau khi tenant da xac thuc |
| Brand isolation | Sidebar/header/portal co nguy co dung logo/mau Bella | Branding doc tu default chung hoac cache khong gan tenant | Cache brand phai kem `tenantId`; fallback Beauty trung tinh, khong fallback Bella |
| Visual theme leakage | Giao dien rieng cua Beauty co nguy co doi mau/layout Bella ERP | CSS/class rieng cua nganh moi viet global, khong scope theo module marker | Moi theme UI rieng phai nam sau `html[data-tenant-module="..."]`; them source guard khoa selector khong duoc unscoped |
| CTA/badge contrast | Nut chinh hoac badge quan trong bi mo/gan nhu mat chu | Selector theme qua rong match ca class mau dam, hoac dung animation giam opacity nhu `animate-pulse` | CTA/badge nghiep vu phai co class rieng theo module, mau nen/chu dat contrast ro; neu can nhap nhay thi dung glow/brightness, khong giam opacity |
| Package/service scope | Goi dich vu Beauty va Babycare co nguy co dung lan | `packages` la bang dung chung, ban dau thieu module guard | `packages.module_key`, `validateBookingPackageScope`, test cross-module/cross-tenant |
| Data vocabulary | Form khach Beauty con truong "Ho ten me", "Ho ten be", lich co "Combo Me Be" | Dung lai giao dien cu chua audit toan bo text | Truoc khi release module moi phai `rg` toan bo thuat ngu nganh cu va map sang dictionary module |
| Hidden onboarding copy | Beauty admin van thay tour/huong dan "Bat dau cung Bella Spa" sau khi F5 | Chi audit cac trang chinh, bo sot onboarding/help/empty-state copy an | Moi module moi phai audit ca onboarding tour, tooltip, empty state, help text va first-run modal; copy phai nhan brand/module context |
| Demo tenant | Can tao demo Beauty de test nhung phai xoa sach | Demo seed ban dau chua co marker/cleanup chuan | Demo data phai co `DEMO_MARKER`, fixed ids/email, cleanup requires `--confirm`, khong delete bang filter rong |
| Accounting demo | Posting finance demo loi do thieu ma tai khoan 111/5111/6421... | Tenant demo chua seed chart of accounts | Demo script phai goi `seed_default_coa` va verify accounts truoc khi tao journal/revenue |
| RLS/grants | Permission denied khi doc/xoa bang moi hoac bang token | Migration tao bang nhung chua grant/RLS policy du cho role thuc te | Moi bang moi phai co RLS, grant, policy va test permission/grant |
| Review/session FK | Tao review cho buoi cham soc bi FK reviewer_id | Reviewer/user id khong hop le hoac khong thuoc bang user ky vong | Action phai resolve reviewer hop le, neu khong co thi fail ro rang, khong insert review mo ho |
| UI mobile | Bang, filter ngay, dropdown, modal bi tran/cat noi dung | Tai su dung layout desktop hoac native select khong dong bo | Mobile-first visual smoke; table scroll trong box; dropdown dung component chung |
| Finance leakage | Bao cao tai chinh Bella hien giao dich Beauty demo | Revenue/expenses demo hoac query finance thieu scope module/tenant | Finance read model bat buoc filter tenant; demo data repair; regression test |
| Test blind spot | Co loi UI/data da sua thu cong nhung chua co guard | Test chua khoa dung invariant moi | Sau moi loi production/UI, them test guard nho nhat co the |
| Retry duplicate | Webhook/cron/worker chay lai co nguy co nhan doi doanh thu/chi phi/but toan | Luong nhan event ngoai he thong thieu idempotency key hoac unique guard | Moi webhook/worker/sync phai co idempotency guard va test retry 2 lan |
| Partial side effects | Action nhieu buoc loi giua chung nhung trang thai da bi cap nhat mot phan | Thieu transaction, snapshot rollback, hoac fail-closed contract | Multi-step write phai atomic hoac rollback ve snapshot khi bat ky buoc nao loi |
| Direct ledger writes | Module nganh moi tu ghi `journal_entries`/`journal_lines` | Bo qua accounting outbox va worker TT133 | Phat sinh tai chinh phai day event qua accounting outbox, khong ghi so cai truc tiep; guard bang `src/__tests__/accounting-ledger-boundary.test.ts` |
| Token silent failure | Token Zalo/Meta/Telegram/CRM loi nhung UI/action van coi nhu rong/null | Credential refresh/lookup nuot loi hoac fallback gia | Token tich hop phai tenant-scoped, encrypted/hidden va loi phai bao ro |

## Vong Doi Bat Buoc Cho Mot Phan He Nganh Moi

### Phase 0 - Discovery Va Ranh Gioi

Truoc khi code:

- Xac dinh module key, vi du `beauty_spa`, `cleaning`, `clinic`, `academy`.
- Ghi ro day la nganh doc lap hay la add-on cua nganh hien tai.
- Ghi ro ai duoc cap module: HQ, super admin, hay tenant admin.
- Lap bang thuat ngu: khach hang goi la gi, nhan vien goi la gi, dich vu/goi/buoi/tai san goi la gi.
- Tach "core dung chung" va "nganh rieng".
- Quet code bang `rg` de tim hard-code cua nganh cu: `Me`, `Be`, `KTV`, `Bella Spa`, `Combo`, `lieu trinh`, ten goi cu, filter cu.

Ket qua bat buoc:

- Mot spec trong `docs/implementation-artifacts/`.
- Mot danh sach UI copy can module-aware.
- Mot danh sach bang/action co nguy co tenant leakage.

### Phase 1 - Module Registry Va Tenant Contract

Bat buoc dinh nghia:

- `module_key`
- enabled modules default
- tenant nao co module nao
- user role nao duoc thao tac
- fallback khi tenant config chua load
- han che module switching
- feature flags nao chi la rollout ky thuat ben trong module
- token/API keys tich hop nao thuoc tenant nao

Nguyen tac:

- Tenant nganh moi khong duoc mac dinh ve Babycare/Bella.
- Neu module do la san pham thuong mai doc lap, chi HQ duoc cap module.
- Tenant admin cua nganh moi chi quan ly trong tenant cua ho.
- Tenant admin khong duoc tu bat/tat `module_key`; tenant admin chi duoc cau hinh feature/van hanh trong module da duoc HQ cap.
- `module_key` quy dinh nganh doc thuong mai cua tenant; feature flag chi dung cho thu nghiem, rollout tung phan, hoac bat/tat tinh nang nho trong module.
- Moi cache UI lien quan brand/module phai co key theo tenant.
- Token/API key cho Zalo, Meta, Telegram, CRM, Viber hoac kenh tich hop tuong tu phai luu va doc theo tenant. Khong tra token that ra UI; refresh token khong duoc swallow error hoac tra fallback rong khi DB/API loi.

### Phase 2 - Schema, RLS, Grants, Seeds

Khi them bang/cot moi:

- Co `tenant_id` neu la du lieu tenant.
- Co `module_key` neu bang dung chung nhieu nganh.
- Co cot/idempotency key hoac unique constraint cho event co the retry, vi du webhook transaction id, external event id, hoac `(tenant_id, reference_type, reference_id, event_type)`.
- Co RLS policy dung `get_auth_tenant_id()` hoac guard tuong duong.
- Revokes/grants ro cho anon/authenticated/service use case.
- Co unique constraint theo tenant khi can.
- Co migration test doc SQL neu behavior quan trong.
- Co seed/demo script an toan neu can demo.
- Co outbox/event schema neu nghiep vu nganh moi tao doanh thu, hoan tien, chi phi, luong, royalty, clearing hoac but toan ke toan.

Can tranh:

- Tao bang rieng cho moi nganh khi bang core co the mo rong bang `module_key`.
- Dung service-role bypass ma khong filter tenant.
- Insert demo finance/accounting truoc khi seed COA.
- Ghi truc tiep vao `journal_entries` hoac `journal_lines` tu action nghiep vu nganh moi. Chi accounting worker/manual accounting flow duoc ghi so cai theo contract hien co.

### Phase 3 - Service Actions Va Rule Engines

Moi action doc/ghi du lieu phai:

- Lay current user/tenant tu source chuan.
- Fail closed neu thieu tenant.
- Filter `tenant_id` tren moi bang tenant-scoped.
- Validate `module_key` khi dung bang shared.
- Khong swallow database error.
- Khong tao side effect ngoai transaction/rollback pattern.
- Dung engine chung neu da ton tai: payment/booking/revenue/accounting/salary/inventory/session completion.

Quy tac client/data access:

- UI/browser/client component khong duoc query truc tiep cac bang tenant-sensitive nhu `users`, `customers`, `bookings`, `session_logs`, `revenue`, `expenses`, `salary_records`, `attendance`, `inventory_items`, `packages` neu chua co tenant guard ro rang.
- Picker/list UI nhu chon KTV, chon khach hang, chon booking, chon goi dich vu phai di qua server action tenant-scoped.
- Server action dung cho list/read phai tu lay current tenant, fail closed neu thieu tenant, va khong tin `tenant_id` do client gui len.
- Write action, rollback action va cleanup action phai filter `tenant_id` cung voi `id`; khong duoc update/delete chi bang `id`.
- Neu phat hien UI/client direct query gay ro ri tenant, phai them regression test hoac source guard, vi du `tenant-isolation-source-guards.test.ts`, de khoa loi do khong quay lai.

Quy tac idempotency:

- Moi webhook, CRM sync, ad sync, payment callback, cron worker, background worker hoac queue consumer co the retry phai co idempotency guard.
- Phai luu mot ma dinh danh duy nhat cua event, vi du external transaction id, webhook id, job id, hoac `(tenant_id, event_type, reference_type, reference_id)`.
- Truoc khi ghi doanh thu/chi phi/outbox/journal/inventory/salary, phai doc trang thai thuc te va tu choi ghi lap neu event da xu ly.
- Test bat buoc mo phong cung event chay 2 lan va chung minh side effect chi duoc tao 1 lan.

Quy tac rollback/fail-closed:

- Action ghi nhieu bang phai dung transaction/RPC atomic khi co the.
- Neu khong dung transaction duoc, phai chup snapshot truoc khi ghi va rollback thu cong ve snapshot neu bat ky side effect nao that bai.
- Khi buoc phu loi, action phai tra loi ro rang hoac throw; khong duoc tiep tuc nhu thanh cong mot phan.
- Nhung luong co tien, kho, luong, thang ke toan, royalty, clearing, booking status va accounting outbox mac dinh phai fail-closed.

Quy tac accounting outbox:

- Nghiep vu nganh moi khong duoc tu ghi thang vao `journal_entries`/`journal_lines`.
- Moi phat sinh doanh thu, hoan tien, voucher/refund, chi phi, luong, hoa hong, royalty hoac bu tru lien chi nhanh phai dong goi thanh payload va dua vao accounting outbox.
- Accounting worker la noi xu ly tuan tu mapping TT133 va tao but toan so cai.
- Payload phai co `tenant_id`, `event_type`, `reference_type`, `reference_id`, amount/currency, metadata can thiet va idempotency key.
- Test bat buoc assert ca outbox record lan but toan/side effect cuoi cung khi worker xu ly.
- Boundary nay duoc khoa bang `src/__tests__/accounting-ledger-boundary.test.ts`: chi `AccountingEngineService` duoc ghi truc tiep vao bang so cai.

Neu phat hien logic lap lai qua 2-3 noi va co rui ro sai tien/ton kho/luong/accounting, moi duoc gom thanh rule engine. Khong tao engine chi vi muon "cho dep".

### Phase 4 - UI Module-Aware

Moi UI cua module moi phai:

- Dung copy theo module, khong hard-code thuat ngu nganh cu.
- Loading state khong hien tam du lieu/ngon ngu cua tenant khac.
- Sidebar/header/portal/bao gia/hoa don doc brand theo tenant.
- First paint tren app route phai dung neutral bootstrap hoac runtime brand cache da duoc ghi sau khi tenant xac thuc; khong de `:root`, `theme-color`, sidebar/header mac dinh Bella hien truoc khi module load xong.
- Theme rieng cua nganh moi phai scope bang module marker, vi du `html[data-tenant-module="beauty_spa"]`; khong viet selector `.beauty-*` global lam anh huong Bella/Babycare.
- Picker/list tren UI phai lay du lieu qua action tenant-scoped, khong doc truc tiep bang tenant-sensitive tu browser.
- Dropdown, table, modal dung component/pattern chung cua he thong.
- Mobile phai check truoc khi coi xong.
- Neu co giao dien rieng/brand rieng, phai render preview anh mau truoc khi code thay doi UI lon.

Checklist UI bat buoc:

- Desktop: khong tran bang/filter/dropdown.
- Mobile: khong cat noi dung, nut bam vua khung, table scroll trong box.
- F5: giu dung tenant/module/tab hien tai.
- Loading/first paint: khong flash Bella/Babycare/mau hong tren Beauty/nganh moi; neu chua co tenant context thi phai la neutral shell.
- Empty/error state: noi dung dung nganh.

### Phase 5 - Demo Data Va Cleanup

Demo tenant cho nganh moi bat buoc co:

- marker co dinh, vi du `BEAUTY_DEMO_FRANCHISE_TEST`
- email/admin demo co dinh
- script create va cleanup rieng
- cleanup bat buoc co `--confirm`
- khong dung delete filter rong nhu `.neq()` hoac `.not()`
- data tao ra phai co `tenant_id` dung tenant demo
- co the xoa sach ma khong anh huong Bella Spa/Babycare

Demo finance/accounting bat buoc:

- Seed chart of accounts truoc.
- Verify ma tai khoan can thiet truoc khi tao revenue/expense/journal.
- Neu thieu account, fail ro va khong tao nua chung.

### Phase 6 - Verification Bat Buoc

Moi module moi can toi thieu cac nhom test:

| Nhom test | Muc tieu |
| --- | --- |
| Module registry | Tenant duoc enable dung module, default khong sai |
| Tenant isolation | Admin A khong thay du lieu tenant B |
| Module isolation | Nganh moi khong dung goi/text/workflow cua Babycare neu khong duoc phep |
| Package/service scope | Booking khong duoc dung package sai tenant/sai module |
| Side effects | Payment, revenue, inventory, salary, accounting tao dung ban ghi phu |
| Idempotency | Webhook/worker/sync retry 2 lan khong tao lap doanh thu/chi phi/outbox/but toan |
| Rollback/fail-closed | Action nhieu buoc loi giua chung khong de lai trang thai nua chung |
| Accounting outbox | Nghiep vu tai chinh nganh moi tao outbox dung contract, khong ghi so cai truc tiep |
| Integration credentials | Token/API key tenant-scoped, khong leak ra UI, refresh/read loi phai fail ro |
| RLS/grants | Bang moi khong bi permission denied trong luong hop le |
| Demo lifecycle | Tao/xoa demo tenant sach, co marker |
| UI smoke | Desktop/mobile khong overflow, F5 khong flash sai brand/module |
| Original product regression | Bella Spa hien tai van pass luong chinh |

Lenh nen chay tuy scope:

```powershell
npm.cmd test -- src/__tests__/beauty-spa-module-isolation.test.ts src/__tests__/booking-package-module-scope.test.ts --runInBand
npm.cmd test -- src/__tests__/session-read-actions.test.ts src/__tests__/dashboard-actions.test.ts --runInBand
npm.cmd run test:critical
npm.cmd run lint
npm.cmd run build
```

Neu co migration/RLS:

```powershell
npm.cmd run db:migration:check
npm.cmd run db:rpc-grants:check
```

Neu co giao dien:

```powershell
npx.cmd playwright test <route-smoke-spec>
```

## Definition Of Done Cho Nganh Moi

Mot phan he nganh moi chi duoc xem la xong khi:

- HQ tao/cap module dung quy trinh.
- Tenant nganh moi co brand/copy/module rieng.
- Tenant nganh cu khong thay du lieu nganh moi.
- Tenant nganh moi khong thay du lieu nganh cu.
- F5 khong flash sai brand/module.
- Module key do HQ cap, khong bi tenant admin tu doi thanh nganh khac.
- Booking/payment/revenue/accounting/inventory/salary lien quan khong tao side effect sai.
- UI khong con query truc tiep bang tenant-sensitive tu browser neu chua qua server action tenant-scoped.
- Read/write/rollback tren bang tenant-scoped deu co `tenant_id` filter, khong chi filter bang `id`.
- Webhook/worker/sync lien quan co idempotency guard va test retry.
- Multi-step action lien quan tien/kho/luong/accounting co transaction hoac rollback/fail-closed.
- Phat sinh tai chinh di qua accounting outbox, khong ghi truc tiep vao so cai.
- `src/__tests__/accounting-ledger-boundary.test.ts` pass neu co thay doi lien quan accounting/module nganh moi.
- Token/API key tich hop tenant-scoped, khong leak ra UI va khong nuot loi refresh/read.
- Demo tenant co the tao va xoa sach.
- Test guard cho loi da sua da duoc commit.
- `docs/implementation-artifacts/` co spec/handoff lien quan.
- Neu phat sinh loi moi, them vao muc "Lich Su Loi Moi" ben duoi.

## Mau Ghi Them Loi Moi

Khi tu nay ve sau phat hien loi trong Beauty Spa hoac nganh moi, them vao bang nay truoc hoac ngay sau khi sua.

```markdown
### YYYY-MM-DD - <Ten loi ngan>

- Module/tenant:
- Man hinh/luong:
- Dau hieu:
- Nguyen nhan goc:
- Cach sua:
- Test/guard da them:
- Commit:
- Rui ro con lai:
```

## Lich Su Loi Moi

### 2026-06-11 - Beauty CTA va badge quan trong bi mo

- Module/tenant: Beauty Spa.
- Man hinh/luong: Danh sach khach hang Beauty, nut "Them khach hang", badge "Dang co lieu trinh/dich vu".
- Dau hieu: CTA va badge co chu trang nhung nen bi doi sang mau qua nhat; badge dang nhap nhay co luc gan nhu bien mat.
- Nguyen nhan goc: CSS Beauty override selector `[class*="bg-rose-..."]` qua rong nen match ca class mau dam nhu `bg-rose-500`; badge dung `animate-pulse` lam opacity giam xuong khoang 0.5.
- Cach sua: Gan class rieng `beauty-customer-add-cta` va `beauty-active-care-badge`; override trong ca `pending` va `beauty_spa`; doi nhap nhay sang glow/brightness de khong lam mo chu.
- Test/guard da them: `npm.cmd run lint`, Playwright headless do computed style xac nhan nen gradient Jade/navy, chu trang, opacity `1`; luu anh verify `docs/beauty_customer_add_cta_visible.png` va `docs/beauty_customer_active_badge_visible.png`.
- Bai hoc: Moi CTA/badge nghiep vu cua module moi phai duoc check contrast trong ca first-paint/pending va sau khi tenant resolve; khong dung animation giam opacity cho thong tin can theo doi.

### 2026-06-11 - Beauty F5 flash lop hong truoc khi vao Jade theme

- Module/tenant: Beauty Spa va Bella Spa.
- Man hinh/luong: Dashboard app shell, sidebar/header, theme-color trinh duyet.
- Dau hieu: Khi F5 tai khoan Beauty Spa, UI hien mot lop hong/Bella trong khoanh khac ngan roi moi chuyen sang mau xanh Jade.
- Nguyen nhan goc: Root CSS variables va meta `theme-color` mac dinh Bella/Pink truoc khi client load tenant brand/module; runtime cache chua duoc bootstrap som.
- Cach sua: Them bootstrap script trong root layout cho app routes de set `data-tenant-module="pending"` va CSS variables neutral truoc paint; ghi runtime brand cache vao `sessionStorage` sau khi tenant brand da duoc xac thuc; clear runtime cache khi vao login/logout; cap nhat theme-color khi apply brand.
- Test/guard da them: `npm.cmd run lint`, `npm.cmd run build`, Playwright headless xac nhan early F5 khong con mau hong va reload Beauty vao thang `beauty_spa`/`#074E44`.
- Commit: pending.
- Rui ro con lai: Neu them route app shell moi ngoai `/dashboard` hoac `/ktv`, phai dua route do vao bootstrap guard hoac co layout brand bootstrap rieng.

### 2026-06-10 - Bella admin thay du lieu Beauty trong UI

- Module/tenant: Bella Spa va Beauty Spa.
- Man hinh/luong: Dashboard, khach hang, the lieu trinh, tai chinh.
- Dau hieu: Dang nhap mail quan tri Bella Spa nhung UI co khach/demo Beauty va giao dich Beauty.
- Nguyen nhan goc: Can tang guard tenant-scope cho cac luong doc session/dashboard va kiem tra lai demo data.
- Cach sua: Them regression test bat buoc `getSessionLogs`, `getSessionsWithDetails`, `getCalendarSessions` phai filter tenant; dashboard upcoming sessions phai di qua action calendar tenant-scoped; demo accounting seed phai verify COA.
- Test/guard da them: `src/__tests__/session-read-actions.test.ts`, `src/__tests__/dashboard-actions.test.ts`, `src/__tests__/beauty-demo-tenant-script.test.ts`.
- Commit: `ae973883` - `test: guard tenant scoped reads`.
- Rui ro con lai: Can tiep tuc them guard theo tung man hinh neu phat hien read model nao con di truc tiep bo qua action tenant-scoped.

### 2026-06-10 - Booking modal va staff actions dung du lieu khong scope tenant

- Module/tenant: Bella Spa va Beauty Spa.
- Man hinh/luong: Modal tao booking, danh sach chon KTV/khach hang, quan ly nhan su.
- Dau hieu: Tai khoan Bella co nguy co nhin thay KTV/khach Beauty trong picker; action nhan su co nguy co thao tac theo `id` neu biet id cua tenant khac.
- Nguyen nhan goc: UI query truc tiep tu browser vao `users`/`customers`; `getUsers` va mot so write/rollback action trong user management chua gan `tenant_id`.
- Cach sua: Booking modal dung `getUsers`/`getCustomers` tenant-scoped; `getUsers`, update status/profile/base salary/delete user va rollback deu filter `tenant_id`.
- Test/guard da them: `src/__tests__/tenant-isolation-source-guards.test.ts` khoa BookingModal khong query truc tiep `users`/`customers`; `src/__tests__/user-actions.test.ts` assert filter `tenant_id` cho update/delete/rollback.
- Commit: pending.
- Rui ro con lai: Tiep tuc audit tung client component neu con query truc tiep bang tenant-sensitive; chi cho phep neu do la auth/self profile lookup hoac co tenant guard ro rang.

### 2026-06-10 - KTV dashboard fallback Babycare truoc khi load tenant

- Module/tenant: Beauty Spa.
- Man hinh/luong: KTV mobile dashboard, danh sach ca dang thuc hien va lich hom nay.
- Dau hieu: UI co the hien icon/copy Babycare trong khoanh thoi gian ngan khi trang vua load hoac F5.
- Nguyen nhan goc: `tenantModuleKey` trong KTV dashboard duoc khoi tao mac dinh la `babycare` thay vi trang thai trung tinh.
- Cach sua: Khoi tao `tenantModuleKey` bang `null`; `KtvSessionSections` dung presentation trung tinh cho den khi tenant settings load xong.
- Test/guard da them: `src/__tests__/beauty-spa-module-isolation.test.ts` kiem tra KTV dashboard khong duoc `useState<TenantModuleKey>('babycare')`.
- Commit: xem git history cua thay doi `fix: neutralize ktv module fallback`.
- Rui ro con lai: Cac man hinh KTV khac can tiep tuc audit neu co state module hard-code Babycare.

### 2026-06-10 - Zalo credential read-facing config tra token that

- Module/tenant: CRM/Zalo, moi tenant.
- Man hinh/luong: Trang CRM cau hinh Zalo OA.
- Dau hieu: Action doc cau hinh Zalo tra secret/access/refresh token da giai ma ve UI.
- Nguyen nhan goc: Read-facing config dung lai du lieu credential server-side thay vi chi tra metadata an toan.
- Cach sua: `getZaloConfig` khong select/khong decrypt credential; cac truong credential tra rong cho UI. `saveZaloConfig` bo qua credential rong de bam luu cau hinh khac khong xoa token cu.
- Test/guard da them: `src/__tests__/crm-zalo-config.test.ts` kiem tra UI khong nhan credential that va submit credential rong khong overwrite token.
- Rui ro con lai: Khi them kenh tich hop moi, phai tach read-facing config va server credential resolver ngay tu dau.

## Quy Tac Cho AI Agent Tuong Lai

Khi user yeu cau "them phan he nganh moi", "mo rong Beauty", "lam module nganh X", hoac "white-label cho spa/clinic/academy":

1. Doc `AGENTS.md`.
2. Doc `docs/index.md`.
3. Doc tai lieu nay.
4. Kiem tra spec/implementation artifact lien quan gan nhat.
5. Chi de xuat viec chua lam; khong lap lai rule engine hoac refactor da co.
6. Neu thay doi runtime, phai co test chung minh Bella Spa hien tai khong bi anh huong.
7. Neu phat sinh loi moi, cap nhat "Lich Su Loi Moi" trong tai lieu nay.
