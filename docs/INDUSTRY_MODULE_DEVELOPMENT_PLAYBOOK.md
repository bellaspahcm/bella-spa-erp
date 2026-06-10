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

## Lich Su Beauty Spa: Qua Trinh, Loi, Cach Sua

Bang nay la nhat ky bai hoc thuc te. Khi lam nganh moi, bat buoc doi chieu tung nhom loi.

| Nhom | Loi da gap | Nguyen nhan | Cach sua/guard can giu |
| --- | --- | --- | --- |
| Module setup | Beauty Spa bi xem nhu tuy chon co the bat/tat | Thiet ke ban dau gan voi module toggle thay vi quy trinh thuong mai HQ cap | HQ-only setup, Beauty admin khong duoc doi module nganh |
| Tenant isolation | Dang nhap Admin Bella Spa van thay khach/demo Beauty | Query/UI read model co diem thieu scope tenant hoac demo data chua tach sach | Moi action doc du lieu phai filter `tenant_id`; them guard test session/dashboard/customer/finance |
| Module isolation | Beauty tenant van hien text Me & Be, KTV, Combo Me Be | UI copy va filter bi hard-code theo Babycare | Dung module-aware copy, service category theo module, khong render babycare UI khi tenant chua load module |
| Loading fallback | F5 hien Bella Spa mot luc roi moi chuyen Beauty Spa | Fallback mac dinh ve Bella/Babycare truoc khi tenant brand/module load xong | Non-Bella tenant khong fallback Bella; dung loading/neutral state den khi co tenant context |
| Brand isolation | Sidebar/header/portal co nguy co dung logo/mau Bella | Branding doc tu default chung hoac cache khong gan tenant | Cache brand phai kem `tenantId`; fallback Beauty trung tinh, khong fallback Bella |
| Package/service scope | Goi dich vu Beauty va Babycare co nguy co dung lan | `packages` la bang dung chung, ban dau thieu module guard | `packages.module_key`, `validateBookingPackageScope`, test cross-module/cross-tenant |
| Data vocabulary | Form khach Beauty con truong "Ho ten me", "Ho ten be", lich co "Combo Me Be" | Dung lai giao dien cu chua audit toan bo text | Truoc khi release module moi phai `rg` toan bo thuat ngu nganh cu va map sang dictionary module |
| Demo tenant | Can tao demo Beauty de test nhung phai xoa sach | Demo seed ban dau chua co marker/cleanup chuan | Demo data phai co `DEMO_MARKER`, fixed ids/email, cleanup requires `--confirm`, khong delete bang filter rong |
| Accounting demo | Posting finance demo loi do thieu ma tai khoan 111/5111/6421... | Tenant demo chua seed chart of accounts | Demo script phai goi `seed_default_coa` va verify accounts truoc khi tao journal/revenue |
| RLS/grants | Permission denied khi doc/xoa bang moi hoac bang token | Migration tao bang nhung chua grant/RLS policy du cho role thuc te | Moi bang moi phai co RLS, grant, policy va test permission/grant |
| Review/session FK | Tao review cho buoi cham soc bi FK reviewer_id | Reviewer/user id khong hop le hoac khong thuoc bang user ky vong | Action phai resolve reviewer hop le, neu khong co thi fail ro rang, khong insert review mo ho |
| UI mobile | Bang, filter ngay, dropdown, modal bi tran/cat noi dung | Tai su dung layout desktop hoac native select khong dong bo | Mobile-first visual smoke; table scroll trong box; dropdown dung component chung |
| Finance leakage | Bao cao tai chinh Bella hien giao dich Beauty demo | Revenue/expenses demo hoac query finance thieu scope module/tenant | Finance read model bat buoc filter tenant; demo data repair; regression test |
| Test blind spot | Co loi UI/data da sua thu cong nhung chua co guard | Test chua khoa dung invariant moi | Sau moi loi production/UI, them test guard nho nhat co the |

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

Nguyen tac:

- Tenant nganh moi khong duoc mac dinh ve Babycare/Bella.
- Neu module do la san pham thuong mai doc lap, chi HQ duoc cap module.
- Tenant admin cua nganh moi chi quan ly trong tenant cua ho.
- Moi cache UI lien quan brand/module phai co key theo tenant.

