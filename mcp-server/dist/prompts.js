import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';
const PROMPT_TEMPLATES = [
    {
        name: 'analyze_monthly_business',
        description: 'Kịch bản phân tích báo cáo tài chính P&L và sức khỏe vận hành chi nhánh hàng tháng.',
        arguments: [
            { name: 'tenant_id', description: 'UUID của chi nhánh nhượng quyền cần phân tích.', required: true },
            { name: 'month_year', description: 'Tháng cần phân tích sức khỏe (Dạng YYYY-MM).', required: true }
        ]
    },
    {
        name: 'reconcile_finance_and_salary',
        description: 'Kịch bản đối soát chéo tài chính chi nhánh: ca làm việc KTV, hoa hồng lương nháp, dòng tiền và nợ đọng khách hàng.',
        arguments: [
            { name: 'tenant_id', description: 'UUID của chi nhánh.', required: true },
            { name: 'month_year', description: 'Tháng cần đối soát (Dạng YYYY-MM).', required: true }
        ]
    },
    {
        name: 'customer_retention_audit',
        description: 'Kịch bản giám sát tiến trình thẻ liệu trình, rủi ro rời bỏ của khách và đề xuất tin nhắn nhắc lịch Zalo ZNS tương tác.',
        arguments: [
            { name: 'tenant_id', description: 'UUID của chi nhánh.', required: true }
        ]
    }
];
export function registerPrompts(server) {
    // 1. List available prompts
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
            prompts: PROMPT_TEMPLATES
        };
    });
    // 2. Get details for a specific prompt
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const tenantId = args?.tenant_id || '';
        const monthYear = args?.month_year || '';
        if (name === 'analyze_monthly_business') {
            return {
                description: 'Phân tích báo cáo tài chính P&L và sức khỏe vận hành chi nhánh hàng tháng.',
                messages: [
                    {
                        role: 'user',
                        content: `Bạn là chuyên gia phân tích vận hành cấp cao của Bella Spa. Hãy thực hiện quy trình phân tích sức khỏe chi nhánh dưới đây cho chi nhánh có ID "${tenantId}" cho tháng "${monthYear}":

1. **Phân tích Tài chính**: Hãy gọi công cụ \`get_financial_performance\` để thu thập dữ liệu P&L chi tiết. Phân tích cơ cấu doanh thu theo loại, các danh mục chi phí chiếm tỷ trọng cao và tính toán tỷ suất lợi nhuận ròng. Đánh giá số tiền phí nhượng quyền (Franchise Royalty) phải trích lập.
2. **Phát hiện Bất thường**: Gọi công cụ \`detect_financial_anomalies\` để tìm kiếm các lỗ rò rỉ dòng tiền: các khoản nợ của khách hàng có ca trị liệu trễ hẹn hoặc các chi phí bất thường cần phê duyệt.
3. **Hiệu năng & Quỹ lương**: Gọi công cụ \`calculate_salary_projection\` để ước tính quỹ lương và hoa hồng KTV của tháng. Chỉ ra KTV nào hoạt động năng suất nhất và tổng hoa hồng KTV đang tích lũy.
4. **Hao hụt Kho**: Gọi công cụ \`forecast_inventory_depletion\` để kiểm tra lượng tồn kho và dự báo thời điểm cạn kho vật tư.
5. **Tổng hợp Báo cáo**: Tổng hợp toàn bộ phát hiện của bạn thành một bảng báo cáo P&L sắc nét, chỉ rõ 3 phát hiện rủi ro vận hành quan trọng nhất và đưa ra 3 đề xuất tối ưu hóa doanh thu & giảm chi phí thực tiễn cho chủ chi nhánh nhượng quyền.`
                    }
                ]
            };
        }
        if (name === 'reconcile_finance_and_salary') {
            return {
                description: 'Đối soát chéo tài chính chi nhánh: ca làm việc KTV, hoa hồng lương nháp, dòng tiền và nợ đọng khách hàng.',
                messages: [
                    {
                        role: 'user',
                        content: `Hãy đóng vai trò Kế toán trưởng hệ thống Bella Spa ERP. Thực hiện đối soát chéo tài chính chi nhánh "${tenantId}" cho tháng "${monthYear}" theo các bước sau:

1. Thu thập dự phóng bảng lương và số ca KTV làm việc thực tế thông qua công cụ \`calculate_salary_projection\`.
2. Kiểm tra xem có bất kỳ sự bất thường tài chính nào (như các ca nợ đọng của khách hàng làm quá số buổi nhưng chưa thu đủ tiền) bằng cách gọi \`detect_financial_anomalies\`.
3. Kiểm tra xem có khoản doanh thu cọc/thanh toán nào của khách hàng đang ở trạng thái "pending" chưa được kế toán đối soát thực tế vào tài khoản ngân hàng chi nhánh hay không.
4. Tổng hợp biên bản đối soát:
   * Xác nhận số KTV được đề xuất phê duyệt bảng lương.
   * Danh sách khách hàng nợ đọng cần thu hồi nợ kèm số tiền nợ dự kiến.
   * Danh sách giao dịch thu chi chưa được khớp số dư cần phê duyệt.`
                    }
                ]
            };
        }
        if (name === 'customer_retention_audit') {
            return {
                description: 'Giám sát tiến trình thẻ liệu trình, rủi ro rời bỏ của khách và đề xuất tin nhắn nhắc lịch Zalo ZNS tương tác.',
                messages: [
                    {
                        role: 'user',
                        content: `Bạn là Trưởng bộ phận Chăm Sóc Khách Hàng (CSKH) Bella Spa. Hãy rà soát chất lượng dịch vụ của chi nhánh "${tenantId}" để ngăn ngừa khách hàng rời bỏ gói dịch vụ (Bé tắm & Mẹ massage):

1. **Quét lịch hẹn hôm nay**: Gọi công cụ \`propose_zalo_reminders\` để lấy danh sách các ca hẹn chăm sóc trong ngày chưa được gửi nhắc lịch qua Zalo ZNS.
2. **Khảo sát phản hồi & Liệu trình**:
   * Quét và kiểm tra các ca trị liệu đang chạy để phát hiện xem có khách hàng nào có ca làm việc bị đứt quãng quá 5 ngày liên tục không bằng cách gọi công cụ \`inspect_customer_treatment_progress\` cho các hợp đồng đang hoạt động.
   * Đánh giá các ca có đánh giá sao thấp (< 4 sao).
3. **Đề xuất Hành động (Human-in-the-loop)**:
   * Trình bày danh sách đề xuất tin nhắn nhắc lịch Zalo ZNS chi tiết, định dạng rõ ràng để nhân viên chỉ cần duyệt và kích hoạt gửi thật.
   * Lên kịch bản tin nhắn CSKH đặc biệt dành riêng cho các mẹ bầu bị trễ ca trị liệu hoặc có đánh giá không tốt để nhân viên gọi điện hỗ trợ ngay lập tức.`
                    }
                ]
            };
        }
        throw new Error(`Prompt template not found: ${name}`);
    });
}
