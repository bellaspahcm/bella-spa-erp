import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { supabase } from './db.js';
// Database Schema definition for 16 core tables in Bella Spa ERP
const DATABASE_SCHEMA = {
    description: "Sơ đồ chi tiết 16 bảng cơ sở dữ liệu cốt lõi của Bella Spa ERP. Sử dụng sơ đồ này để lập kế hoạch truy vấn SQL chính xác.",
    tables: {
        tenants: {
            columns: {
                id: "UUID - Khóa chính (Primary Key)",
                name: "TEXT - Tên chi nhánh / Đối tác nhượng quyền",
                parent_tenant_id: "UUID - ID chi nhánh cha (nếu là franchise nhánh con)",
                franchise_agreement_date: "DATE - Ngày ký thỏa thuận nhượng quyền",
                royalty_rate: "DECIMAL % - Tỷ lệ phí tác quyền nhượng quyền",
                contact_name: "TEXT - Tên người liên hệ đại diện",
                contact_phone: "TEXT - Số điện thoại liên hệ",
                address: "TEXT - Địa chỉ chi nhánh",
                status: "TEXT CHECK (status IN ('active', 'suspended', 'terminated')) - Trạng thái hoạt động",
                zalo_app_id: "TEXT - App ID đăng ký trên Zalo Developer",
                zalo_oa_id: "TEXT - ID của Zalo Official Account",
                zalo_template_reminder_id: "TEXT - ID template Zalo ZNS nhắc lịch hẹn chăm sóc",
                zalo_template_birthday_id: "TEXT - ID template Zalo ZNS gửi voucher sinh nhật bé",
                zalo_auto_scan: "BOOLEAN - Bật/tắt tự động quét gửi nhắc lịch hẹn",
                bank_name: "TEXT - Tên ngân hàng nhận thanh toán/chuyển khoản",
                bank_account_number: "TEXT - Số tài khoản ngân hàng chi nhánh",
                bank_account_name: "TEXT - Tên chủ tài khoản ngân hàng"
            }
        },
        users: {
            columns: {
                id: "UUID - Khóa chính (Liên kết auth.users)",
                email: "TEXT - Địa chỉ Email đăng nhập",
                full_name: "TEXT - Họ và tên nhân viên/KTV",
                phone: "TEXT - Số điện thoại liên hệ",
                role: "TEXT CHECK (role IN ('admin', 'ktv_lead', 'ktv', 'admin_staff', 'accountant')) - Vai trò phân quyền",
                avatar_url: "TEXT - Đường dẫn ảnh đại diện",
                status: "TEXT - Trạng thái nhân viên ('active', 'inactive')",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        customers: {
            columns: {
                id: "UUID - Khóa chính",
                phone: "TEXT (UNIQUE) - Số điện thoại của mẹ",
                name_mother: "TEXT - Họ và tên mẹ",
                name_baby: "TEXT - Tên bé (nếu đã sinh)",
                dob_baby: "DATE - Ngày sinh của bé",
                dob_expected: "DATE - Ngày sinh dự kiến",
                address: "TEXT - Địa chỉ nhà của khách để KTV đến tắm bé",
                referrer_id: "UUID - ID khách hàng giới thiệu (FK customers.id)",
                zalo_oa_id: "TEXT - Zalo User ID để gửi tin nhắn CSKH trực tiếp",
                status: "TEXT - Trạng thái hoạt động",
                notes: "TEXT - Ghi chú đặc biệt (ví dụ: bé sinh mổ, mẹ tắc tia sữa)",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        bookings: {
            columns: {
                id: "UUID - Khóa chính",
                booking_number: "TEXT (UNIQUE - BK-YYMMDD-NNN) - Mã hợp đồng dịch vụ",
                customer_id: "UUID - ID khách hàng (FK customers.id)",
                package_id: "UUID - ID gói dịch vụ mẫu (FK packages.id)",
                package_name: "TEXT - Tên gói dịch vụ tại thời điểm ký",
                status: "TEXT CHECK (status IN ('inquiry', 'deposit_pending', 'booked', 'in_progress', 'completed', 'cancelled'))",
                deposit_amount: "NUMERIC - Số tiền cọc đã đóng",
                price: "NUMERIC - Giá trị hợp đồng gói dịch vụ",
                start_date: "DATE - Ngày bắt đầu liệu trình chăm sóc",
                end_date: "DATE - Ngày dự kiến kết thúc",
                expected_birth_date: "DATE - Ngày dự sinh (snapshot từ customer)",
                assigned_ktv_id: "UUID - Kỹ thuật viên chính phụ trách (FK users.id)",
                ktv_commission: "NUMERIC - Định mức hoa hồng KTV được hưởng mỗi ca",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)",
                completed_sessions: "INTEGER - Số buổi đã thực hiện thực tế (được đồng bộ ngầm)",
                total_sessions: "INTEGER - Tổng số buổi của gói (ví dụ: 15 hoặc 21 buổi)"
            }
        },
        session_logs: {
            columns: {
                id: "UUID - Khóa chính",
                booking_id: "UUID - ID hợp đồng dịch vụ (FK bookings.id)",
                session_number: "INTEGER - Số thứ tự buổi tập (1 - 21)",
                assigned_date: "DATE - Ngày xếp ca thực hiện",
                assigned_time: "TIME - Giờ thực hiện (dạng HH:MM)",
                completed_date: "TIMESTAMPTZ - Thời điểm hoàn thành thực tế",
                completed_by_ktv_id: "UUID - KTV thực hiện buổi đó (FK users.id)",
                address: "TEXT - Địa chỉ nhà thực hiện ca",
                status: "TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) - Trạng thái buổi tập",
                is_confirmed: "BOOLEAN - Đã đối soát buổi làm việc này để tính lương chưa (Immutable khi TRUE)",
                zalo_reminder_sent: "BOOLEAN - Đã gửi tin nhắn nhắc lịch qua Zalo ZNS chưa",
                zalo_reminder_time: "TIMESTAMPTZ - Thời điểm gửi tin nhắn Zalo",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        session_reviews: {
            columns: {
                id: "UUID - Khóa chính",
                session_log_id: "UUID - ID buổi tập được đánh giá (FK session_logs.id)",
                reviewer_id: "UUID - Khách hàng đánh giá (FK customers.id)",
                ktv_id: "UUID - ID KTV bị đánh giá (FK users.id)",
                rating: "INTEGER - Số sao từ 1 đến 5",
                note: "TEXT - Nội dung phản hồi phản ánh (Mã hóa AES-256)",
                note_encrypted: "BOOLEAN - Trạng thái mã hóa của nội dung phản hồi",
                is_hidden_from_ktv: "BOOLEAN - Ẩn phản hồi text với KTV (Chỉ Admin/KTV Lead được xem)",
                status: "TEXT CHECK (status IN ('pending_review', 'approved', 'published'))",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        ktv_schedule: {
            columns: {
                id: "UUID - Khóa chính",
                ktv_id: "UUID - ID KTV (FK users.id)",
                date: "DATE - Ngày đăng ký trạng thái lịch",
                status: "TEXT CHECK (status IN ('free_full', 'free_partial', 'full', 'off'))",
                off_paid: "BOOLEAN - Nghỉ phép có lương",
                note: "TEXT - Lý do nghỉ phép hoặc ghi chú lịch",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        shifts: {
            columns: {
                id: "UUID - Khóa chính",
                ktv_id: "UUID - ID KTV nhận ca (FK users.id)",
                date: "DATE - Ngày làm việc",
                start_time: "TIME - Giờ bắt đầu ca",
                end_time: "TIME - Giờ kết thúc ca",
                booking_id: "UUID - ID hợp đồng dịch vụ liên kết (FK bookings.id)",
                customer_id: "UUID - ID khách hàng liên kết (FK customers.id)",
                address: "TEXT - Địa chỉ di chuyển",
                checkin_time: "TIMESTAMPTZ - Thời gian check-in thực tế tại nhà khách",
                checkin_lat: "NUMERIC - Vĩ độ GPS lúc check-in",
                checkin_lon: "NUMERIC - Kinh độ GPS lúc check-in",
                checkout_time: "TIMESTAMPTZ - Thời gian check-out thực tế",
                checkout_lat: "NUMERIC - Vĩ độ GPS lúc check-out",
                checkout_lon: "NUMERIC - Kinh độ GPS lúc check-out",
                status: "TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled'))",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        revenue: {
            columns: {
                id: "UUID - Khóa chính",
                booking_id: "UUID - ID hợp đồng (FK bookings.id)",
                amount: "NUMERIC - Số tiền thực nhận",
                revenue_type: "TEXT CHECK (revenue_type IN ('deposit', 'session_completed', 'additional'))",
                payment_method: "TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'zalo_pay', 'momo', 'VietQR'))",
                received_date: "DATE - Ngày nhận tiền thực tế",
                recorded_by_id: "UUID - Người nhập sổ doanh thu (FK users.id)",
                status: "TEXT CHECK (status IN ('pending', 'confirmed'))",
                notes: "TEXT - Nội dung giao dịch nhận",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        expenses: {
            columns: {
                id: "UUID - Khóa chính",
                category: "TEXT CHECK (category IN ('office', 'transport', 'marketing', 'salary_advancement', 'others'))",
                amount: "NUMERIC - Số tiền chi",
                description: "TEXT - Nội dung lý do chi tiền",
                receipt_url: "TEXT - Hóa đơn hoặc chứng từ chi",
                expense_date: "DATE - Ngày chi tiền thực tế",
                approved_by_id: "UUID - Admin duyệt chi phí (FK users.id)",
                status: "TEXT CHECK (status IN ('submitted', 'approved', 'rejected'))",
                submitted_by_id: "UUID - Nhân viên đề xuất chi (FK users.id)",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        salary_records: {
            columns: {
                id: "UUID - Khóa chính",
                ktv_id: "UUID - Kỹ thuật viên nhận lương (FK users.id)",
                month_year: "DATE - Tháng đối soát (Dạng YYYY-MM-01)",
                base_salary: "NUMERIC - Lương cơ bản theo hợp đồng nhân sự",
                session_commission_total: "NUMERIC - Tổng tiền hoa hồng làm ca trị liệu trong tháng",
                kpi_bonus: "NUMERIC - Thưởng vượt KPI và kpi đánh giá 5 sao từ khách",
                violations_deduction: "NUMERIC - Khấu trừ phạt đi trễ/vi phạm quy chế",
                total_salary: "NUMERIC - Lương thực nhận sau đối soát",
                total_sessions: "INTEGER - Tổng số buổi làm việc thực tế được chốt snapshot",
                status: "TEXT CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid'))",
                paid_date: "DATE - Ngày chi trả thực tế",
                paid_method: "TEXT - Phương thức thanh toán lương",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        attendance: {
            columns: {
                id: "UUID - Khóa chính",
                ktv_id: "UUID - ID KTV (FK users.id)",
                date: "DATE - Ngày chấm công",
                checkin_time: "TIME - Giờ vào làm",
                checkout_time: "TIME - Giờ ra làm",
                shift_id: "UUID - Liên kết ca làm việc (FK shifts.id)",
                status: "TEXT CHECK (status IN ('present', 'late', 'absent', 'half_day'))",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        },
        kpi_records: {
            columns: {
                id: "UUID - Khóa chính",
                ktv_id: "UUID - KTV (FK users.id)",
                month_year: "DATE - Tháng tính KPI (Dạng YYYY-MM-01)",
                sessions_completed: "INTEGER - Số ca đã làm trong tháng",
                on_time_rate: "NUMERIC - Tỷ lệ đi làm đúng giờ (%)",
                customer_satisfaction: "NUMERIC - Điểm đánh giá sao trung bình của khách",
                violations_count: "INTEGER - Số lỗi vi phạm trong tháng",
                target_sessions: "INTEGER - Chỉ tiêu số ca cần hoàn thành",
                kpi_achievement_rate: "NUMERIC - Tỷ lệ hoàn thành KPI (%)",
                bonus_amount: "NUMERIC - Số tiền thưởng KPI tương ứng",
                notes: "TEXT - Ghi chú kết quả đánh giá",
                tenant_id: "UUID - ID chi nhánh (FK tenants.id)"
            }
        }
    }
};
/**
 * Registers Resources endpoints with the MCP Server instance
 */
export function registerResources(server) {
    // 1. List available resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: [
                {
                    uri: 'bella://system/schema',
                    name: 'Bella Spa ERP Database Schema Documentation',
                    mimeType: 'application/json',
                    description: 'Cung cấp mô tả chi tiết của 16 bảng cơ sở dữ liệu cốt lõi, cột dữ liệu, kiểu dữ liệu và mối quan hệ khóa ngoại.'
                },
                {
                    uri: 'bella://tenant/list',
                    name: 'Bella Spa active tenants and branches',
                    mimeType: 'application/json',
                    description: 'Lấy danh sách toàn bộ các chi nhánh đối tác nhượng quyền hoạt động cấp tổng công ty kèm theo ID chi nhánh.'
                }
            ]
        };
    });
    // 2. Read specific resource
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        if (uri === 'bella://system/schema') {
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(DATABASE_SCHEMA, null, 2)
                    }
                ]
            };
        }
        if (uri === 'bella://tenant/list') {
            try {
                const { data, error } = await supabase
                    .from('tenants')
                    .select('id, name, contact_name, contact_phone, address, status, franchise_agreement_date, royalty_rate')
                    .order('name', { ascending: true });
                if (error) {
                    throw new Error(`Database error: ${error.message}`);
                }
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(data || [], null, 2)
                        }
                    ]
                };
            }
            catch (err) {
                throw new Error(`Failed to retrieve tenants list: ${err.message}`);
            }
        }
        throw new Error(`Resource not found: ${uri}`);
    });
}
