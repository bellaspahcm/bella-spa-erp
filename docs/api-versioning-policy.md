# Bella ERP API Versioning Policy

Tai lieu nay quy dinh cach phan loai va dat duong dan API trong Bella ERP. Muc tieu la giu API on dinh khi mo tich hop doi tac, ngan route moi moc lung tung, va giup nguoi khong nam code van hieu endpoint nao co the dua cho ben ngoai.

## Nhom API Duoc Phep

| Nhom | Mau duong dan | Ai dung | Cam ket on dinh |
| --- | --- | --- | --- |
| Public/partner API | `/api/v1/...` | Doi tac, mobile app, franchise portal, tich hop ben ngoai | Co version, can thong bao khi breaking change |
| Provider webhook | `/api/webhooks/...` | Ngan hang, thanh toan, Telegram/Zalo neu provider yeu cau callback rieng | On dinh theo nha cung cap; breaking change phai ghi migration note |
| Internal cron | `/api/cron/...` | Scheduler/he thong noi bo | Khong public; co the doi neu CI/docs cap nhat |
| Diagnostic/dev | `/api/test-upcoming` | Dev/test noi bo | Khong public; production phai tat hoac an sau secret |

## Quy Tac Dat Route Moi

- API nao du kien cho doi tac, chi nhanh, app mobile, hoac tich hop ben ngoai phai nam trong `/api/v1/...`.
- API webhook nhan callback tu nha cung cap duoc phep nam trong `/api/webhooks/...`.
- API chay dinh ky boi scheduler noi bo duoc phep nam trong `/api/cron/...`.
- Diagnostic endpoint khong duoc them moi neu khong co guard ro: production tat, remote staging can secret, local co the mo.
- Route moi ngoai cac nhom tren se bi CI chan boi `npm run docs:api:versioning`.

## Breaking Change

Mot thay doi duoc xem la breaking change neu lam mot ben tich hop dang dung API co the hong:

- Doi ten endpoint, doi method, doi auth.
- Doi body bat buoc, doi field response quan trong, doi ma loi.
- Doi y nghia business cua mot field dang co.
- Doi idempotency, side effect, hoac thoi diem ghi nhan doanh thu/chi phi.

Neu breaking change anh huong public/partner API:

- Tao version moi, vi du `/api/v2/...`, hoac them migration note neu van trong `/api/v1`.
- Cap nhat `docs/api-reference.md`.
- Cap nhat test lien quan truoc khi merge.

## Non-Breaking Change

Nhung thay doi sau co the giu cung version:

- Them field response tuy chon.
- Them query/body field tuy chon co default an toan.
- Sua bug nhung giu contract dau vao/dau ra.
- Tang bao mat auth neu endpoint khong public hoac da co secret/token convention.

## Deprecation

Khi muon bo mot API public/partner:

- Ghi endpoint cu va endpoint moi trong `docs/api-reference.md`.
- Neu dang co doi tac that, can co thoi gian chuyen doi toi thieu 30 ngay.
- Trong thoi gian deprecation, khong xoa test contract cua endpoint cu tru khi da co migration ro rang.

## Trang Thai Hien Tai

- `/api/v1/ai/...`: API co version cho AI/partner noi bo.
- `/api/webhooks/payment`: webhook nha cung cap thanh toan.
- `/api/cron/...`: job noi bo.
- `/api/test-upcoming`: diagnostic dev/test, production tat va remote can secret.