### Phase 2 - Schema, RLS, Grants, Seeds

Khi them bang/cot moi:

- Co `tenant_id` neu la du lieu tenant.
- Co `module_key` neu bang dung chung nhieu nganh.
- Co RLS policy dung `get_auth_tenant_id()` hoac guard tuong duong.
- Revokes/grants ro cho anon/authenticated/service use case.
- Co unique constraint theo tenant khi can.
- Co migration test doc SQL neu behavior quan trong.
- Co seed/demo script an toan neu can demo.

Can tranh:

- Tao bang rieng cho moi nganh khi bang core co the mo rong bang `module_key`.
- Dung service-role bypass ma khong filter tenant.
- Insert demo finance/accounting truoc khi seed COA.

### Phase 3 - Service Actions Va Rule Engines

Moi action doc/ghi du lieu phai:

- Lay current user/tenant tu source chuan.
- Fail closed neu thieu tenant.
- Filter `tenant_id` tren moi bang tenant-scoped.
- Validate `module_key` khi dung bang shared.
- Khong swallow database error.
- Khong tao side effect ngoai transaction/rollback pattern.
- Dung engine chung neu da ton tai: payment/booking/revenue/accounting/salary/inventory/session completion.

Neu phat hien logic lap lai qua 2-3 noi va co rui ro sai tien/ton kho/luong/accounting, moi duoc gom thanh rule engine. Khong tao engine chi vi muon "cho dep".

### Phase 4 - UI Module-Aware

Moi UI cua module moi phai:

- Dung copy theo module, khong hard-code thuat ngu nganh cu.
- Loading state khong hien tam du lieu/ngon ngu cua tenant khac.
- Sidebar/header/portal/bao gia/hoa don doc brand theo tenant.
- Dropdown, table, modal dung component/pattern chung cua he thong.
- Mobile phai check truoc khi coi xong.
- Neu co giao dien rieng/brand rieng, phai render preview anh mau truoc khi code thay doi UI lon.

Checklist UI bat buoc:

- Desktop: khong tran bang/filter/dropdown.
- Mobile: khong cat noi dung, nut bam vua khung, table scroll trong box.
- F5: giu dung tenant/module/tab hien tai.
- Loading: khong flash Bella/Babycare tren Beauty/nganh moi.
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
- Booking/payment/revenue/accounting/inventory/salary lien quan khong tao side effect sai.
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

### 2026-06-10 - Bella admin thay du lieu Beauty trong UI

- Module/tenant: Bella Spa va Beauty Spa.
- Man hinh/luong: Dashboard, khach hang, the lieu trinh, tai chinh.
- Dau hieu: Dang nhap mail quan tri Bella Spa nhung UI co khach/demo Beauty va giao dich Beauty.
- Nguyen nhan goc: Can tang guard tenant-scope cho cac luong doc session/dashboard va kiem tra lai demo data.
- Cach sua: Them regression test bat buoc `getSessionLogs`, `getSessionsWithDetails`, `getCalendarSessions` phai filter tenant; dashboard upcoming sessions phai di qua action calendar tenant-scoped; demo accounting seed phai verify COA.
- Test/guard da them: `src/__tests__/session-read-actions.test.ts`, `src/__tests__/dashboard-actions.test.ts`, `src/__tests__/beauty-demo-tenant-script.test.ts`.
- Commit: `ae973883` - `test: guard tenant scoped reads`.
- Rui ro con lai: Can tiep tuc them guard theo tung man hinh neu phat hien read model nao con di truc tiep bo qua action tenant-scoped.

## Quy Tac Cho AI Agent Tuong Lai

Khi user yeu cau "them phan he nganh moi", "mo rong Beauty", "lam module nganh X", hoac "white-label cho spa/clinic/academy":

1. Doc `AGENTS.md`.
2. Doc `docs/index.md`.
3. Doc tai lieu nay.
4. Kiem tra spec/implementation artifact lien quan gan nhat.
5. Chi de xuat viec chua lam; khong lap lai rule engine hoac refactor da co.
6. Neu thay doi runtime, phai co test chung minh Bella Spa hien tai khong bi anh huong.
7. Neu phat sinh loi moi, cap nhat "Lich Su Loi Moi" trong tai lieu nay.

