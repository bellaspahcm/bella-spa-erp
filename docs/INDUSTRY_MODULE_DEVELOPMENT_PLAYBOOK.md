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
- thay doi toi uu hieu nang co dang tac dong vao route core dung chung hay chi module rieng
- static analysis/security gate co canh bao runtime that hay chi artifact docs/archive/test, va exception neu co da duoc ghi ly do chua
- **THEME COLORS co duoc override dung cho module moi hay van hien thi mau cu** (xem `docs/MODULE_THEME_COLOR_OVERRIDE_GUIDE.md`)

Neu mot thay doi tao them nganh moi ma khong cap nhat playbook nay hoac artifact lien quan, task chua duoc xem la hoan tat.

## Tai Lieu Lien Quan

- **Theme Color Override Guide**: `docs/MODULE_THEME_COLOR_OVERRIDE_GUIDE.md` - BẮT BUỘC đọc khi thêm module mới
  - Hướng dẫn fix API parse JSONB
  - Hướng dẫn theme detection logic
  - Comprehensive CSS overrides template
  - Common pitfalls và solutions

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

## Ghi Chu Phan He Dao Tao Hoc Vien

`student_training` la add-on dao tao co the bat cho Bella Spa hoac Beauty Spa, khong phai module nganh chinh thay the `babycare`/`beauty_spa`.

Quyet dinh chinh:

- `babycare` va `beauty_spa` van la primary business module dung cho brand, service package va ngon ngu van hanh chinh.
- `student_training` chi mo cac bang/course/portal dao tao, mac dinh tat cho tenant moi va tenant cu.
- Học viên role `student` la user ngoai van hanh: khong duoc vao `/dashboard/*` hoac `/ktv/*`; nhan su spa khong duoc vao `/student/*`.
- RLS cua bang dao tao phai tach staff tenant-scope va student own-record/enrolled-course scope; khong cho student doc toan bo du lieu dao tao cung tenant.
- Thu hoc phi dao tao chua duoc xem la doanh thu ke toan cho den khi co server action va accounting outbox rieng.

## Lich Su Beauty Spa: Qua Trinh, Loi, Cach Sua

Bang nay la nhat ky bai hoc thuc te. Khi lam nganh moi, bat buoc doi chieu tung nhom loi.

| Nhom | Loi da gap | Nguyen nhan | Cach sua/guard can giu |
| --- | --- | --- | --- |
| Module setup | Beauty Spa bi xem nhu tuy chon co the bat/tat | Thiet ke ban dau gan voi module toggle thay vi quy trinh thuong mai HQ cap | HQ-only setup, Beauty admin khong duoc doi module nganh |
| Subscription catalog | Gia goi, tinh nang va han muc chi nhanh co nguy co nam trong code hoac sua tay SQL | Chua co UI/action HQ chinh catalog va default entitlement; quota chi nhanh neu dem toan cuc se khoa nham khach khac | Catalog goi va default entitlement phai do HQ sua qua audited action; `branch` la feature quota rieng; branch quota phai dem theo cum thuong mai root tenant + `parent_tenant_id`, khong hard-code current = 1 |
| Subscription quota monitoring | HQ canh bao han muc co nguy co bi lam thu cong hoac dem sai neu chi doc tung bo dem | Chi co counter SMS, con KTV/khach hang/chi nhanh can snapshot theo tenant de HQ thay tenant gan/vuot goi | HQ duoc tao read-model snapshot chi lay count theo tenant/cum tenant dung scope; customer/KTV theo `tenant_id`, branch theo root + child tenants, khong dem toan cuc |
| Tenant isolation | Dang nhap Admin Bella Spa van thay khach/demo Beauty | Query/UI read model co diem thieu scope tenant hoac demo data chua tach sach | Moi action doc du lieu phai filter `tenant_id`; them guard test session/dashboard/customer/finance |
| Client direct query | Booking modal/list picker hien KTV/khach Beauty trong tai khoan Bella | UI query truc tiep tu browser vao `users`/`customers` thay vi qua server action tenant-scoped | Khong query client voi bang tenant-sensitive; dung server action co current tenant; them source guard |
| Module isolation | Beauty tenant van hien text Me & Be, KTV, Combo Me Be | UI copy va filter bi hard-code theo Babycare | Dung module-aware copy, service category theo module, khong render babycare UI khi tenant chua load module |
| Loading fallback | F5 hien Bella Spa mot luc roi moi chuyen Beauty Spa | Fallback mac dinh ve Bella/Babycare truoc khi tenant brand/module load xong | Non-Bella tenant khong fallback Bella; dung loading/neutral state den khi co tenant context |
| First-paint theme flash | F5 Beauty/Bella hien mau hoac brand cua tenant truoc do truoc khi vao dung dashboard | CSS root/meta theme-color mac dinh Bella hoac root bootstrap doc runtime cache cu truoc khi xac thuc tenant hien tai | App shell phai bootstrap neutral truoc paint; khong doc runtime cache tenant cu tai root; protected layout phai apply tenant brand runtime truoc khi render dashboard children; session runtime cache chi duoc ghi sau khi tenant da xac thuc |
| Brand isolation | Sidebar/header/portal co nguy co dung logo/mau Bella | Branding doc tu default chung hoac cache khong gan tenant | Cache brand phai kem `tenantId`; fallback Beauty trung tinh, khong fallback Bella |
| Brand controls no-op | Mau he thong/bo goc/kieu nut/menu trong Setting co the luu nhung giao dien khong doi | UI setting cap nhat `brand_theme` nhung runtime root va CSS module khong tieu thu cac gia tri `primaryColor`, `radiusStyle`, `buttonStyle`, `menuStyle` | Setting preview phai apply CSS variables + `data-tenant-brand-*`; CSS chi scope theo module, vi du `html[data-tenant-module="beauty_spa"]`; them source guard |
| Visual theme leakage | Giao dien rieng cua Beauty co nguy co doi mau/layout Bella ERP | CSS/class rieng cua nganh moi viet global, khong scope theo module marker | Moi theme UI rieng phai nam sau `html[data-tenant-module="..."]`; them source guard khoa selector khong duoc unscoped |
| CTA/badge/active-state contrast | Nut chinh, badge quan trong hoac ngay/filter dang chon bi mo/gan nhu mat chu | Selector theme qua rong match ca class mau dam/gradient, hoac dung animation giam opacity nhu `animate-pulse` | CTA/badge/trang thai active phai co class rieng theo module, mau nen/chu dat contrast ro; neu can nhap nhay thi dung glow/brightness, khong giam opacity |
| Dark dashboard surfaces | Beauty dark mode con alert pastel sang, chu chim va bang Top KTV khong lap day card | Dark skin chi override mau chung, thieu class rieng cho table/list quan trong | Table/list quan trong phai co class rieng nhu `beauty-top-ktv-table` va `beauty-alert-item`; dark CSS chi bam vao class do de khong anh huong Bella |
| Dark data table scroll | Bang Beauty dark co thanh truot ngang sang mau, nam lo ra ngoai cam giac khong thuoc card, hoac row/table khong lap day box | Wrapper/table khong dung chung `custom-scrollbar` + `bella-data-table`, hoac table dang `width: max-content` nen tao mang nen bi tach o mep phai | Moi bang du lieu Beauty phai dung table pattern chung; dark CSS module-scoped phai dat table `width: 100%`, wrapper scroll nam trong box, scrollbar theo tone xanh-vang va khong override Bella |
| Core performance scope | De xuat toi uu lai route da toi uu hoac khong ro anh huong Bella/Beauty | Khong doi chieu git history/code truoc khi de xuat; route core dung chung bi nham la rieng Bella hoac rieng Beauty | Truoc moi de xuat toi uu, kiem tra commit/code hien co; ghi route, muc tieu, pham vi anh huong, commit va test; core route can regression Bella + tenant isolation neu co data read |
| Package/service scope | Goi dich vu Beauty va Babycare co nguy co dung lan | `packages` la bang dung chung, ban dau thieu module guard | `packages.module_key`, `validateBookingPackageScope`, test cross-module/cross-tenant |
| Resource booking | Beauty Spa co giuong/phong/may/ghe nhung lich buoi co nguy co dat trung tai nguyen cung ngay gio | Ban dau chi co danh muc `booking_resources`, chua gan tai nguyen vao tung buoi va chua guard conflict tren server | Tai nguyen dat lich phai gan o `session_logs.booking_resource_id`; create/update/reschedule session phai validate `tenant_id` + resource + ngay + gio + status active truoc khi ghi |
| Resource time matching | Dat trung tai nguyen van lot neu UI gui `HH:MM` nhung cot DB tra `HH:MM:SS` | `sanitizeTime` va cot `time` cua PostgreSQL co format hien thi khac nhau | Guard conflict tai nguyen phai so khop ca bien the `HH:MM` va `HH:MM:SS`; them unit test va E2E UI smoke cho case trung tai nguyen |
| Dev/mock RLS read path | E2E mock-auth khong doc duoc bang RLS chat nhu `booking_resources`, lam UI khong hien du lieu dung | Mock-auth khong tao Supabase auth session that, nen client public bi xem nhu anon | Server action tenant-scoped trong dev/mock duoc dung `createDevelopmentBypassClient`, nhung phai lay tenant tu current user va filter `tenant_id`; khong mo grant anon |
| Data vocabulary | Form khach Beauty con truong "Ho ten me", "Ho ten be", lich co "Combo Me Be" | Dung lai giao dien cu chua audit toan bo text | Truoc khi release module moi phai `rg` toan bo thuat ngu nganh cu va map sang dictionary module |
| Hidden onboarding copy | Beauty admin van thay tour/huong dan "Bat dau cung Bella Spa" sau khi F5 | Chi audit cac trang chinh, bo sot onboarding/help/empty-state copy an | Moi module moi phai audit ca onboarding tour, tooltip, empty state, help text va first-run modal; copy phai nhan brand/module context |
| Demo tenant | Can tao demo Beauty de test nhung phai xoa sach | Demo seed ban dau chua co marker/cleanup chuan | Demo data phai co `DEMO_MARKER`, fixed ids/email, cleanup requires `--confirm`, khong delete bang filter rong |
| Accounting demo | Posting finance demo loi do thieu ma tai khoan 111/5111/6421... | Tenant demo chua seed chart of accounts | Demo script phai goi `seed_default_coa` va verify accounts truoc khi tao journal/revenue |
| RLS/grants | Permission denied khi doc/xoa bang moi hoac bang token | Migration tao bang nhung chua grant/RLS policy du cho role thuc te | Moi bang moi phai co RLS, grant, policy va test permission/grant |
| Review/session FK | Tao review cho buoi cham soc bi FK reviewer_id | Reviewer/user id khong hop le hoac khong thuoc bang user ky vong | Action phai resolve reviewer hop le, neu khong co thi fail ro rang, khong insert review mo ho |
| UI mobile | Bang, filter ngay, dropdown, modal bi tran/cat noi dung | Tai su dung layout desktop hoac native select khong dong bo | Mobile-first visual smoke; table scroll trong box; dropdown dung component chung |
| Finance leakage | Bao cao tai chinh Bella hien giao dich Beauty demo | Revenue/expenses demo hoac query finance thieu scope module/tenant | Finance read model bat buoc filter tenant; demo data repair; regression test |
| Test blind spot | Co loi UI/data da sua thu cong nhung chua co guard | Test chua khoa dung invariant moi | Sau moi loi production/UI, them test guard nho nhat co the |
| Static analysis gate drift | Semgrep/Trivy/Gitleaks fail sau khi them docs/demo/test artifact hoac dependency co CVE chua co ban sua | Gate quet ca artifact khong runtime, log dung format dong, hoac exception dependency khong co rationale | Ignore phai scope hep vao docs/archive/test; dependency exception phai ghi CVE/GHSA + ly do; runtime log dung constant format string; CI gate phai xanh truoc khi ban giao |
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
- Neu nganh co tai nguyen dat lich nhu giuong, phong, may, ghe thi tai nguyen phai duoc validate o server theo tung buoi/session. Khong duoc chi khoa bang UI.
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

### Phase 4b - Core Performance Va Pham Vi Anh Huong

Mot so route la loi ERP dung chung cho Bella Spa va Beauty Spa. Toi uu cac route nay thuong co loi cho ca hai, nhung cung co rui ro lam ro ri du lieu neu load/read model bi sua sai.

Core routes can xem la dung chung:

- `/dashboard`
- `/dashboard/sessions`
- `/dashboard/bookings`
- `/dashboard/customers`
- `/dashboard/customers/[id]`
- `/dashboard/finance`
- `/dashboard/inventory`
- `/dashboard/salary`
- `/dashboard/accounting/*`

Quy tac truoc khi de xuat hoac thuc hien toi uu:

- Bat buoc kiem tra `git log --oneline` va `rg` dau hieu da toi uu, vi du `dynamic`, `Promise.all`, `limit`, `range`, `offset`, `setTimeout`, `reloadTimerRef`, `pageSize`.
- Khong de xuat lai route da toi uu neu chua co bang chung moi: anh chup, thoi gian load, query cham, hoac bug nguoi dung vua gap.
- Phan loai ro pham vi: core dung chung, Beauty theme-only, Bella-only, HQ-only, hay tenant demo-only.
- Neu la core dung chung, phai noi ro thay doi se tac dong ca Bella Spa va Beauty Spa; tenant filter/module guard khong duoc thay doi khi chi toi uu performance.
- Neu la Beauty theme-only, CSS/UI phai scope theo `html[data-tenant-module="beauty_spa"]` hoac class module rieng; khong de anh huong Bella ERP.
- Moi toi uu performance nen ghi lai: route, muc tieu, cach lam, commit, test/build da chay, va pham vi anh huong.
- Khong tao engine, abstraction hoac refactor lon chi de toi uu cam giac. Uu tien: lazy load, load theo tab, limit ban dau, background chunk, debounce realtime, va bo refresh thua.

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
| Static analysis/security gates | Semgrep/Trivy/Gitleaks/audit/secret scan khong co canh bao runtime moi; exception neu co phai scope hep va co ly do |

Lenh nen chay tuy scope:

```powershell
npm.cmd test -- src/__tests__/beauty-spa-module-isolation.test.ts src/__tests__/booking-package-module-scope.test.ts --runInBand
npm.cmd test -- src/__tests__/session-read-actions.test.ts src/__tests__/dashboard-actions.test.ts --runInBand
npm.cmd run test:critical
npm.cmd run security:audit
npm.cmd run security:secrets
npm.cmd run lint
npm.cmd run build
git diff --check
```

