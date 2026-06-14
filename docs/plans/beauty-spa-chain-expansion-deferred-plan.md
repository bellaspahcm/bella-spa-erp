# Kế hoạch Hoãn Mở rộng Chuỗi Beauty Spa

> **Trạng thái**: Tạm hoãn cho đến khi Bella Spa và tenant Beauty Spa đầu tiên ổn định, chính xác và có đầy đủ bộ kiểm thử phòng ngừa lỗi (regression-guarded).
> **Ngày tạo**: 11/06/2026
> **Mục đích**: Lưu lại kế hoạch mở rộng thương mại cho chuỗi Beauty Spa mà không tiến hành triển khai quá sớm.

## Ý định (Intent)

Kế hoạch này ghi nhận mô hình tương lai nơi một khách hàng Beauty Spa có thể mua một gói dịch vụ bao gồm:

- Một thực thể spa chính (main spa entity)
- Nhiều chi nhánh spa con (child spa branches)
- Một danh tính thương hiệu (brand identity) dùng chung trong toàn mạng lưới của khách hàng đó
- Các dữ liệu và hoạt động vận hành chi nhánh độc lập
- Quản lý tập trung dành cho chủ spa chính

Đây không phải là một phần trong phạm vi ổn định hóa hiện tại. Ưu tiên trước mắt vẫn là giữ cho Bella Spa và tenant Beauty Spa hiện tại hoạt động chính xác, cô lập và đáng tin cậy.

## Khả năng của Hệ thống Hiện tại (Current System Capability)

Hệ thống hiện tại đã có thể hỗ trợ các tenant Beauty Spa như những doanh nghiệp độc lập:

- HQ (Hội sở) có thể tạo tenant Beauty Spa.
- Tenant có thể có tài khoản admin riêng của mình.
- Tenant có thể sử dụng nội dung hiển thị (copy), danh mục dịch vụ và nhận diện thương hiệu của module Beauty Spa.
- Dữ liệu tenant được giới hạn phạm vi theo từng tenant và không được rò rỉ sang Bella Spa.
- Bella Spa và Beauty Spa sử dụng chung nền tảng ERP, nhưng dữ liệu kinh doanh của họ phải tách biệt hoàn toàn.

Điều này là đủ cho hoạt động độc lập của một địa điểm Beauty Spa đơn lẻ.

## Khoảng cách cần bổ sung khi Hoãn (Deferred Gap)

Hệ thống hiện tại chưa thể bán như một gói quản lý chuỗi đầy đủ nếu không làm thêm các phần sau. Những mảnh ghép cấp chuỗi còn thiếu là:

- Mối quan hệ cha-con rõ ràng (explicit parent-child relationship) giữa spa chính và các chi nhánh.
- Giới hạn hạn ngạch chi nhánh (branch quota) trong các gói đăng ký dịch vụ (subscription packages).
- Phân quyền cho một admin của spa chính chỉ quản lý các chi nhánh con của chính họ.
- Trình chọn chi nhánh (branch selector) và báo cáo phạm vi nhóm (group-scoped reporting).
- Quy trình làm việc liên chi nhánh an toàn chỉ giới hạn trong nhóm khách hàng đó.
- Các bài kiểm thử chứng minh dữ liệu của Bella Spa và các tenant Beauty Spa khác không bị nhìn thấy từ bên trong nhóm chi nhánh đó.

## Quy tắc Cô lập Bắt buộc (Non-Negotiable Isolation Rules)

Khi kế hoạch này được triển khai sau này:

- Bella Spa tuyệt đối không được nhìn thấy dữ liệu kinh doanh của Beauty Spa.
- Một khách hàng Beauty Spa không bao giờ được nhìn thấy dữ liệu của một khách hàng Beauty Spa khác.
- Admin của spa chính không được nhận đặc quyền toàn cục của hội sở (HQ/global privileges).
- Admin của chi nhánh con chỉ được nhìn thấy chi nhánh của riêng họ trừ khi được cấp quyền truy cập nhóm một cách rõ ràng.
- Danh tính email đơn thuần không phải là ranh giới dữ liệu; tenant và phạm vi truy cập (access scope) phải xác định ranh giới này.
- Khóa module (Module key) vẫn phải được cấp duy nhất bởi HQ.

## Mô hình Thương mại Tương lai (Future Commercial Model)

### Ví dụ về Gói Dịch vụ

Gói: Beauty Chain Starter (Chuỗi Beauty Khởi nghiệp)

- 1 spa chính
- Tối đa 3 chi nhánh con
- Dùng chung nhận diện thương hiệu
- Admin cấp chi nhánh
- Chế độ xem của chủ sở hữu/admin trên toàn chuỗi
- Báo cáo và bảng điều khiển tổng hợp
- Các hoạt động đặt lịch, khách hàng, nhân sự, kho hàng và doanh thu cấp chi nhánh

### Quy trình Thiết lập

1. HQ tạo tenant Beauty Spa chính.
2. HQ cấu hình giới hạn gói, nhận diện thương hiệu, thanh toán và khóa module.
3. HQ tạo các chi nhánh con và liên kết chúng với spa chính.
4. HQ tạo hoặc mời các admin chi nhánh.
5. Chủ spa chính nhận quyền truy cập cấp nhóm, chỉ giới hạn trong chuỗi của chính họ.
6. Admin chi nhánh con chỉ nhận quyền truy cập cấp chi nhánh.

