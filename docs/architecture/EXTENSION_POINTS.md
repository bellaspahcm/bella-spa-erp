# Official Extension Points Specification

Tài liệu định nghĩa danh mục chính thức các điểm mở (Extension Points) cho phép Sản phẩm (Products) đăng ký mở rộng năng lực vào Bella Host Platform.

---

## Danh Mục Extension Points Chính Thức

| Extension Point | Mô tả | Vị trí đăng ký |
| :--- | :--- | :--- |
| **`CQRS Query Capability`** | Đọc dữ liệu thuần túy (Rooms, Chairs, Patients, Records) | `plugin.registerCapabilities()` |
| **`CQRS Command Capability`**| Thao tác nghiệp vụ & phát sự kiện (Assign Room, Reserve Chair) | `plugin.registerCapabilities()` |
| **`Widget Metadata`** | Đăng ký UI Component Metadata (Odontogram, RoomGrid) | `plugin.registerExperience()` |
| **`Page Metadata`** | Đăng ký Trang mới trong hệ thống | `plugin.registerExperience()` |
| **`Menu Metadata`** | Đăng ký Thẻ Menu Navigation | `plugin.registerExperience()` |
| **`AI Capability Pack`** | Đăng ký Prompts, Decision Trees, Knowledge, Tools | `plugin.registerAICapabilityPack()` |
| **`Event Contract`** | Đăng ký và Phát các Event chuẩn hóa | `EventRegistry.register()` |

> **Lưu ý**: Ngoài 7 điểm mở trên, Plugin không được phép can thiệp trực tiếp vào mã nguồn của Kernel hoặc Core Platform.