Neu co migration/RLS:

```powershell
npm.cmd run db:migration:check
npm.cmd run db:rpc-grants:check
```

Neu co giao dien:

```powershell
npm.cmd run e2e:beauty-uat
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

### 2026-06-12 - Static analysis gate phai duoc xu ly co chu dich

- Module/tenant: Toan he thong, ap dung cho Bella Spa va Beauty Spa.
- Man hinh/luong: CI Static Analysis Security Suite, Quality and Security.
- Dau hieu: Static Analysis fail do Trivy bao CVE cua `xlsx@0.18.5` va Semgrep bao nhieu finding trong docs/archive/static HTML, test path traversal, dynamic log format va dynamic RegExp.
- Nguyen nhan goc: Gate security quet ca artifact khong runtime; dependency `xlsx` dang phuc vu export/test nhung co CVE chua co ban npm chinh thuc duoc du an dung; mot so server/script log dung template string voi gia tri dong.
- Cach sua: Them `.semgrepignore` scope vao docs/archive/public static HTML/test artifact; them `.trivyignore` CVE hep co rationale cho `xlsx`; cap nhat workflow dung ignore; doi runtime/script log sang constant format string; giu API docs check dung pattern tinh.
- Test/guard da them: `npm.cmd run docs:api:check`, `npm.cmd run security:audit`, `npm.cmd run security:secrets`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:critical`, `git diff --check`; GitHub Actions `Static Analysis Security Suite` va `Quality and Security` deu pass.
- Commit: `299a42e4`.
- Rui ro con lai: Khi them dependency export/report moi hoac static HTML demo moi, phai phan loai runtime vs artifact ro rang; khong them ignore rong lam mat tin hieu security that.

### 2026-06-12 - Beauty UAT smoke phai gom ca van hanh va tai nguyen

- Module/tenant: Beauty Spa va Bella Spa.
- Man hinh/luong: Khach hang, lich hen, the lieu trinh, tai chinh, booking resource.
- Dau hieu: Da co `e2e:tenant-isolation` va `14-beauty-resource-booking-smoke.spec.ts`, nhung file resource booking khong nam trong mot lenh UAT chuan nen de bi quen khi kiem tra truoc ban giao.
- Nguyen nhan goc: Cac smoke test duoc them theo tung loi rieng, chua co entrypoint chung cho Beauty operation UAT.
- Cach sua: Them `npm run e2e:beauty-uat` de chay ca `13-tenant-isolation-smoke` va `14-beauty-resource-booking-smoke`; CI quality/security dung lenh moi.
- Test/guard da them: `npm.cmd run e2e:beauty-uat` la lenh UAT chuan khi co Playwright + Supabase service-role env; local static guard chay qua lint/build.
- Commit: pending.
- Rui ro con lai: UAT smoke nay van can env E2E dung va co the skip tren local neu khong co service-role; khong thay the kiem thu thu cong truoc go-live cho tung spa that.

### 2026-06-22 - Tailwind v4 gap/margin utilities khong generate CSS - phai dung inline styles

- Module/tenant: Beauty Spa (trang Thưởng/Phạt lương).
- Man hinh/luong: `/dashboard/salary/adjustments` - Stats cards (3 cards: Tổng thưởng, Tổng phạt, Chờ duyệt).
- Dau hieu: 
  - Tailwind classes `gap-6`, `md:gap-6`, `md:mr-6`, `grid gap-6` không tạo khoảng cách giữa các cards.
  - Stats cards sát nhau hoàn toàn trên desktop dù đã dùng gap/margin utilities.
  - Inline `style={{ gap: '1.5rem' }}` cũng không work.
  - CSS `<style>` tag với media queries cũng không apply.
  - Chỉ có **pure inline `style={{ marginRight: '24px', marginBottom: '24px' }}`** mới work.
- Nguyen nhan goc: 
  - Tailwind v4 CSS-first approach không generate/purge các utilities đúng cách hoặc có CSS global đang override.
  - `gap` utilities và responsive margin classes bị tree-shake hoặc không compile.
  - Next.js Turbopack hot reload không update styles đúng.
- Cach sua:
  - **Card 1 & 2**: `style={{ marginRight: '24px', marginBottom: '24px' }}`
  - **Card 3**: `style={{ marginBottom: '24px' }}` (không cần marginRight vì là card cuối)
  - Container: `flex flex-col md:flex-row`
  - **KHÔNG dùng** gap, grid, Tailwind margin utilities, hoặc CSS classes cho spacing giữa cards.
- Test/guard da them: 
  - Manual visual test trên localhost desktop/mobile.
  - Chưa có automated test vì là pure CSS/layout issue.
- Commit: `78eed12f`
- Rui ro con lai: 
  - Nếu module khác gặp vấn đề tương tự với Tailwind gap/margin utilities, cần dùng inline styles thay vì classes.
  - Cần điều tra root cause của Tailwind v4 CSS generation issue trong future tasks.
  - Solution này bypass Tailwind hoàn toàn, không responsive được (cần media query riêng nếu muốn khác biệt mobile/desktop spacing).

### 2026-06-12 - Beauty branch quota va demo flow can khoa dung

- Module/tenant: Beauty Spa va subscription core.
- Man hinh/luong: HQ subscription quota, demo tenant, luong goi dich vu -> booking resource -> session -> revenue -> accounting outbox.
- Dau hieu: Goi Beauty co nhieu chi nhanh se khong canh bao/chan dung neu branch quota hard-code current = 1; demo seed co danh muc giuong/may/ghe nhung session chua gan resource; revenue demo co late_fee khong nam trong enum check constraint; expense demo co nhieu object key khong giong nhau.
- Nguyen nhan goc: Demo seed script phat trien truoc khi co branch quota read-model va conflict guard resource day du; demo seed bi add them type/metadata khong thong nhat giua cac record trong batch insert.
- Cach sua: Demo branch quota snapshot phai dem theo root + child tenants; resource conflict phai validate full scope; demo revenue enum phai map enum DB dung; demo expense batch insert phai co cung set of keys.
- Test/guard da them: `npm.cmd test -- src/__tests__/beauty-spa-subscription-quota.test.ts --runInBand`, `npm.cmd test -- src/__tests__/beauty-resource-booking-conflict.test.ts --runInBand`; `npm.cmd run e2e:beauty-uat`.
- Commit: pending.
- Rui ro con lai: Seed script van phai cap nhat thu cong theo DB schema; chua co code-gen tu schema den seed mock; integration test van skip neu khong co env Supabase local.

---

## 2026-06-22 - Industrial Cleaning Module: Loi Demo Data Seeding Va Cach Xu Ly

### Boi Canh
Trong qua trinh trien khai Industrial Cleaning module (Phase 0-2), gap rat nhieu loi lien quan toi demo data seeding, migrations, va PostgREST API behavior. Cac loi nay khong co trong Beauty Spa vi Beauty Spa seed script don gian hon va khong co nhieu edge cases phuc tap.

### Danh Sach Loi Va Cach Xu Ly

#### Loi 1: Missing `metadata` Columns
**Dau hieu:**
```
Error posting to users: {"code":"PGRST204","message":"Could not find the 'metadata' column of 'users' in the schema cache"}
Error posting to customers: {"code":"PGRST204","message":"Could not find the 'metadata' column of 'customers' in the schema cache"}
Error posting to bookings: {"code":"PGRST204","message":"Could not find the 'metadata' column of 'bookings' in the schema cache"}
```

**Nguyen nhan:** Enhanced demo script can luu metadata chi tiet cho customers (facility_type, size, special_requirements), users (certifications, skills, shift_preference), va bookings (package details, frequency), nhung cac bang nay chua co cot `metadata JSONB`.

**Cach sua:**
```sql
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.session_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
```

**Guard:** Migration phai doc schema hien tai va chi add column neu chua co (`IF NOT EXISTS`). Test seed script phai chay sau khi migration complete.

---

#### Loi 2: PostgREST Response Format Mismatch
**Dau hieu:**
```
✅ Tenant created: undefined (ID: undefined)
❌ Fatal error: TypeError: insertedStaff?.filter is not a function
```

**Nguyen nhan:** PostgREST voi header `Prefer: return=representation` tra ve **array** `[{...}]` cho moi insert (single hoac batch), nhung code expect single insert tra ve object `{...}`.

**Cach sua ban dau (SAI):**
```javascript
// SAI - chi xu ly single insert
return Array.isArray(result) ? result[0] : result;
```

**Cach sua DUNG:**
```javascript
// DUNG - detect single vs batch insert
if (Array.isArray(data)) {
  return result; // batch insert -> keep array
} else {
  return Array.isArray(result) ? result[0] : result; // single insert -> extract object
}
```

**Guard:** Moi helper function `post()` hoac `insert()` phai xu ly ro ca single insert va batch insert. Test phai cover ca 2 truong hop.

---

#### Loi 3: Batch Insert "All Object Keys Must Match"
**Dau hieu:**
```
Error posting to users: {"code":"PGRST102","message":"All object keys must match"}
```

**Nguyen nhan:** Batch insert array co mot so objects co `hire_date` field, mot so khong co. PostgREST yeu cau **tat ca objects trong batch phai co cung set of keys**.

**Vi du loi:**
```javascript
const staff = [
  { email: 'admin@...', role: 'admin', base_salary: 15000000, metadata: {...} }, // THIEU hire_date
  { email: 'worker1@...', role: 'ktv', base_salary: 8000000, hire_date: '2024-06-01', metadata: {...} } // CO hire_date
];
```

**Cach sua:**
```javascript
const staff = [
  { email: 'admin@...', role: 'admin', base_salary: 15000000, hire_date: null, metadata: {...} }, // THEM hire_date: null
  { email: 'worker1@...', role: 'ktv', base_salary: 8000000, hire_date: '2024-06-01', metadata: {...} }
];
```

**Guard:** Truoc khi batch insert, phai verify tat ca objects co cung keys. Neu co optional field, phai set `null` cho objects khong co gia tri.

---

#### Loi 4: Duplicate Tenant/Users/Customers From Previous Seeds
**Dau hieu:**
```
Error posting to users: {"code":"23505","message":"duplicate key value violates unique constraint \"users_email_key\""}
Error posting to customers: {"code":"23505","message":"duplicate key value violates unique constraint \"customers_phone_key\""}
```

**Nguyen nhan:** Seed script chay lan truoc bi fail giua chung, de lai **mot phan data** (tenant, users, customers) trong DB. Lan seed tiep theo gap duplicate.

**Cach sua:**
1. **Cleanup script phai xoa TOAN BO du lieu lien quan** theo thu tu:
   ```javascript
   // Dung thu tu nay de tranh FK violations
   DELETE FROM session_logs WHERE tenant_id = ...;
   DELETE FROM revenue WHERE tenant_id = ...;
   DELETE FROM expenses WHERE tenant_id = ...;
   DELETE FROM bookings WHERE tenant_id = ...;
   DELETE FROM customers WHERE tenant_id = ...;
   DELETE FROM users WHERE tenant_id = ...;
   DELETE FROM tenants WHERE id = ...;
   ```

2. **Cleanup phai xoa CA nhieu tenants neu co** (vi du: 6 CleanPro tenants tu cac lan seed failed truoc do):
   ```sql
   DO $$
   DECLARE tenant_record RECORD;
   BEGIN
     FOR tenant_record IN 
       SELECT id FROM tenants WHERE name LIKE '%CleanPro%[DEMO]%'
     LOOP
       -- Delete all related data for each tenant
       DELETE FROM session_logs WHERE tenant_id = tenant_record.id;
       DELETE FROM revenue WHERE tenant_id = tenant_record.id;
       -- ... (repeat for all tables)
       DELETE FROM tenants WHERE id = tenant_record.id;
     END LOOP;
   END $$;
   ```

**Guard:** 
- Cleanup script bat buoc co `--confirm` flag, mac dinh la dry-run.
- Cleanup phai co verification step cuoi cung de confirm Bella/Beauty Spa **KHONG bi anh huong**.
- Seed script phai chay cleanup truoc khi seed (hoac seed script phai idempotent).

---

#### Loi 5: Auth Users vs Public Users Table Mismatch
**Dau hieu:**
```
✅ Created 18 staff members (14 workers)
(But in Supabase Auth Dashboard: 0 users created)
```

**Nguyen nhan:** Seed script chi insert vao `public.users` table (database table), **KHONG tao auth users** trong Supabase Auth service (auth.users). Day la 2 he thong rieng biet.

**Cach sua:**
1. **Cho production/manual demo:** Tao auth user thu cong trong Supabase Auth Dashboard, sau do link voi public.users:
   ```sql
   UPDATE public.users
   SET id = (SELECT id FROM auth.users WHERE email = 'admin@cleanpro-v2.com')
   WHERE email = 'admin@cleanpro-v2.com' AND id IS NULL;
   ```

2. **Cho automated seeding (lan sau):** Dung Supabase Admin API de tao auth users trong seed script:
   ```javascript
   const { data: authUser, error } = await supabase.auth.admin.createUser({
     email: 'admin@cleanpro-v2.com',
     password: 'Admin@123456',
     email_confirm: true,
     user_metadata: { full_name: 'Nguyen Van An', role: 'admin' }
   });
   
   // Then insert into public.users with authUser.id
   await supabase.from('users').insert({
     id: authUser.id, // Link to auth user
     email: 'admin@cleanpro-v2.com',
     full_name: 'Nguyen Van An',
     role: 'admin',
     tenant_id: tenantId,
     base_salary: 15000000,
     metadata: { position: 'General Manager' }
   });
   ```

**Guard:** Seed script phai ro rang noi "Auth users can duoc tao thu cong" hoac tu dong tao auth users. Khong duoc im lang insert vao public.users ma khong noi gi ve auth users.

---

#### Loi 6: Database Constraint Violations (enum, FK, check)
**Dau hieu:**
```
Error posting to revenue: {"code":"23514","message":"new row for relation \"revenue\" violates check constraint \"revenue_revenue_type_check\""}
```

**Nguyen nhan:** Demo data co `revenue_type = 'late_fee'` nhung enum chi co `['deposit', 'payment', 'refund', 'adjustment']`. Script khong doc schema truoc khi seed.