## Phạm vi Triển khai Tối thiểu Sau này (Minimal Implementation Scope Later)

Chỉ thực hiện những phần tối thiểu cần thiết để vận hành chuỗi an toàn:

1. Phân cấp Tenant (Tenant hierarchy)
   - Lưu trữ mối quan hệ cha-con cho các chi nhánh Beauty Spa.
   - Cho phép HQ chọn spa cha khi tạo một chi nhánh con.

2. Hạn ngạch Chi nhánh (Branch quota)
   - Thêm hạn ngạch đăng ký số lượng chi nhánh.
   - Chặn tạo mới khi đạt giới hạn gói dịch vụ.

3. Truy cập giới hạn trong nhóm (Group-scoped access)
   - Thêm một mô hình truy cập nhỏ cho admin spa chính.
   - Admin spa chính có thể xem/quản lý chỉ các tenant con thuộc spa cha của họ.
   - Không tái sử dụng vai trò (role) của HQ cho việc này.

4. Trình chọn Chi nhánh (Branch selector)
   - Thêm phạm vi giao diện người dùng (UI scope): tất cả chi nhánh, chi nhánh chính, hoặc một chi nhánh con cụ thể.
   - Mặc định các admin chi nhánh con vào chi nhánh của riêng họ.

5. Báo cáo Nhóm (Group reports)
   - Các tóm tắt về doanh thu, đặt lịch, khách hàng, lương, kho hàng và tài chính phải chấp nhận một danh sách tenant giới hạn cụ thể.
   - Không có báo cáo nào được phép vô tình truy vấn toàn bộ mọi tenant.

6. Kiểm thử (Tests)
   - Chứng minh dữ liệu Bella Spa không hiển thị với người dùng chuỗi Beauty Spa.
   - Chứng minh Beauty Spa A không thể xem dữ liệu Beauty Spa B.
   - Chứng minh admin chi nhánh không thể xem các chi nhánh anh em.
   - Chứng minh admin spa chính chỉ nhìn thấy các chi nhánh của riêng họ.
   - Chứng minh giới hạn chi nhánh của gói dịch vụ được thực thi.

## Những điều KHÔNG được làm (What Not To Do)

- Không cấp vai trò HQ cho admin spa chính của khách hàng.
- Không sử dụng cùng một tài khoản email trên các tenant không liên quan mà không có mô hình thành viên/chuyển đổi rõ ràng.
- Không xây dựng một công cụ quản lý chuỗi đa ngành chung chung trước khi luồng Beauty Spa hoạt động ổn định.
- Không chuyển dữ liệu vận hành của Bella Spa vào phạm vi nhóm dùng chung.
- Không thêm các luồng kế toán hoặc kho hàng liên chi nhánh cho đến khi việc phân tách tenant/nhóm được bảo vệ chắc chắn bởi các bài kiểm thử.

## Cổng Điều kiện Sẵn sàng Trước khi Bắt đầu (Readiness Gate Before Starting)

Kế hoạch này chỉ được chuyển từ trạng thái hoãn sang kích hoạt khi tất cả những điều sau đây là đúng:

- Các quy trình vận hành thực tế (production) của Bella Spa đã ổn định.
- Tenant Beauty Spa đầu tiên không còn hiển thị rò rỉ nội dung (copy leakage) từ Bella/Babycare.
- Giao diện sáng/tối của Beauty Spa có độ tương phản chấp nhận được và không bị nháy giao diện khi tải trang lần đầu (first-paint theme flash).
- Các bộ bảo vệ mã nguồn cô lập tenant (tenant isolation source guards) vượt qua kiểm thử.
- Các luồng tài chính, đặt lịch, buổi dịch vụ, lương, thanh toán và khách hàng có độ bao phủ kiểm thử phòng ngừa lỗi tập trung.
- Dữ liệu demo của Beauty có thể được tạo và xóa một cách an toàn.
- Không có lỗi nghiêm trọng thực tế nào đang mở liên quan đến khả năng nhìn thấy chéo giữa các tenant.

## Tài liệu Triển khai Tương lai (Future Implementation Artifact)

Khi công việc bắt đầu, hãy tạo một đặc tả tập trung trong thư mục `docs/implementation-artifacts/`, ví dụ:

`docs/implementation-artifacts/spec-add-beauty-spa-chain-tenant-hierarchy.md`

Đặc tả phải bao gồm:

- Các bảng/cột chính xác bị tác động
- Các quy tắc truy cập (access rules)
- Quy trình thiết lập của HQ
- Các vai trò người dùng (user roles)
- Trình chọn phạm vi giao diện (UI scope selector)
- Các bộ bảo vệ truy vấn (query guards)
- Kế hoạch kiểm thử (test plan)
- Kế hoạch khôi phục (rollback plan)

## Bàn giao Trì hoãn (Deferred Handoff)

Tài liệu này được thiết kế có mục đích chỉ là một kế hoạch. Nó sẽ giúp định hướng phát triển tương lai mà không thúc đẩy dự án hiện tại rơi vào tình trạng mở rộng quá sớm.

Ưu tiên hiện tại:

1. Ổn định hóa Bella Spa
2. Ổn định hóa tenant Beauty Spa đầu tiên
3. Loại bỏ rò rỉ dữ liệu/giao diện người dùng liên module
4. Khóa các quy tắc kinh doanh quan trọng bằng các bài kiểm thử
5. Chỉ sau đó mới xây dựng phần mở rộng chuỗi