**Cach sua:**
1. Seed script phai **doc schema/enum** truoc khi insert:
   ```javascript
   // Read allowed revenue types from DB
   const { data: enumValues } = await supabase.rpc('get_enum_values', { 
     enum_name: 'revenue_type' 
   });
   
   // Only create revenue with valid types
   const validTypes = enumValues.map(v => v.value);
   const revenueData = demoRevenue.filter(r => validTypes.includes(r.revenue_type));
   ```

2. Hoac update schema truoc khi seed:
   ```sql
   ALTER TYPE revenue_type ADD VALUE IF NOT EXISTS 'late_fee';
   ```

**Guard:** Demo data phai sync voi DB schema. Neu schema thay doi, seed script phai cap nhat hoac fail ro rang (khong silent swallow error).

---

### Quy Tac Chung Cho Demo Data Seeding (Lan Sau Them Nganh Moi)

#### 1. Pre-Seeding Checklist
Truoc khi chay seed script, bat buoc kiem tra:
- [ ] **Schema migrations complete:** Tat ca cot can thiet (`metadata`, `module_key`, etc.) da duoc add
- [ ] **Constraints updated:** Enum types, check constraints da duoc update cho module moi
- [ ] **Previous demo data cleaned:** Chay cleanup script de xoa tenant demo cu (neu co)
- [ ] **Bella/Beauty Spa intact:** Verify Bella va Beauty Spa van hoat dong binh thuong

#### 2. Seed Script Structure
```javascript
// 1. Load environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Dung SERVICE_ROLE_KEY, khong dung ANON_KEY

// 2. Helper functions
async function post(table, data) {
  // Xu ly ca single va batch insert
  if (Array.isArray(data)) {
    return result; // batch -> keep array
  } else {
    return Array.isArray(result) ? result[0] : result; // single -> extract object
  }
}

// 3. Create tenant (with metadata)
const tenant = await post('tenants', {
  name: 'Demo Tenant [DEMO]',
  status: 'active',
  enabled_modules: { new_module: true },
  metadata: { marker: 'DEMO_MARKER_V2', version: '2.0' }
});

// 4. Create users (all keys must match in batch)
const users = [
  { email: 'admin@demo.com', role: 'admin', hire_date: null, metadata: {...} },
  { email: 'worker1@demo.com', role: 'ktv', hire_date: '2024-01-01', metadata: {...} }
];
const insertedUsers = await post('users', users);

// 5. Create customers, bookings, sessions, revenue, expenses (with tenant_id filter)

// 6. Verify data created
console.log(`✅ Created ${insertedUsers.length} users, ${customers.length} customers, ...`);
```

#### 3. Cleanup Script Structure
```javascript
// 1. Dry-run mode by default
const DRY_RUN = !process.argv.includes('--confirm');

// 2. Find all demo tenants
const tenants = await fetchAll('tenants', 'name=like.%[DEMO]%');

// 3. Delete in correct order (avoid FK violations)
for (const tenant of tenants) {
  if (!DRY_RUN) {
    await deleteRecords('session_logs', tenant.id);
    await deleteRecords('revenue', tenant.id);
    await deleteRecords('expenses', tenant.id);
    await deleteRecords('bookings', tenant.id);
    await deleteRecords('customers', tenant.id);
    await deleteRecords('users', tenant.id);
    await deleteRecords('tenants', tenant.id);
  }
}

// 4. Verify Bella/Beauty Spa intact
const verification = await supabase.from('tenants')
  .select('name, enabled_modules')
  .in('name', ['Bella Spa Headquarter', 'Beauty Spa Franchise Demo']);
console.log('Verification:', verification);
```

#### 4. Migration Order
Khi them module moi can metadata:
1. **Add metadata columns TRUOC:**
   ```sql
   ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB;
   ALTER TABLE customers ADD COLUMN IF NOT EXISTS metadata JSONB;
   ALTER TABLE bookings ADD COLUMN IF NOT EXISTS metadata JSONB;
   ```

2. **Update constraints/enums (neu can):**
   ```sql
   ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_module_key_check;
   ALTER TABLE packages ADD CONSTRAINT packages_module_key_check 
     CHECK (module_key IN ('baby_care', 'beauty_spa', 'industrial_cleaning'));
   ```

3. **Chay seed script SAU:**
   ```bash
   node scripts/run-seed-demo-dotenv.js
   ```

#### 5. Auth Users Handling
**Option A: Manual (for quick testing):**
1. Seed script chi tao `public.users` records
2. Admin thu cong tao auth user trong Supabase Auth Dashboard
3. Chay SQL link script:
   ```sql
   UPDATE public.users SET id = (SELECT id FROM auth.users WHERE email = '...')
   WHERE email = '...' AND id IS NULL;
   ```

**Option B: Automated (for production-ready seeding):**
1. Seed script dung Supabase Admin API:
   ```javascript
   const { data: authUser } = await supabase.auth.admin.createUser({
     email: 'admin@demo.com',
     password: 'Admin@123456',
     email_confirm: true
   });
   await supabase.from('users').insert({ id: authUser.id, ... });
   ```

#### 6. Error Handling
```javascript
async function post(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const error = await res.text();
    console.error(`❌ Error posting to ${table}:`, error);
    
    // KHONG swallow error - phai throw hoac return null ro rang
    throw new Error(`Failed to insert into ${table}: ${error}`);
  }
  
  return await res.json();
}
```

#### 7. Verification Steps
Sau khi seed xong, bat buoc verify:
```javascript
// 1. Count records created
console.log(`✅ Tenant: ${tenant.name}`);
console.log(`✅ Users: ${users.length}`);
console.log(`✅ Customers: ${customers.length}`);
console.log(`✅ Bookings: ${bookings.length}`);
console.log(`✅ Sessions: ${sessions.length}`);
console.log(`✅ Revenue: ${revenue.length}`);
console.log(`✅ Expenses: ${expenses.length}`);

// 2. Verify Bella/Beauty Spa intact
const bellaTenants = await supabase.from('tenants')
  .select('name, enabled_modules')
  .in('name', ['Bella Spa Headquarter', 'Beauty Spa Franchise Demo']);

console.log('✅ Bella/Beauty Spa tenants:', bellaTenants.data.length);
```

---

### Commit Lien Quan
- **Metadata migrations:** `supabase/migrations/MANUAL_add_metadata_columns.sql`
- **Cleanup all CleanPro tenants:** `supabase/migrations/MANUAL_cleanup_all_cleanpro_demo_data.sql`
- **Link auth users:** `supabase/migrations/MANUAL_link_cleanpro_admin_auth.sql`
- **Seed script fixes:** `scripts/seed-cleaning-demo-v2.mjs` (post helper, hire_date consistency)
- **Cleanup script v2:** `scripts/cleanup-cleaning-demo-v2.mjs`
- **Dotenv wrappers:** `scripts/run-seed-cleaning-v2-dotenv.js`, `scripts/run-cleanup-cleaning-v2-dotenv.js`

### Test/Guard Da Them
- ✅ Cleanup script bat buoc co `--confirm` flag
- ✅ Cleanup phai xoa theo thu tu dung (tranh FK violations)
- ✅ Cleanup phai verify Bella/Beauty Spa intact
- ✅ Seed script phai handle PostgREST array response
- ✅ Batch insert objects phai co cung keys
- ✅ Migration phai dung `IF NOT EXISTS`
- ✅ Seed script phai ro rang ve auth users (manual hoac automated)

### Rui Ro Con Lai
- Seed script van can manual setup auth users (chua fully automated)
- Chua co code-gen tu DB schema den seed mock data
- Neu DB schema thay doi (enum, constraints), seed script phai cap nhat thu cong
- Chua co integration test chay seed + cleanup trong CI pipeline chua gan `booking_resource_id`.
- Nguyen nhan goc: Entitlement `branch` da co nhung engine chua dem theo cum thuong mai root tenant + child tenants; demo flow chua noi tai nguyen vao buoi cham soc.
- Cach sua: `checkSubscriptionLimit('branch')` dem root tenant va cac tenant co `parent_tenant_id` cung root; demo script gan `booking_resource_id` cho tung session Facial/Diode/Goi dau.
- Test/guard da them: `src/__tests__/subscription.test.ts` va `src/__tests__/beauty-demo-tenant-script.test.ts` khoa branch quota va Beauty operating flow.
- Commit: `test: harden beauty quota and demo flow`.
- Rui ro con lai: Neu sau nay them mo hinh franchise co cap cha/con sau hon 1 tang, can mo rong owner model thay vi suy dien chi bang `parent_tenant_id`.

### 2026-06-11 - Core performance optimization scope can bi ghi log

- Module/tenant: Bella Spa va Beauty Spa dung chung core dashboard.
- Man hinh/luong: `/dashboard`, `/dashboard/salary`, `/dashboard/sessions`, `/dashboard/bookings`, `/dashboard/customers`, `/dashboard/customers/[id]`.
- Dau hieu: Sau nhieu lan toi uu load, van co nguy co de xuat lai trang da toi uu neu chi nho theo cam tinh.
- Nguyen nhan goc: Chua co log tap trung ve route nao da toi uu, pham vi anh huong Bella/Beauty, va commit nao chua minh.
- Cach sua: Them Phase 4b trong playbook; bat buoc kiem tra git history/code truoc khi de xuat toi uu; chi tiep tuc khi co bang chung moi hoac do duoc diem cham thuc te.
- Cac commit da ghi nhan: `0250df8a` dashboard initial loading, `49d0b51b` dashboard data loading phases, `fee69e2d` salary page initial loading, `e8f044cb` sessions page data loading, `764ce356` bookings calendar loading, `91f7fbcc` customer list incremental loading, `1b6ce05b` customer detail loading.
- Pham vi anh huong: Cac route core tren co loi cho ca Bella Spa va Beauty Spa; thay doi theme Jade/dark Beauty thi chi duoc scope trong Beauty module.
- Test/guard can giu: Khi doi core data loading, chay test lien quan route/action va `npm.cmd run lint`, `npm.cmd run build`; neu cham vao tenant read model thi them/chay tenant isolation guard.
- Rui ro con lai: Neu toi uu mot route moi ma khong ghi vao playbook/log, AI agent sau co the de xuat trung lap hoac khong noi ro anh huong Bella/Beauty.

### 2026-06-11 - Beauty/Bella operational smoke chua duoc dong goi

- Module/tenant: Beauty Spa va Bella Spa.
- Man hinh/luong: Khach hang, the lieu trinh/dich vu, tai chinh, tenant isolation.
- Dau hieu: Sau khi sua tay cac loi Beauty/Bella isolation, smoke test tao khach/goi/booking/check-out/payment/cleanup van dang la lenh tam, kho chay lai.
- Nguyen nhan goc: Guard CI co tenant isolation co ban, nhung chua dong goi luong Beauty demo operational smoke co tao/xoa du lieu tam va xac nhan Bella admin khong thay marker.
- Cach sua: Bo sung test vao `e2e/tests/13-tenant-isolation-smoke.spec.ts` va npm script `e2e:tenant-isolation`; test tao du lieu Beauty tam, xac nhan UI Beauty thay, progress/payment dung, Bella admin khong thay, cleanup ve 0.
- Test/guard da them: `npm.cmd run e2e:tenant-isolation`.
- CI guard: Ban dau `.github/workflows/quality-security.yml` chay `npm run e2e:tenant-isolation`; tu 2026-06-12 da mo rong thanh `npm run e2e:beauty-uat` de gom ca resource booking smoke.
- Commit: `6fd34fe8`.
- Rui ro con lai: Smoke nay can Supabase service-role env va local dev auth; neu chay tren production/staging phai dung account E2E rieng, khong dung mock cookie.

### 2026-06-11 - Beauty CTA va badge quan trong bi mo

- Module/tenant: Beauty Spa.
- Man hinh/luong: Danh sach khach hang Beauty, nut "Them khach hang", badge "Dang co lieu trinh/dich vu".
- Dau hieu: CTA va badge co chu trang nhung nen bi doi sang mau qua nhat; badge dang nhap nhay co luc gan nhu bien mat.
- Nguyen nhan goc: CSS Beauty override selector `[class*="bg-rose-..."]` qua rong nen match ca class mau dam nhu `bg-rose-500`; badge dung `animate-pulse` lam opacity giam xuong khoang 0.5.
- Cach sua: Gan class rieng `beauty-customer-add-cta` va `beauty-active-care-badge`; override trong ca `pending` va `beauty_spa`; doi nhap nhay sang glow/brightness de khong lam mo chu.
- Test/guard da them: `npm.cmd run lint`, Playwright headless do computed style xac nhan nen gradient Jade/navy, chu trang, opacity `1`; luu anh verify `docs/beauty_customer_add_cta_visible.png` va `docs/beauty_customer_active_badge_visible.png`.
- Bai hoc: Moi CTA/badge nghiep vu cua module moi phai duoc check contrast trong ca first-paint/pending va sau khi tenant resolve; khong dung animation giam opacity cho thong tin can theo doi.

### 2026-06-11 - Beauty dark mode bi Bella dark theme keo sai mau

- Module/tenant: Beauty Spa.
- Man hinh/luong: Dark mode toan dashboard Beauty, sidebar/menu, card, input, table va AI panel.
- Dau hieu: Sidebar menu thanh pill den qua gat, chu bi mo, mot so vung van nen sang/hong, cac nut va box khong theo bo nhan dien Beauty.
- Nguyen nhan goc: Beauty co light skin rieng nhung chua co dark skin scoped; cac rule `.dark ...` global cua Bella chen vao surface, text, button va sidebar cua Beauty. Ngoai ra selector global `[class*="bg-primary"]` match nham ca class hover nhu `hover:bg-primary/5`, lam row/list trong modal bi doi sang mau cu.
- Cach sua: Them Beauty dark palette scoped bang `html.dark[data-tenant-module="beauty_spa"]` va pending dark bootstrap; dung bo mau `#0B1F3A`, `#143A51`, `#746C6B`, `#C49A68`, `#FFD66D` cho body, sidebar, card, input, table va CTA. Bo sung override cho wrapper `bg-background`, toolbar/filter, theme toggle, modal/list item va cac class hover-primary de khong bi global dark Bella match nham.
- Test/guard da them: `src/__tests__/tenant-isolation-source-guards.test.ts` khoa selector dark scoped, token mau chinh, background wrapper, theme toggle va hover-primary guard.
- Bai hoc: Moi module co theme rieng phai co ca light/dark token va guard rieng; khong de `.dark` global cua san pham goc quyet dinh giao dien module moi.

### 2026-06-11 - Beauty F5 flash lop hong truoc khi vao Jade theme

- Module/tenant: Beauty Spa va Bella Spa.
- Man hinh/luong: Dashboard app shell, sidebar/header, theme-color trinh duyet.
- Dau hieu: Khi F5 tai khoan Beauty Spa, UI hien mot lop hong/Bella trong khoanh khac ngan roi moi chuyen sang mau xanh Jade.
- Nguyen nhan goc: Root CSS variables va meta `theme-color` mac dinh Bella/Pink truoc khi client load tenant brand/module; runtime cache chua duoc bootstrap som.
- Cach sua: Them bootstrap script trong root layout cho app routes de set `data-tenant-module="pending"` va CSS variables neutral truoc paint; ghi runtime brand cache vao `sessionStorage` sau khi tenant brand da duoc xac thuc; clear runtime cache khi vao login/logout; cap nhat theme-color khi apply brand.
- Test/guard da them: `npm.cmd run lint`, `npm.cmd run build`, Playwright headless xac nhan early F5 khong con mau hong va reload Beauty vao thang `beauty_spa`/`#074E44`.
- Commit: pending.
- Rui ro con lai: Neu them route app shell moi ngoai `/dashboard` hoac `/ktv`, phai dua route do vao bootstrap guard hoac co layout brand bootstrap rieng.

### 2026-06-11 - Runtime brand cache cu lam Bella/Beauty nhiem mau nhau khi vao dashboard

- Module/tenant: Beauty Spa va Bella Spa.
- Man hinh/luong: Dashboard first paint, auth loading shell, sidebar initial brand.
- Dau hieu: Khi dang nhap chuyen qua lai giua Bella Spa va Beauty Spa trong cung trinh duyet/tab, man hinh dau tien co the hien mau/brand cua tenant truoc do truoc khi ve dung tenant hien tai.
- Nguyen nhan goc: Root bootstrap doc `bella.runtime.brand.v1` tu `sessionStorage` truoc khi biet user/tenant hien tai; sidebar cung khoi tao tu runtime cache cu.
- Cach sua: Root bootstrap chi dat neutral pending tokens va khong doc runtime brand cache; dashboard layout doi `applyDashboardTenantBrandRuntime()` xong moi render children; sidebar khoi tao neutral va chi doc local cache sau khi co `tenant_id` cua current user.
- Test/guard da them: `src/__tests__/tenant-isolation-source-guards.test.ts` khoa root khong doc `sessionStorage.getItem("bella.runtime.brand.v1")`, sidebar khong dung `readRuntimeTenantBrand`, va dashboard apply brand truoc `setIsAuthorized(true)`.
- Bai hoc: Runtime cache chi duoc la toi uu sau khi da co tenant id hien tai. First paint khong duoc tin vao cache theo tab vi tenant co the da doi.

### 2026-06-11 - Appearance brand controls luu nhung khong doi giao dien

- Module/tenant: Beauty Spa white-label.
- Man hinh/luong: Setting > Giao dien & Module, cac tuy chon mau he thong, bo goc, kieu nut va menu.
- Dau hieu: Card `Soft Luxury` van hien hong Bella, nut `Bo goc`, `Kieu nut`, `Menu` co the chon/luu nhung nguoi dung khong thay thay doi ro tren giao dien.
- Nguyen nhan goc: `brand_theme` da co cac field `primaryColor`, `accentColor`, `radiusStyle`, `buttonStyle`, `menuStyle`, nhung runtime root va CSS chua tieu thu day du cac field nay; mot so surface van hard-code mau hong/rose.
- Cach sua: Appearance preview apply CSS variables va `data-tenant-brand-button/menu/radius`; light mode card dung mau brand dang chon; CSS brand controls chi scope trong `html[data-tenant-module="beauty_spa"]` de khong keo Bella ERP sang skin Beauty.
- Test/guard da them: `src/__tests__/tenant-isolation-source-guards.test.ts` khoa `applyBrandThemePreview`, `activeLightModeStyle`, `data-tenant-brand-*`, va CSS token radius/button/menu.
- Bai hoc: Moi setting white-label phai co ba lop: luu config, preview runtime ngay lap tuc, va CSS/component that su tieu thu config. Neu thieu lop 2 hoac 3 thi setting se thanh no-op.

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

## Lo Trinh Mo Rong Salary Engine Da Nganh

> Cap nhat: 2026-06-22
> Ly do: Ghi nhan chien luoc mo rong salary engine de phuc vu nhieu nganh khong can fork code.

### Nguyen Tac Chung

**KHONG BAO GIO tao salary engine moi hoac fork `salary.ts` chi vi co them nganh moi.**

Salary engine hien tai duoc thiet ke de phuc vu moi nganh co cong thuc luong tuong tu. Chi can:
- Thuat ngu nghiep vu khac (Session/Job/Shift/Ca, KTV/Nhan vien/Ky thuat vien)
- Package/service multiplier khac
- Module key khac

Neu cong thuc tinh luong VAN LA:

thi TAI SU DUNG salary engine hien tai, KHONG tao moi.

### Giai Doan 1: Them Nganh Moi Voi Cong Thuc Giong Beauty Spa

**Khong sua `salary.ts`.**

Chi can:
1. Them module moi (vi du `industrial_cleaning`, `home_services`, `elderly_care`)
2. Them Package voi `session_multiplier` phu hop
3. Thay vocabulary UI (KTV → Nhan vien, Session → Ca/Job, Package → Goi dich vu)
4. Chay toan bo salary engine hien tai

**=> Khong can sua cong thuc luong.**

### Giai Doan 2: Bo Sung Component Phu Cap Dac Thu

Neu nganh moi can them phu cap dac thu, **DUNG them component moi, KHONG sua cong thuc tong luong.**

**Van khong can `if (industry === ...)` trong engine.**

### Giai Doan 3: Refactor Sang Rule Engine (CHI KHI CAN THIET)

CHI refactor khi engine bat dau co qua nhieu component (>=5-6 loai) va lap code ro rang. **CHUA CAN LAM BAY GIO.**

### Chuan Bi Tu Bay Gio: WorkUnit Abstraction

De sau nay de refactor, BAT DAU dung khai niem `WorkUnit` ngay bay gio.

### Chuan Bi Tu Bay Gio: Naming Convention

Thay vi `sessionBonus`, doi thanh `sessionComponent` hoac `sessionRuleResult`.

### Checklist Bat Buoc Truoc Moi Thay Doi Salary Engine

```powershell
npm.cmd run test:critical
npm.cmd run lint
npm.cmd run build



### 2026-06-22 - Industrial Cleaning UI/UX Theme và Terminology Compliance

- **Module/tenant**: Industrial Cleaning (module mới), áp dụng pattern cho các ngành B2B tương lai.
- **Màn hình/luồng**: Dashboard, customers, customer detail, booking panel, sidebar theme.
- **Dấu hiệu**: 
  1. Màu text xám nhạt khó đọc trên nền xanh nhạt của Industrial Cleaning theme
  2. Thông tin khách hàng vẫn hiển thị fields Baby Care ("Ngày sinh", "Giới tính")
  3. Badge "Đang có gói liệu trình" không phù hợp với Industrial Cleaning
  4. Buttons và hover states vẫn màu hồng (rose/pink) thay vì blue/teal brand
  5. Terminology hardcoded: "KTV", "Buổi", "gói liệu trình" thay vì dùng vocabulary system
  
- **Nguyên nhân gốc**:
  1. **Text contrast**: CSS theme chỉ set base colors nhưng không override đủ các mức xám (slate-400/500/600, gray-400/500)
  2. **Customer fields**: `getTenantModulePresentationOrNeutral()` không có case cho `industrial_cleaning`, fallback về NEUTRAL
  3. **Badge/UI elements**: Conditional rendering thiếu check `tenantModuleKey !== 'industrial_cleaning'`
  4. **Button colors**: CSS overrides thiếu `bg-rose-500/600`, `hover:bg-rose-600`, và `shadow-rose-*`
  5. **Terminology**: Components không import và dùng `getModuleVocabulary()`, hardcode strings thay vì `vocab.worker.short`, `vocab.workUnit.singular`, `vocab.package.singular`

- **Cách sửa theo thứ tự ưu tiên**:

#### **1. Text Contrast (Highest Priority)**
```css
/* globals.css - Industrial Cleaning theme overrides */
html[data-tenant-module="industrial_cleaning"] {
  --muted-foreground: #334155; /* Tăng từ #475569 → #334155 (slate-700) */
}

html[data-tenant-module="industrial_cleaning"] .text-slate-500 {
  color: #334155 !important; /* slate-700 thay vì slate-600 */
}

html[data-tenant-module="industrial_cleaning"] .text-slate-400 {
  color: #475569 !important; /* slate-600 thay vì slate-500 */
}

html[data-tenant-module="industrial_cleaning"] .text-gray-500 {
  color: #374151 !important; /* gray-700 thay vì gray-600 */
}
```

**Quy tắc**:
- Mỗi màu text xám tăng 1-2 bậc để đủ contrast trên nền sáng
- Không tăng quá đậm trùng với text chính (`#001C44` navy)
- Test trên các màu nền: white, slate-50, blue gradients

#### **2. Customer Presentation (Module-Specific Labels)**
```typescript
// tenant-module-presentation.ts
const INDUSTRIAL_CLEANING_CUSTOMER_PRESENTATION: CustomerPresentation = {
  secondaryInfoTitle: 'Thông tin cơ sở',
  secondaryInfoNameLabel: 'Loại cơ sở / Ghi chú',
  secondaryInfoDateLabel: 'Lịch sử chăm sóc', // Không phải "Ngày sinh"
  secondaryGenderLabel: 'Loại hình cơ sở', // Cho form, ẩn trong detail panel
  // ... other B2B labels
};

// Update getTenantModulePresentationOrNeutral
export function getTenantModulePresentationOrNeutral(
  moduleKey: TenantModuleKey | null | undefined
): CustomerPresentation {
  if (moduleKey === 'beauty_spa') return BEAUTY_SPA_CUSTOMER_PRESENTATION;
  if (moduleKey === 'industrial_cleaning') return INDUSTRIAL_CLEANING_CUSTOMER_PRESENTATION;
  if (moduleKey === 'babycare') return BABYCARE_CUSTOMER_PRESENTATION;
  return NEUTRAL_CUSTOMER_PRESENTATION;
}
```

**Quy tắc**:
- Mỗi module có presentation riêng với labels phù hợp ngữ cảnh
- B2C: "Ngày sinh", "Giới tính"
- B2B: "Lịch sử chăm sóc", "Loại hình cơ sở"
- Fallback NEUTRAL chỉ dùng khi module chưa định nghĩa

#### **3. Conditional Rendering (Hide Irrelevant UI)**
```tsx
// CustomerProfilePanel.tsx
{/* Chỉ hiển thị Giới tính cho babycare và beauty_spa */}
{tenantModuleKey !== 'industrial_cleaning' && (
  <div className="...">
    <span>{customerLabels.secondaryGenderLabel}</span>
    <span>{customer.baby.gender}</span>
  </div>
)}

// customers/page.tsx
{/* Chỉ hiển thị badge cho babycare và beauty_spa */}
{customer.is_in_care && tenantModuleKey !== 'industrial_cleaning' && (
  <motion.div className="beauty-active-care-badge">
    {customerLabels.activeCareBadge}
  </motion.div>
)}
```

**Quy tắc**:
- Badge/field không phù hợp B2B thì conditional hide
- Luôn check `tenantModuleKey` trước khi render
- Không dùng `display: none` trong CSS, dùng conditional JSX

#### **4. Button & Hover Color Overrides**
```css
/* Override rose/pink buttons cho industrial_cleaning */
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-500"],
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-600"] {
  background-color: #2D93AE !important; /* Teal primary */
}

html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-500"]:hover,
html[data-tenant-module="industrial_cleaning"] button[class*="hover:bg-rose-600"] {
  background-color: #0C3776 !important; /* Blue darker hover */
}

html[data-tenant-module="industrial_cleaning"] [class*="shadow-rose-"],
html[data-tenant-module="industrial_cleaning"] [class*="shadow-pink-"] {
  --tw-shadow-color: rgba(45, 147, 174, 0.3) !important; /* Teal shadow */
}
```

**Quy tắc**:
- Override ở CSS level cao với `!important` để không cần sửa từng component
- Cover: `bg-rose-*`, `hover:bg-rose-*`, `shadow-rose-*`, `border-rose-*`
- Primary: Teal (#2D93AE), Hover: Blue (#0C3776)

#### **5. Module Vocabulary System**
```typescript
// ActiveBookingPanel.tsx
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';

export function ActiveBookingPanel({
  tenantModuleKey, // Thêm prop này
  // ... other props
}: {
  tenantModuleKey: TenantModuleKey | null;
  // ... other types
}) {
  const vocab = getModuleVocabulary(tenantModuleKey);
  
  return (
    <>
      <span>{vocab.worker.short} Phụ trách chính</span> {/* "NVS" hoặc "KTV" */}
      <span>Tiến độ {vocab.workUnit.singular.toLowerCase()}</span> {/* "ca làm việc" hoặc "buổi" */}
      <span>Chưa có {vocab.package.singular.toLowerCase()}</span> {/* Dynamic */}
    </>
  );
}
```

**Quy tắc**:
- **KHÔNG BAO GIỜ** hardcode: "KTV", "NVS", "Buổi", "Ca làm việc", "gói liệu trình", "Kỹ thuật viên"
- Client components: Import và call `getModuleVocabulary(tenantModuleKey)`
- Server components: Dùng `getModuleVocabulary()` từ `module-vocabulary.ts`
- Pass `tenantModuleKey` prop từ page/controller xuống child components
- Vocabulary keys:
  - `vocab.worker.singular/plural/short/role`
  - `vocab.workUnit.singular/plural/action`
  - `vocab.service.singular/plural`
  - `vocab.booking.singular/plural/action`
  - `vocab.package.singular/plural`
  - `vocab.customer.singular/plural/context`

- **Test/guard đã thêm**:
  - Visual review: Text contrast trên nền xanh nhạt
  - Manual test: Customer detail page không hiển thị "Giới tính" cho Industrial Cleaning
  - Manual test: Badge "Đang có gói liệu trình" không xuất hiện
  - Manual test: Buttons màu teal/blue thay vì rose/pink
  - Build passed: TypeScript 41s, 74 routes, no errors
  
- **Commits**:
  - `324e87d9`: Text contrast improvements
  - `1c729881`: Customer info fields + badge removal
  - `e7abe72c`: Pink buttons/hover overrides
  - `82832dc3`: Module vocabulary system

- **Rủi ro còn lại**:
  1. Các components khác có thể còn hardcode terminology - cần audit toàn bộ dashboard components
  2. Dark mode của Industrial Cleaning chưa được test kỹ
  3. Mobile theme chưa được verify trên device thật
  4. Booking flow có thể còn terminology Baby Care trong modals/wizards
  5. Error messages/toasts có thể còn hardcode terms

- **Checklist cho module mới tương lai**:

**Phase 4c - UI/UX Theme Compliance (BẮT BUỘC trước go-live)**

1. **Text Contrast Audit**:
   - [ ] Kiểm tra tất cả màu text: slate-300/400/500/600, gray-300/400/500/600
   - [ ] Test trên tất cả màu nền: white, slate-50, module-specific gradients
   - [ ] Muted text phải đủ contrast (tối thiểu 4.5:1 WCAG AA)
   - [ ] Không được trùng màu với text chính (foreground)

2. **Customer/Entity Presentation**:
   - [ ] Tạo `<MODULE>_CUSTOMER_PRESENTATION` trong `tenant-module-presentation.ts`
   - [ ] Override tất cả labels: `secondaryInfoTitle`, `secondaryInfoNameLabel`, `secondaryInfoDateLabel`, `secondaryGenderLabel`
   - [ ] Update `getTenantModulePresentationOrNeutral()` với case mới
   - [ ] Conditional hide fields không phù hợp: check `tenantModuleKey !== '<module>'`

3. **Badge & UI Elements**:
   - [ ] Tìm tất cả badge/tag/pill liên quan ngành cũ: `rg "beauty-active-care-badge|Đang có gói"`
   - [ ] Conditional render hoặc update text theo module
   - [ ] Icons và decorations phải phù hợp ngữ cảnh

4. **Color Palette Override**:
   - [ ] Định nghĩa color palette trong globals.css: primary, hover, accent, text, background
   - [ ] Override tất cả màu ngành cũ:
     ```css
     html[data-tenant-module="<module>"] button[class*="bg-rose-"] { ... }
     html[data-tenant-module="<module>"] [class*="text-rose-"] { ... }
     html[data-tenant-module="<module>"] [class*="border-rose-"] { ... }
     html[data-tenant-module="<module>"] [class*="shadow-rose-"] { ... }
     ```
   - [ ] Test hover states, focus rings, active states
   - [ ] Đảm bảo CTA buttons có contrast cao, không bị mờ nhạt

5. **Module Vocabulary System**:
   - [ ] Định nghĩa vocabulary trong `module-vocabulary.ts`:
     ```typescript
     const <MODULE>_VOCABULARY: ModuleVocabulary = {
       worker: { singular, plural, short, role },
       workUnit: { singular, plural, action },
       service: { singular, plural },
       booking: { singular, plural, action },
       package: { singular, plural },
       customer: { singular, plural, context },
     };
     ```
   - [ ] Update `getModuleVocabulary()` với case mới
   - [ ] Audit toàn bộ components: `rg "KTV|Buổi|liệu trình|Kỹ thuật viên"`
   - [ ] Thay hardcoded strings bằng `vocab.*` trong components
   - [ ] Pass `tenantModuleKey` prop từ pages xuống components
   - [ ] Test terminology hiển thị đúng cho mỗi module

6. **Comprehensive Search Patterns**:
   ```powershell
   # Text hardcoded ngành cũ
   rg "KTV|Kỹ thuật viên|Buổi|Ca làm|liệu trình|Mẹ|Bé|Combo|Massage|Tắm" src/app/dashboard --type tsx
   
   # Màu hồng/rose cần override
   rg "rose-[0-9]|pink-[0-9]|bg-rose|text-rose|border-rose|shadow-rose" src/app/dashboard --type tsx
   
   # Customer fields có thể không phù hợp
   rg "Ngày sinh|Giới tính|dob_baby|gender_baby" src/app/dashboard --type tsx
   
   # Badge/active states
   rg "active-care-badge|Đang có gói|is_in_care" src/app/dashboard --type tsx
   ```

7. **Visual Regression Checklist**:
   - [ ] Desktop: Sidebar theme đúng màu, text đủ contrast
   - [ ] Desktop: Customer list, detail, booking panel đúng terminology
   - [ ] Desktop: Buttons hover states đúng brand colors
   - [ ] Mobile: Tất cả elements responsive, text readable
   - [ ] Dark mode: Theme switching hoạt động (nếu support)
   - [ ] F5/Hard refresh: Không flash theme/brand sai
   - [ ] Loading states: Neutral hoặc module-specific, không flash ngành cũ

8. **Documentation**:
   - [ ] Update `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` với module mới
   - [ ] Screenshot theme trước/sau để reference
   - [ ] Ghi lại color palette, vocabulary mappings
   - [ ] Update `docs/implementation-artifacts/spec-<module>.md`

**Tools để audit nhanh**:
```powershell
# Tìm hardcoded terminology
rg "\"(KTV|Buổi|liệu trình)\"" src/app/dashboard --type tsx

# Tìm màu rose/pink chưa override
rg "className=\"[^\"]*rose-[0-9]" src/app/dashboard --type tsx

# Tìm components chưa dùng vocabulary
rg "import.*from.*components" src/app/dashboard/**/*.tsx | rg -v "getModuleVocabulary|useModuleVocabulary"

# Check contrast (manual visual)
# Đổi module sang industrial_cleaning, check màu text trên sidebar, cards, tables
```

**Lesson Learned Summary**:
1. ✅ **CSS overrides ở high level > sửa từng component**: Dùng `html[data-tenant-module]` selector với `!important`
2. ✅ **Vocabulary system > hardcode strings**: Centralized, dễ maintain, không miss
3. ✅ **Conditional rendering > CSS hide**: JSX conditional rõ ràng hơn `display: none`
4. ✅ **Text contrast là priority #1**: User không thể dùng nếu không đọc được
5. ✅ **Build thành công ≠ UI đúng**: Cần visual verification và manual testing
6. ✅ **Search exhaustively**: `rg` toàn bộ patterns trước khi claim "done"
7. ❌ **Không giả định CSS theme đã đủ**: Luôn verify trên UI thật với module mới
8. ❌ **Không skip presentation layer**: CustomerPresentation, vocabulary phải setup đầy đủ

**Anti-patterns cần tránh**:
- ❌ Hardcode "KTV", "Buổi", "liệu trình" trong JSX
- ❌ Dùng `display: none` cho conditional UI, thay vì JSX conditional
- ❌ Chỉ override một phần màu (bg nhưng quên shadow, border, hover)
- ❌ Quên pass `tenantModuleKey` prop xuống child components
- ❌ Fallback về NEUTRAL hoặc BABYCARE khi module mới chưa có presentation
- ❌ Giả định "build pass = UI đúng"
- ❌ Không test trên màu nền đa dạng (white, slate, gradients)
- ❌ Copy-paste component cũ mà không audit terminology



### 2026-06-22 - Industrial Cleaning: Offline sync stuck, sidebar hardcoded, date picker duplicate icons

- Module/tenant: Industrial Cleaning (CleanPro), nhưng ảnh hưởng tất cả modules.
- Màn hình/luồng: Offline sync banner, Sidebar menu labels, Session edit modal date/time pickers.
- Dấu hiệu: 
  1. Offline sync banner "Đang chờ đồng bộ" stuck sau khi bấm "Đồng bộ ngay" vì actions với status `'syncing'` không được query lại
  2. Sidebar label hardcoded "Phiếu công việc" (Industrial Cleaning term) cho tất cả modules thay vì dynamic theo vocabulary
  3. Date/time pickers hiển thị 2 icons giống nhau (custom icon + native browser icon) overlap trên mobile
- Nguyên nhân gốc:
  1. `triggerSync()` trong `useOfflineSync.ts` chỉ query actions với status `['pending', 'failed']`, thiếu `'syncing'`. Khi `syncOfflineAction()` set status thành `'syncing'` nhưng fail trước khi delete, actions застряли навсегда
  2. Sidebar dùng logic `tenantBrand.moduleKey === 'industrial_cleaning' ? 'Phiếu công việc'` thay vì dùng vocabulary system
  3. Date inputs có cả custom icon (với `pointer-events-none`) và native browser icon, chưa hide custom icon trên mobile
- Cách sửa:
  1. Thêm `'syncing'` vào query filter: `.in('status', ['pending', 'failed', 'syncing'])`
  2. Sửa sidebar logic thành: `moduleKey === 'industrial_cleaning' ? vocab.booking.singular : moduleKey === 'beauty_spa' ? 'Liệu trình' : 'Thẻ liệu trình'`
  3. Thêm `hidden md:block` cho custom icons và adjust padding: `pl-3 md:pl-11`
- Test/guard đã thêm: Manual test offline sync retry, sidebar labels across modules, mobile date picker visual check
- Commit: `41096e17`, `8adb8ce9`
- Rủi ro còn lại: Offline sync vẫn có thể bị race condition nếu nhiều tabs cùng sync; sidebar cần refactor dùng vocabulary system toàn bộ thay vì hardcode conditions

### 2026-06-22 - Industrial Cleaning: CleanPro demo data seed errors and tenant isolation

- Module/tenant: Industrial Cleaning (CleanPro)
- Màn hình/luồng: Demo data seeding via Supabase SQL Editor
- Dấu hiệu: 
  1. SQL syntax error: `INTERVAL (3-i)` không hợp lệ trong PostgreSQL
  2. Constraint violation: `bookings.status = 'active'` không thuộc enum hợp lệ (`inquiry`, `deposit_pending`, `booked`, `in_progress`, `completed`, `cancelled`)
  3. NOT NULL violation: `session_logs.tenant_id` bị thiếu trong INSERT statements
  4. Verification query cho thấy 22 customers, 19 workers, 48 bookings thay vì 5/5/8 như mong đợi → dữ liệu cũ chưa được cleanup
- Nguyên nhân gốc:
  1. Biểu thức `(3-i)` không thể dùng trực tiếp trong INTERVAL string concatenation
  2. Status `'active'` không phải giá trị hợp lệ theo constraint `bookings_status_check`
  3. Bảng `session_logs` yêu cầu `tenant_id NOT NULL` nhưng INSERT không có field này
  4. Script chạy nhiều lần hoặc trên database đã có dữ liệu CleanPro cũ
- Cách sửa:
  1. Thay `(3-i)` bằng explicit CASE: `CASE WHEN i = 1 THEN (CURRENT_DATE - INTERVAL '2 days')::date WHEN i = 2 THEN (CURRENT_DATE - INTERVAL '1 day')::date ELSE NULL END`
  2. Đổi status từ `'active'` → `'in_progress'` (8 bookings)
  3. Thêm `tenant_id` vào INSERT columns và values: `INSERT INTO session_logs (booking_id, tenant_id, session_number, ...)`
  4. Tạo cleanup script `MANUAL_cleanup_cleanpro_data.sql` để xóa dữ liệu cũ trước khi seed
- Test/guard đã thêm: Verification query kiểm tra counts (5 customers, 5 workers, 8 bookings, 64 sessions), README hướng dẫn cleanup → seed workflow
- Commit: `72f2d6b6`, `a5052517`, `418bc196`, `331e776c`, `7f3a57c0`
- Files: 
  - `supabase/migrations/MANUAL_seed_cleanpro_complete_demo_data.sql` - Seed 5 customers, 5 NVS, 8 bookings, 64 sessions
  - `supabase/migrations/MANUAL_cleanup_cleanpro_data.sql` - Cleanup script
  - `supabase/migrations/MANUAL_cleanpro_seed_README.md` - Step-by-step guide
- Rủi ro còn lại: Script dùng DO $$ block nên không rollback từng phần; nếu fail giữa chừng phải cleanup và seed lại toàn bộ

### 2026-06-22 - Industrial Cleaning: Pink/beige color contrast issues

- Module/tenant: Beauty Spa và Industrial Cleaning (ảnh hưởng cả Bella Spa khi chưa load module)
- Màn hình/luồng: Leaderboard podiums, buttons, backgrounds với `bg-rose-*`, `bg-pink-*`, `text-slate-*`
- Dấu hiệu:
  1. Màu hồng hệ thống bị thay bằng màu be/xám `rgba(200, 169, 122, 0.12)` làm mất tương phản
  2. Chữ xám nhạt (`text-slate-700`, `text-slate-600`, `text-slate-500`) khó đọc nhưng không được đậm quá trùng màu đen
  3. Bục vinh danh rank 2, 3 trong leaderboard bị nhạt không rõ
- Nguyên nhân gốc:
  1. `globals.css` override `bg-rose-50/100/pink-50/100` thành beige `rgba(200, 169, 122, 0.12)` cho Beauty Spa, quá nhạt
  2. Tailwind default `text-slate-700` là `rgb(51, 65, 85)` nhưng không được enforce trong beauty_spa module
  3. `bg-rose-200` và `bg-slate-200` chưa có override nên dùng Tailwind default (quá nhạt)
- Cách sửa:
  1. Override `bg-rose-50/100/pink-50/100` thành light pink `rgba(255, 228, 230, 0.85)` thay vì beige
  2. Thêm override cho `bg-rose-200/pink-200` → `rgba(251, 207, 232, 0.92)` (stronger pink cho rank 3)
  3. Thêm override cho `bg-slate-200/100/50` với full opacity
  4. Thêm override `text-slate-700/600/500` → `rgb(51, 65, 85)` (darker gray)
  5. Thêm override `text-slate-400/300` → `rgb(100, 116, 139)` (medium gray cho secondary text)
- Test/guard đã thêm: Visual check leaderboard podiums, buttons, text contrast
- Commit: `1f599468`
- Rủi ro còn lại: Cần kiểm tra toàn bộ UI components sử dụng rose/pink/slate colors để đảm bảo contrast; dark mode cũng cần review tương tự

### 2026-06-22 - Module Vocabulary: Default to NEUTRAL instead of Beauty Spa

- Module/tenant: Tất cả modules, đặc biệt Industrial Cleaning
- Màn hình/luồng: Bảng lương (`/dashboard/salary`), tất cả trang sử dụng `useModuleVocabulary()`
- Dấu hiệu:
  1. Trang bảng lương ban đầu hiển thị "Lương **Kỹ thuật viên**" (Beauty Spa term) trước khi chuyển thành "Lương **Nhân viên vệ sinh**" (Industrial Cleaning)
  2. User Industrial Cleaning thấy vocabulary KTV trong khoảng thời gian ngắn khi trang đang load
  3. Hook `useTenantModuleKey()` initialize với `null`, khiến `getModuleVocabulary(null)` trả về Beauty Spa vocabulary
- Nguyên nhân gốc:
  1. `useTenantModuleKey()` state khởi tạo: `const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey | null>(null)`
  2. `getModuleVocabulary(null)` default về `BEAUTY_BABYCARE_VOCABULARY` thay vì neutral
  3. Trang không check `isTenantModuleLoading` nên render ngay với vocabulary sai
- Cách sửa:
  1. Tạo `NEUTRAL_VOCABULARY` với thuật ngữ trung lập:
     - `worker`: "Nhân viên" (thay vì "Kỹ thuật viên" hoặc "Nhân viên vệ sinh")
     - `workUnit`: "Ca làm việc" 
     - `service`: "Dịch vụ"
     - `booking`: "Đơn hàng"
  2. Sửa `getModuleVocabulary()` logic:
     - `moduleKey === 'industrial_cleaning'` → `CLEANING_VOCABULARY`
     - `moduleKey === 'beauty_spa' || 'babycare'` → `BEAUTY_BABYCARE_VOCABULARY`
     - `else` (null/undefined) → `NEUTRAL_VOCABULARY`
- Test/guard đã thêm: Visual check trang salary load ban đầu, verify không thấy "Kỹ thuật viên" khi moduleKey chưa load
- Commit: `010c4555`
- Rủi ro còn lại: 
  - Browser cache có thể giữ bản build cũ, cần hard refresh (`Ctrl+Shift+R`)
  - Nếu neutral vocabulary không đủ rõ ràng cho user, có thể cần skeleton/loading state thay vì hiển thị neutral text

### 2026-06-22 - User Guides: Module-specific instead of hardcoded Bella Spa

- Module/tenant: Tất cả modules (Bella Spa, Beauty Spa, Industrial Cleaning)
- Màn hình/luồng: Hướng dẫn sử dụng (`/dashboard/guides`)
- Dấu hiệu:
  1. Trang guides hiển thị "Sổ tay Kỹ thuật viên", "Combo Mẹ & Bé", "KTV" cho tất cả modules
  2. Industrial Cleaning users thấy guides về chăm sóc mẹ và bé
  3. Beauty Spa users thấy guides về baby care thay vì spa làm đẹp
- Nguyên nhân gốc:
  1. `ALL_GUIDES` constant trong `user-manuals-utils.ts` hardcoded cho Bella Spa (Baby Care)
  2. Guides page không dùng `useTenantModuleKey()` để filter guides theo module
  3. Chưa có guides riêng cho Beauty Spa và Industrial Cleaning
- Cách sửa:
  1. Tạo 3 bộ guides riêng:
     - `BABYCARE_GUIDES`: Quy trình SOP, Sổ tay KTV, HR, Kế toán, Quản trị viên
     - `BEAUTY_SPA_GUIDES`: Quy trình SOP Spa, Sổ tay Chuyên viên (Therapist), HR Spa, Kế toán Spa
     - `CLEANING_GUIDES`: Quy trình SOP Vệ sinh, Sổ tay NVS (Worker), Giám sát (Supervisor), HR Dịch vụ, Kế toán B2B
  2. Thêm function `getModuleGuides(moduleKey)` để lấy guides theo module
  3. Cập nhật guides page:
     - Import `useTenantModuleKey` và `getModuleGuides`
     - Load guides: `const moduleGuides = getModuleGuides(tenantModuleKey)`
     - Re-load khi `tenantModuleKey` thay đổi: `useEffect(..., [tenantModuleKey])`
  4. Giữ `ALL_GUIDES` export cho backward compatibility (deprecated)
- Test/guard đã thêm: Visual check guides page cho 3 modules, verify không thấy KTV/Baby Care guides trong CleanPro
- Commit: `223aebbf`
- Files:
  - `src/services/user-manuals-utils.ts` - Module-specific guides definitions
  - `src/app/dashboard/guides/page.tsx` - Dynamic guide loading
- Rủi ro còn lại:
  - Guides slugs hiện tại (sop, ktv, hr, v.v.) chưa có nội dung markdown thực tế
  - Cần tạo dynamic routes `/dashboard/guides/[slug]/page.tsx` cho từng module
  - Hoặc tạo mapping slug → module-specific content files

### 2026-06-28 - Two-Tone Sidebar Background Color Discrepancy on Babycare Module

- Module/tenant: Baby Care / Default (Bella Spa)
- Màn hình/luồng: Sidebar Menu / Layout Shell
- Dấu hiệu:
  1. Khu vực thanh điều hướng Menu (thẻ `nav` ở giữa) hiển thị màu hồng đậm hơn so với khu vực Logo (phía trên) và Profile (phía dưới), gây lệch 2 tông màu trên sidebar.
- Nguyên nhân gốc:
  1. Hai đốm sáng trang trí (`bg-pink-300/30` và `bg-rose-300/25`) đè lên sidebar và không thể bị ẩn triệt để qua class selector CSS (như `.bg-pink-300\/30`) do xung đột đóng gói class của Tailwind v4.
  2. Mặc dù `aside` đã được cấu hình màu nền `#FFF0F3` (hồng nhạt), thẻ `nav` bên trong không có background cụ thể nên bị ảnh hưởng sắc độ hoặc bị lọt sáng từ đốm nền.
- Cách sửa:
  1. Ẩn vĩnh viễn hai đốm sáng trang trí bằng cách thêm trực tiếp class `hidden` vào thuộc tính class trong mã nguồn React của [sidebar.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/components/layout/sidebar.tsx).
  2. Thêm quy định CSS cụ thể cho `.beauty-erp-sidebar nav` trong [globals.css](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/globals.css) để cưỡng chế màu nền của `nav` khớp hoàn toàn với màu `#FFF0F3` (Light mode) và linear-gradient (Dark mode) của `aside`.
- Test/guard đã thêm: Build verification thành công, chạy kiểm thử Jest `tenant-isolation-source-guards.test.ts` vượt qua 100%.
- Commit: `659c6f3e` (và `50328405`)
- Rủi ro còn lại: Không có, bộ chọn CSS đã được khóa chặt sau selector phân hệ `html[data-tenant-module="baby_care"]` và `html[data-tenant-module="babycare"]` đảm bảo không tác động tới giao diện các ngành khác.

## Industrial Cleaning Module: Tổng Kết Và Bài Học

### Session 2026-06-22: 10 Lỗi Đã Sửa

1. **Offline sync stuck** - Thêm `'syncing'` status vào query filter
2. **Sidebar hardcoded** - Cần refactor dùng vocabulary system
3. **Date picker duplicate icons** - Hide custom icons trên mobile
4. **CleanPro seed SQL syntax** - Fix INTERVAL expression
5. **Booking status constraint** - Đổi `'active'` → `'in_progress'`
6. **Session tenant_id missing** - Thêm tenant_id vào INSERT
7. **Demo data không cleanup** - Tạo cleanup script
8. **Color contrast issues** - Override pink/beige backgrounds và gray text
9. **Vocabulary KTV flash** - Default NEUTRAL thay vì Beauty Spa
10. **Guides hardcoded Bella** - Module-specific guides cho 3 modules

### Pattern Lỗi Chung Cần Tránh

#### 1. **Database Schema Constraints**
- ❌ **Sai:** Dùng giá trị không có trong CHECK constraint (`'active'` không thuộc bookings_status enum)
- ✅ **Đúng:** Kiểm tra constraint definitions trước khi seed: `\d+ table_name` hoặc grep migrations
- 🔧 **Guard:** Unit test insert với tất cả giá trị enum hợp lệ

#### 2. **PostgreSQL Date/Time Expressions**
- ❌ **Sai:** `INTERVAL (3-i) || ' days'` - biểu thức động không hợp lệ
- ✅ **Đúng:** Dùng CASE WHEN explicit: `CASE WHEN i = 1 THEN ... WHEN i = 2 THEN ... END`
- 🔧 **Guard:** Test seed script trên local database trước khi commit

#### 3. **NOT NULL Violations**
- ❌ **Sai:** INSERT thiếu required columns như `tenant_id`
- ✅ **Đúng:** Kiểm tra schema `\d+ table_name`, verify tất cả NOT NULL columns
- 🔧 **Guard:** TypeScript types từ Supabase codegen, hoặc RPC với typed params

#### 4. **Demo Data Cleanup**
- ❌ **Sai:** Chạy seed nhiều lần không cleanup → dữ liệu duplicate/wrong counts
- ✅ **Đúng:** Tạo cleanup script chạy TRƯỚC seed, verify counts = 0
- 🔧 **Guard:** Verification query ở cuối seed script, README với workflow rõ ràng

#### 5. **UI Color Contrast**
- ❌ **Sai:** Override backgrounds thành màu nhạt/beige mất tương phản
- ✅ **Đúng:** Test contrast ratio (WCAG AA: 4.5:1 cho text), giữ colors rõ ràng
- 🔧 **Guard:** Visual review trên device thực, check dark mode

#### 6. **Vocabulary Default State**
- ❌ **Sai:** Default về vocabulary của module cũ (Beauty Spa) khi chưa load
- ✅ **Đúng:** Default về NEUTRAL vocabulary hoặc loading skeleton
- 🔧 **Guard:** Test first render với `tenantModuleKey = null`

#### 7. **Content Hardcoding**
- ❌ **Sai:** Hardcode terms/guides của module cũ trong shared pages
- ✅ **Đúng:** Module-aware content system với dynamic loading
- 🔧 **Guard:** Grep codebase cho hard-coded terms: `rg "Kỹ thuật viên|KTV|Mẹ & Bé"`

### Checklist Cho Module Mới (Updated)

Trước khi coi module mới là "xong":

**Database & Schema:**
- [ ] Verify tất cả CHECK constraints và enum values
- [ ] Kiểm tra NOT NULL columns trong schema
- [ ] Test seed script trên local database trước
- [ ] Tạo cleanup script với verification
- [ ] README hướng dẫn cleanup → seed workflow

**UI & UX:**
- [ ] Test color contrast (WCAG AA minimum)
- [ ] Check mobile date pickers không duplicate icons
- [ ] Verify sidebar/menu labels dùng vocabulary
- [ ] Test first-paint không flash wrong vocabulary
- [ ] Hard refresh browser để test từ clean state

**Vocabulary & Content:**
- [ ] Tạo NEUTRAL vocabulary cho loading state
- [ ] Module-specific guides/help content
- [ ] Grep toàn bộ codebase cho hardcoded terms
- [ ] Test với `tenantModuleKey = null`

**Offline & Sync:**
- [ ] Query offline actions bao gồm tất cả status states
- [ ] Test offline → online → sync flow
- [ ] Verify sync không stuck sau retry

**Deployment:**
- [ ] Clear `.next/` cache: `Remove-Item -Recurse -Force .next`
- [ ] Build thành công: `npm run build`
- [ ] Push commits: `git push origin main`
- [ ] Hard refresh trên production: `Ctrl+Shift+R`

### Files Quan Trọng Cần Review Cho Module Mới

```
src/lib/business-rules/module-vocabulary.ts       # Vocabulary definitions
src/services/user-manuals-utils.ts                # Guides/help content
src/app/dashboard/guides/page.tsx                 # Guides UI
src/app/globals.css                                # Module-scoped CSS
src/hooks/useModuleVocabulary.ts                  # Vocabulary hook
src/hooks/useTenantModuleKey.ts                   # Module key hook
src/components/layout/sidebar.tsx                 # Sidebar labels
supabase/migrations/MANUAL_seed_*.sql             # Demo data scripts
supabase/migrations/MANUAL_cleanup_*.sql          # Cleanup scripts
docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md      # This file (!)
```

### Workflow Chuẩn Khi Thêm Module Mới

1. **Discovery** → Spec → Vocabulary mapping
2. **Schema** → Constraints → NOT NULL check → RLS
3. **Seed data** → Test locally → Cleanup script → README
4. **Vocabulary** → NEUTRAL default → Module-specific
5. **Guides** → Module-specific content
6. **UI** → Color contrast → Mobile check
7. **Build** → Clear cache → Test → Push
8. **Verify** → Hard refresh → Cross-module test
9. **Document** → Update playbook với lỗi mới

**Thời gian ước lượng:** 
- Simple module (chỉ vocabulary + guides): 2-4 giờ
- Medium module (+ schema + seed): 1-2 ngày  
- Complex module (+ business logic + accounting): 3-5 ngày

**Nhớ:** Mỗi lỗi mới phải được document ngay trong playbook này để module sau không lặp lại!

### 2026-06-28 - Lỗi trang quản lý dịch vụ trống trơn và nút thêm dịch vụ bị đơ ở phân hệ mới (Industrial Cleaning)

- **Phân hệ/Tenant**: `industrial_cleaning` (Dịch vụ vệ sinh) và các phân hệ mới được kích hoạt độc lập.
- **Màn hình/Luồng**: Quản lý dịch vụ (`/dashboard/services`), Modal Thêm/Sửa dịch vụ.
- **Dấu hiệu**:
  1. Trang dịch vụ của chi nhánh mới trống trơn ("Chưa có dịch vụ nào") dù dữ liệu mẫu đã được seed thành công ở database.
  2. Nút "Thêm dịch vụ mới" khi click hoàn toàn bị đơ, không mở được Modal.
- **Nguyên nhân gốc**:
  1. **Lỗi dữ liệu trống**: Dữ liệu mẫu (seeding) của Dịch vụ vệ sinh được nạp dưới dạng HQ templates (`tenant_id = null`), trong khi trang quản lý dịch vụ chi nhánh chỉ truy vấn các dịch vụ thuộc sở hữu riêng của tenant (`tenant_id = auth.tenantId`). Ban đầu, tính năng "Đồng bộ gói mặc định" chỉ hỗ trợ cứng cho phân hệ `babycare` và bị ẩn đi đối với các phân hệ khác, khiến chi nhánh mới không thể sao chép các gói mẫu về làm bản nháp của mình.
  2. **Lỗi đơ nút thêm**: Kiểu dữ liệu tham số trong hàm cập nhật `setModuleKey` và logic chuyển hướng trong `openEditModal` của hook `useServicesPageState` bị giới hạn cứng kiểu `'babycare' | 'beauty_spa'`. Khi click "Thêm dịch vụ mới", hàm `resetForm` cố gắng khởi tạo `moduleKey` là `'industrial_cleaning'`, gây ra lỗi bất tương thích kiểu dữ liệu và làm đơ luồng xử lý React state mở modal.
- **Cách sửa**:
  1. **Hỗ trợ đồng bộ đa phân hệ**: Cập nhật hàm `createDefaultPackages` để nhận `moduleKey` và trả về các gói dịch vụ mẫu tương ứng (`babycare` có 8 gói, `industrial_cleaning` có 3 gói mẫu, `beauty_spa` có 3 gói mẫu).
  2. **Tự động nhận diện phân hệ để đồng bộ**: Cập nhật `syncDefaultPackages` tự động kiểm tra xem phân hệ nào của tenant đang được kích hoạt và đồng bộ đúng tập gói mẫu tương ứng về chi nhánh dưới dạng bản nháp.
  3. **Mở rộng phạm vi hiển thị nút đồng bộ**: Cho phép hiển thị nút "Đồng bộ gói mặc định" khi có bất kỳ phân hệ chính nào (`babycare`, `industrial_cleaning`, `beauty_spa`) được kích hoạt.
  4. **Chuẩn hóa kiểu dữ liệu**: Đổi kiểu tham số hàm `setModuleKey` thành kiểu chung `ServiceModuleKey` (chứa cả `'industrial_cleaning'`). Cập nhật `openEditModal` và PremiumSelect ở biểu mẫu modal để xử lý/ép kiểu an toàn sang `ServiceModuleKey`.
- **Test/guard đã thêm**: Chạy bộ test Jest `package-actions.test.ts` và `industrial-cleaning-module-isolation.test.ts` đều vượt qua 100%. Next.js production build biên dịch thành công.
- **Commit**: `71fbaa0d`
- **Files**:
  - [useServicesPageState.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/dashboard/services/hooks/useServicesPageState.ts) - Cập nhật đồng bộ gói mẫu và sửa kiểu dữ liệu.
  - [page.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/dashboard/services/page.tsx) - Cập nhật hiển thị nút đồng bộ và xử lý ép kiểu an toàn trong Modal Form.
- **Rủi ro còn lại**: Cần kiểm tra xem khi có tenant bật đồng thời nhiều phân hệ chính (multi-module) thì nút đồng bộ sẽ hoạt động như thế nào; hiện tại nút sẽ ưu tiên đồng bộ theo phân hệ có thứ tự kiểm tra (`industrial_cleaning` -> `beauty_spa` -> `babycare`).

### 2026-06-28 - Lỗi độ tương phản màu chữ thẻ KPI, sập màu nền gradient, phân tách màu và bảng đối soát tài chính / lương không full box

- **Phân hệ/Tenant**: `industrial_cleaning` (Dịch vụ vệ sinh) và các phân hệ dùng chung (`core` / `accounting` / `finance` / `ai_copilot`).
- **Màn hình/Luồng**: Đối soát tài chính (`/dashboard/finance/reconciliation`) và Đối soát lương (`/dashboard/ai-copilot/salary-reconciliation` & `/dashboard/accounting/salary-reconciliation`).
- **Dấu hiệu**:
  1. Chữ số hiển thị trong các box KPI (như `120.000.000`) bị đổi thành màu trắng nhạt/xám đậm trùng với nền hoặc biến mất hoàn toàn không đọc được.
  2. Bảng số liệu bị phân tách 2 màu không đồng đều (cột đầu tiên màu trắng, các cột sau màu xám nhạt).
  3. Bảng đối soát tài chính và đối soát lương bị co cụm về góc trái, không chiếm hết không gian chiều ngang của thẻ chứa (không full box).
- **Nguyên nhân gốc**:
  1. **Lỗi chữ KPI khó đọc**: Global heading rule (`h1, h2, h3 { color: var(--foreground) }`) đã ghi đè màu chữ của tiêu đề thẻ KPI, biến chữ màu trắng nguyên bản thành màu Navy tối của phân hệ vệ sinh, gây mất độ tương phản trên nền gradient tối.
  2. **Lỗi sập màu gradient**: Lớp phủ gradient trong `globals.css` sử dụng các biến vị trí từ Tailwind v3 như `var(--tw-gradient-from-position)`, không còn tương thích hoặc bị bỏ qua trong Tailwind CSS v4, làm màu nền bị sập hoặc biến thành trong suốt/trắng.
  3. **Lỗi phân tách 2 màu ở bảng**: Việc sử dụng bộ chọn thuộc tính dạng substring `[class*="bg-slate-50"]` và `[class*="bg-rose-50"]` trong CSS phân hệ vệ sinh đã vô tình ghi đè toàn bộ các ô có class biến thể (như `hover:bg-slate-50/50` hay `even:bg-slate-50`), làm sai lệch màu sắc các dòng/cột của bảng đối soát.
  4. **Lỗi không full width**: Các bảng biểu đối soát (`table`) thiếu class `w-full` (hoặc đang cấu hình `w-max` thay vì `w-full`), trong khi có thuộc tính `min-w` cố định nên không giãn đều theo khung chứa trên màn hình rộng.
- **Cách sửa**:
  1. **Cưỡng chế màu chữ trắng**: Thêm trực tiếp class `text-white` vào các thẻ `h3` hiển thị tiền trong `ReconciliationKpiCards.tsx` để ghi đè quy tắc CSS global.
  2. **Chuẩn hóa gradient v4 & bộ chọn class**: Trong `globals.css`, loại bỏ các biến `*-position` thừa ở 4 khối override gradient, thay thế bộ chọn substring `[class*="bg-slate-50"]` thành class chính xác `.bg-slate-50`, `.bg-rose-50`, và bổ sung quy tắc `.bella-data-table tr:hover td` đồng đều cho phân hệ vệ sinh.
  3. **Full Width Tables**: Thêm class `w-full` vào 3 thẻ `table` trong trang đối soát tài chính (`reconciliation/page.tsx`) và table trong `salary-reconciliation-client.tsx`, đồng thời đổi `tableClassName` từ `w-max` thành `w-full` trong trang đối soát lương kế toán `salary-reconciliation/page.tsx`.
- **Test/guard đã thêm**: Chạy bộ test Jest `reconciliation.test.ts` và `industrial-cleaning-module-isolation.test.ts` đều vượt qua 100%. Next.js production build biên dịch thành công.
- **Commit**: pending.
- **Files**:
  - [globals.css](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/globals.css) - Sửa đổi CSS gradient v4 và bộ chọn màu nền.
  - [ReconciliationKpiCards.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/dashboard/finance/reconciliation/components/ReconciliationKpiCards.tsx) - Thêm text-white vào h3.
  - [page.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/dashboard/finance/reconciliation/page.tsx) - Thêm w-full vào table đối soát tài chính.
  - [salary-reconciliation-client.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/dashboard/ai-copilot/salary-reconciliation/salary-reconciliation-client.tsx) - Thêm w-full vào table đối soát lương AI.
  - [page.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/app/dashboard/accounting/salary-reconciliation/page.tsx) - Đổi w-max thành w-full ở tableClassName đối soát lương kế toán.
- **Rủi ro còn lại**: Không có. Quy tắc CSS đã được đóng gói chính xác bằng các lớp cụ thể, không còn nguy cơ ghi đè nhầm các class Tailwind động của trang khác.



---

## Case Study: Commission System Extension (June 2026)

> Bài học từ việc mở rộng hệ thống hoa hồng cho Bella Spa ERP
> 
> **Bối cảnh:** Hệ thống ban đầu chỉ có hoa hồng cố định theo ca làm (session-based commission) cho module Baby Care. Cần mở rộng để hỗ trợ nhiều loại hoa hồng: service-level commission, product sales commission, position bonus, seniority bonus, và manual adjustments.
> 
> **Timeline:** 2 tuần (10-22 June 2026)
> 
> **Kết quả:** Hoàn thành 36/40 tasks, 130+ tests passed, 0 breaking changes cho code cũ

### Extension Patterns Đã Áp Dụng

#### 1. Database Schema Extension (Non-Breaking)

**Pattern:** Add new tables và new columns, KHÔNG sửa tables/columns hiện có

```sql
-- ✅ CORRECT: Add new tables for new features
CREATE TABLE booking_service_items (
  id UUID PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  service_name TEXT NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  calculated_commission NUMERIC(12,2) NOT NULL,
  override_commission_type commission_type,
  override_commission_value NUMERIC(10,2),
  -- ...
);

CREATE TABLE product_sales (
  id UUID PRIMARY KEY,
  ktv_id UUID REFERENCES users(id),
  product_name TEXT NOT NULL,
  sale_amount NUMERIC(12,2) NOT NULL,
  calculated_commission NUMERIC(12,2) NOT NULL,
  -- ...
);

-- ✅ CORRECT: Extend existing table with new columns
ALTER TABLE salary_records
  ADD COLUMN service_commission NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN product_sales_commission NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN position_bonus NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN seniority_bonus NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN manual_adjustments NUMERIC(12,2) DEFAULT 0;

-- ❌ WRONG: Modify existing column behavior
-- ALTER TABLE salary_records ALTER COLUMN session_bonus TYPE ...;
-- This would break existing code!
```

**Bài học:**
- Keep legacy columns (`session_bonus`) unchanged
- Add new columns for new features
- Set DEFAULT values để backward compatible
- Update formula but keep old column for audit trail

#### 2. Business Logic Extension (Backward Compatible)

**Pattern:** Add new calculation functions, keep old ones working

```typescript
// ✅ CORRECT: Old function still works
export function calculateSessionCommission(sessions: number): number {
  return sessions * 150000; // Legacy Baby Care formula
}

// ✅ CORRECT: New functions for new features
export function calculateServiceCommission(input: ServiceCommissionInput): number {
  // Priority: override → tenant default → system default
  if (input.overrideType && input.overrideValue !== null) {
    return parseCommissionInput(input.overrideType, input.overrideValue, input.subtotal);
  }
  if (input.defaultType && input.defaultValue !== null) {
    return parseCommissionInput(input.defaultType, input.defaultValue, input.subtotal);
  }
  return DEFAULT_COMMISSION_CONFIG.service_commission_default.value;
}

// ✅ CORRECT: Extend total salary calculation
export function calculateTotalSalary(components: SalaryComponents): number {
  return (
    components.baseSalary +
    components.sessionBonus + // Legacy - still counted
    components.serviceCommission + // NEW
    components.productSalesCommission + // NEW
    components.positionBonus + // NEW
    components.seniorityBonus + // NEW
    components.manualAdjustments + // NEW
    components.ratingBonus +
    components.kpiBonus -
    components.deductions -
    components.advances
  );
}
```

**Bài học:**
- Don't delete or rename existing functions
- Add new functions alongside old ones
- Extend calculation formulas additively
- Test that old code paths still work

#### 3. API/Action Extension (Non-Breaking)

**Pattern:** Add new optional parameters, never change required ones

```typescript
// ✅ CORRECT: Old calls still work, new calls get more features
interface RecalculateSalaryInput {
  ktvId: string; // Required (existing)
  tenantId: string; // Required (existing)
  month: string; // Required (existing)
  
  // NEW: All optional for backward compatibility
  includeServiceCommission?: boolean; // Default: true
  includeProductSalesCommission?: boolean; // Default: true
  includePositionBonus?: boolean; // Default: true
  includeSeniorityBonus?: boolean; // Default: true
  includeManualAdjustments?: boolean; // Default: true
}

// Old code still works:
await recalculateAndSaveSalaryRecord(supabase, 'ktv-1', 'tenant-a', '2026-06');

// New code gets more control:
await recalculateAndSaveSalaryRecord(supabase, 'ktv-1', 'tenant-a', '2026-06', {
  includePositionBonus: false, // Override specific components
});
```

**Bài học:**
- Never change existing required parameters
- Add new parameters as optional with sensible defaults
- Document default behavior clearly
- Test both old and new calling patterns

#### 4. UI Extension (Progressive Enhancement)

**Pattern:** Add new UI components, don't break existing screens

```typescript
// ✅ CORRECT: Old salary table still works
<SalaryTable
  filteredSalaries={salaries}
  currentUser={currentUser}
  // ... existing props
/>

// ✅ CORRECT: Add new detail modal alongside
<SalaryDetailModal
  isOpen={!!viewingSalary}
  onClose={() => setViewingSalary(null)}
  salary={viewingSalary}
  tenantId={tenantId}
  currentMonth={currentMonth}
/>

// ✅ CORRECT: Add new "View Details" button, keep old buttons
<button onClick={() => setViewingSalary(s)}>
  <Eye className="w-5 h-5" />
</button>
<button onClick={() => openEditModal(s)}>
  {/* Old edit button - still works */}
</button>
```

**Bài học:**
- Add new screens/modals alongside existing ones
- Don't modify core components that other code depends on
- Use feature flags for gradual rollout if needed
- Keep old workflows available during transition

### Testing Strategies Applied

#### 1. Edge Case Testing (Task 34)

**Coverage:** 60+ edge case tests

```typescript
describe('Commission Edge Cases', () => {
  // Negative values
  it('should clamp negative commission to 0');
  it('should clamp negative subtotal to 0');
  
  // Large numbers
  it('should handle 10B+ VND without overflow');
  it('should handle MAX_SAFE_INTEGER');
  
  // Decimals & rounding
  it('should handle 15.5% commission');
  it('should round 12.5 VND correctly');
  
  // Null/undefined
  it('should handle null adjustments array');
  it('should handle undefined hire date');
  
  // Boundaries
  it('should handle exactly 1.0 year seniority boundary');
  it('should handle exactly 100% percentage');
  
  // Performance
  it('should calculate 1000 items in <100ms');
});
```

**Bài học:**
- Test edge cases BEFORE production bugs appear
- Cover negative, zero, null, undefined, max values
- Test exact boundaries (0, 1, 100, etc.)
- Performance test for bulk operations

#### 2. Integration Testing (Tasks 35-36)

**Coverage:** 41 integration tests for full flows

```typescript
describe('Service Commission Flow', () => {
  it('should calculate for booking with 2 services');
  it('should recalculate when service edited');
  it('should clawback when booking cancelled');
  it('should aggregate into salary_records');
});

describe('Product Sales Flow', () => {
  it('should handle bulk sales (15+ products)');
  it('should handle partial refund');
  it('should work with split payment methods');
});
```

**Bài học:**
- Test full user journeys, not just units
- Simulate real workflows (create → edit → delete → recalculate)
- Test cross-table interactions
- Verify side effects (salary updates after commission changes)

#### 3. Regression Testing

**Pattern:** Ensure old features still work after changes

```typescript
describe('Backward Compatibility', () => {
  it('should still calculate legacy session commission', () => {
    const oldSalary = {
      baseSalary: 6000000,
      sessionBonus: 3000000, // Legacy field
      sessions: 20,
      // NEW fields all 0
      serviceCommission: 0,
      productSalesCommission: 0,
      // ...
    };
    
    const total = calculateTotalSalary(oldSalary);
    expect(total).toBe(9000000); // Old formula still works
  });
  
  it('should support mixed legacy + new commission', () => {
    const mixedSalary = {
      baseSalary: 6000000,
      sessionBonus: 1500000, // Legacy Baby Care
      serviceCommission: 500000, // NEW Spa services
      // ...
    };
    
    const total = calculateTotalSalary(mixedSalary);
    expect(total).toBe(8000000); // Both counted correctly
  });
});
```

**Bài học:**
- Always test that old code paths still work
- Test mixed scenarios (old + new features together)
- Run full test suite after every change
- Never assume "nobody uses that old feature"

### Design Decisions & Tradeoffs

#### 1. Commission Type: Fixed vs Percentage

**Decision:** Support BOTH input formats

```typescript
type CommissionType = 'fixed' | 'percentage';

interface CommissionInput {
  type: CommissionType;
  value: number; // Amount in VND OR percentage 0-100
  baseAmount: number; // For percentage calculation
}
```

**Rationale:**
- Different businesses have different preferences
- Spa services often use percentage
- Product sales sometimes use fixed amount
- Flexible system adapts to client needs

**Tradeoff:**
- More complex validation
- More edge cases to test
- But: Better real-world fit

#### 2. Commission Priority: Override → Default → System

**Decision:** 3-tier cascade priority

```
1. Override (transaction-level) - Highest priority
2. Tenant Default (tenant config)
3. System Default (hardcoded) - Lowest priority
```

**Rationale:**
- Flexibility: Special deals need transaction override
- Consistency: Most transactions use tenant default
- Safety: System default prevents calculation errors

**Tradeoff:**
- More logic complexity
- More test cases needed
- But: Covers all real-world scenarios

#### 3. Salary Status Lifecycle: Draft → Published → Confirmed → Finalized

**Decision:** Multi-status workflow with recalculation rules

```
draft: Always recalculate (dynamic)
published: Preserve saved values (manual edits protected)
confirmed: No recalculation (KTV approved)
finalized: Locked (month-end close)
```

**Rationale:**
- Draft: Let system auto-calculate as data comes in
- Published: Protect accountant manual adjustments
- Confirmed: Respect KTV sign-off
- Finalized: Immutable for audit/compliance

**Tradeoff:**
- Complex state machine logic
- More edge cases (status transitions)
- But: Matches real HR/accounting workflow

#### 4. Manual Adjustments: Separate Table vs Inline Fields

**Decision:** Separate `salary_adjustments` table

**Rationale:**
- Track adjustment history (who, when, why)
- Support multiple adjustments per KTV per month
- Audit trail for compliance
- Approval workflow (draft → pending → approved → rejected)

**Alternative Rejected:**
```sql
-- ❌ Rejected: Inline fields
ALTER TABLE salary_records
  ADD COLUMN bonus_1_amount NUMERIC,
  ADD COLUMN bonus_1_reason TEXT,
  ADD COLUMN bonus_2_amount NUMERIC,
  ADD COLUMN bonus_2_reason TEXT,
  -- Doesn't scale!
```

**Tradeoff:**
- More tables to join
- More complex queries
- But: Better data model, clearer audit trail

### Troubleshooting Guide

#### Issue: Commission không hiển thị trong bảng lương

**Triệu chứng:**
- KTV đã hoàn thành dịch vụ/bán hàng
- Nhưng `service_commission` hoặc `product_sales_commission` = 0 trong `salary_records`

**Debug Steps:**

1. **Kiểm tra dữ liệu nguồn:**
```sql
-- Có service items không?
SELECT * FROM booking_service_items
WHERE ktv_id = 'xxx'
  AND DATE_TRUNC('month', completed_date) = '2026-06-01'
  AND status = 'completed';

-- Có product sales không?
SELECT * FROM product_sales
WHERE ktv_id = 'xxx'
  AND DATE_TRUNC('month', sale_date) = '2026-06-01'
  AND status IN ('completed', 'pending');
```

2. **Kiểm tra calculated_commission:**
```sql
-- Commission có được tính đúng không?
SELECT service_name, subtotal, calculated_commission
FROM booking_service_items
WHERE ktv_id = 'xxx';

-- Nếu calculated_commission = 0, check override/default config
```

3. **Trigger recalculation:**
```typescript
await recalculateAndSaveSalaryRecordEngine(
  supabase,
  ktvId,
  tenantId,
  '2026-06'
);
```

4. **Kiểm tra status:**
```sql
-- Nếu status != 'draft', salary đã locked
SELECT status FROM salary_records
WHERE ktv_id = 'xxx' AND month = '2026-06-01';

-- Status 'published'/'confirmed'/'finalized' không auto-recalculate
```

**Root Causes:**
- Service items chưa complete (`status != 'completed'`)
- Override commission = 0 (intentional free service)
- Salary đã published/confirmed (manual values protected)
- Month mismatch (service completed tháng khác)

#### Issue: Calculation không đúng (số tiền sai)

**Triệu chứng:**
- Commission có hiển thị nhưng số tiền không khớp với expected

**Debug Steps:**

1. **Verify calculation inputs:**
```typescript
// Check service item inputs
const serviceItem = {
  subtotal: 800000,
  overrideType: 'percentage',
  overrideValue: 15, // Should be 120,000
};

const result = calculateServiceCommission(serviceItem);
console.log(result); // 120000?
```

2. **Check for rounding issues:**
```typescript
// Math.round() behavior
const result = parseCommissionInput('percentage', 33.333333, 1000000);
// Expected: 333333 (not 333333.33 - rounded)
```

3. **Verify priority logic:**
```typescript
// Override should win over default
const result = calculateServiceCommission({
  subtotal: 500000,
  overrideType: 'fixed',
  overrideValue: 200000, // ← Should use this
  defaultType: 'percentage',
  defaultValue: 10, // ← Ignored
});
// Expected: 200000 (not 50000)
```

4. **Check edge cases:**
```typescript
// Negative values clamped to 0
const result = parseCommissionInput('percentage', -10, 1000000);
// Expected: 0 (not -100000)

// Percentage clamped to 100%
const result = parseCommissionInput('percentage', 150, 1000000);
// Expected: 1000000 (not 1500000)
```

**Root Causes:**
- Wrong override/default config in database
- Rounding behavior misunderstood
- Edge case (negative, >100%, null) not handled
- Business logic bug (priority order wrong)

#### Issue: Performance chậm khi tính lương cuối tháng

**Triệu chứng:**
- Batch recalculation cho 100+ KTVs mất >30 giây
- UI bị lag/timeout

**Debug Steps:**

1. **Profile queries:**
```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%salary_records%'
ORDER BY mean_time DESC
LIMIT 10;
```

2. **Check missing indexes:**
```sql
-- Essential indexes
CREATE INDEX IF NOT EXISTS idx_booking_service_items_ktv_month
  ON booking_service_items(ktv_id, completed_date)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_product_sales_ktv_month
  ON product_sales(ktv_id, sale_date)
  WHERE status IN ('completed', 'pending');

CREATE INDEX IF NOT EXISTS idx_salary_adjustments_ktv_month
  ON salary_adjustments(ktv_id, month, status)
  WHERE status = 'approved';
```

3. **Batch operations:**
```typescript
// ❌ SLOW: Sequential recalculation
for (const ktv of ktvs) {
  await recalculateAndSaveSalaryRecord(supabase, ktv.id, tenantId, month);
}

// ✅ FAST: Parallel recalculation
await Promise.all(
  ktvs.map(ktv =>
    recalculateAndSaveSalaryRecord(supabase, ktv.id, tenantId, month)
  )
);
```

4. **Use RPC for bulk:**
```sql
-- Create bulk recalculation RPC
CREATE OR REPLACE FUNCTION recalculate_all_salaries(
  p_tenant_id UUID,
  p_month DATE
) RETURNS TABLE(...) AS $$
  -- Bulk calculation in single transaction
  -- Faster than N individual calls
$$ LANGUAGE plpgsql;
```

**Root Causes:**
- N+1 query problem (individual KTV calculations)
- Missing indexes on date ranges
- No batching/parallel processing
- Complex joins without optimization

### Module Isolation Guidelines (Updated)

**Nguyên tắc cũ vẫn giữ nguyên:**
- Commission system là core feature, KHÔNG phải module-specific
- Tất cả modules (babycare, beauty_spa, cleaning) đều dùng chung commission tables
- Filter theo `module_key` khi cần (nếu có module-specific rules)

**Nguyên tắc mới thêm:**
- Commission config CÓ THỂ customize per tenant (trong `tenants.commission_config`)
- Default system config trong `src/lib/business-rules/commission.ts`
- UI hiển thị commission CÓ THỂ customize per module (vocabulary, icons, colors)

**Example:**
```typescript
// ✅ CORRECT: Module-aware commission display
const vocab = useModuleVocabulary();

<CommissionCard
  title={vocab.serviceCommission} // "Hoa hồng dịch vụ" for spa, etc.
  icon={getModuleIcon(module)} // Different icons per module
  amount={commission}
/>

// ❌ WRONG: Hardcoded vocabulary
<CommissionCard
  title="Hoa hồng ca Mẹ & Bé" // Only correct for babycare!
  amount={commission}
/>
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMISSION SYSTEM ARCHITECTURE                │
└─────────────────────────────────────────────────────────────────┘

DATA LAYER (PostgreSQL + Supabase)
┌─────────────────────┬──────────────────────┬────────────────────┐
│  Service Items      │  Product Sales       │  Manual Adj.       │
│  ─────────────      │  ──────────────      │  ────────────      │
│  • booking_service  │  • product_sales     │  • salary_adj...   │
│    _items           │  • ktv_id            │  • ktv_id          │
│  • ktv_id           │  • sale_amount       │  • adjustment_type │
│  • subtotal         │  • calculated_comm.  │  • amount          │
│  • calculated_comm. │  • override_type     │  • status          │
│  • override_type    │  • override_value    │  • reason          │
│  • override_value   │  • payment_method    │  • approved_by     │
│  • completed_date   │  • sale_date         │  • month           │
└──────┬──────────────┴──────────┬───────────┴──────────┬─────────┘
       │                         │                       │
       │ Trigger recalculation on insert/update/delete  │
       │                         │                       │
       ▼                         ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│               BUSINESS LOGIC LAYER (TypeScript)                  │
├─────────────────────────────────────────────────────────────────┤
│  Commission Calculation Engine                                   │
│  • calculateServiceCommission()                                  │
│  • calculateProductSalesCommission()                             │
│  • calculatePositionBonus()                                      │
│  • calculateSeniorityBonus()                                     │
│  • aggregateManualAdjustments()                                  │
│                                                                   │
│  Priority Logic: Override → Tenant Default → System Default     │
│                                                                   │
│  Salary Recalculation Engine                                     │
│  • recalculateAndSaveSalaryRecord()                              │
│  • Aggregates all commission types                               │
│  • Updates salary_records table                                  │
│  • Respects status lifecycle (draft/published/confirmed)         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SALARY RECORDS (Aggregated)                     │
├─────────────────────────────────────────────────────────────────┤
│  salary_records                                                  │
│  • ktv_id                                                        │
│  • month                                                         │
│  • base_salary                                                   │
│  • session_bonus (legacy)                                        │
│  • service_commission (NEW)                                      │
│  • product_sales_commission (NEW)                                │
│  • position_bonus (NEW)                                          │
│  • seniority_bonus (NEW)                                         │
│  • manual_adjustments (NEW)                                      │
│  • rating_bonus                                                  │
│  • kpi_bonus                                                     │
│  • deductions                                                    │
│  • advances                                                      │
│  • total_salary (calculated)                                     │
│  • status (draft/published/confirmed/finalized)                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UI LAYER (Next.js + React)                    │
├─────────────────────────────────────────────────────────────────┤
│  Admin UI                             │  KTV UI                  │
│  ────────                             │  ──────                  │
│  • Salary Table                       │  • Earnings Dashboard    │
│  • Salary Detail Modal (Task 33)     │  • Commission Breakdown  │
│  • Manual Adjustments Page (Task 22) │  • Monthly Statement     │
│  • Adjustments Approval (Task 24)    │                          │
│  • Commission Reports                 │                          │
└─────────────────────────────────────────────────────────────────┘

EXTENSION POINTS
• Add new commission types: Extend calculation engine, add DB column
• Add new bonus rules: Add calculation function, update formula
• Add new UI views: Create component, integrate with existing pages
• Module-specific customization: Use module_key filter, customize UI
```

### Key Takeaways

**✅ DO:**
- Add new tables/columns, don't modify existing ones
- Keep legacy fields for audit trail and backward compatibility
- Add new parameters as optional with sensible defaults
- Test edge cases (negative, zero, null, max values) upfront
- Write integration tests for full user journeys
- Run regression tests after every change
- Document extension points clearly
- Use 3-tier priority (override → default → system)
- Support both fixed and percentage commission types
- Separate approval workflow with status lifecycle

**❌ DON'T:**
- Delete or rename existing tables/columns/functions
- Change existing required parameters
- Assume "nobody uses that old feature"
- Skip edge case testing
- Skip performance testing for bulk operations
- Break backward compatibility without migration plan
- Hardcode business logic that should be configurable
- Mix new features with bug fixes in same PR
- Deploy without staging validation
- Forget to update documentation

**🎯 Success Metrics:**
- 0 breaking changes for existing code
- 130+ tests all passing
- <100ms for bulk operations (100 items)
- <500ms for month-end processing (1000 items)
- Clear extension patterns documented
- Troubleshooting guide prevents common issues
