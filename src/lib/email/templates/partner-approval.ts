/**
 * Partner Approval Email Template
 * 
 * Sent when admin approves partner application
 * Includes activation link to set password
 */

export interface PartnerApprovalEmailParams {
  applicantName: string;
  businessName: string;
  activationUrl: string;
  expiresInHours: number;
  tenantSubdomain?: string;
}

export function generatePartnerApprovalEmail(params: PartnerApprovalEmailParams) {
  const { applicantName, businessName, activationUrl, expiresInHours, tenantSubdomain } = params;

  const subject = `🎉 Chúc mừng! Đơn đăng ký đối tác đã được phê duyệt - ${businessName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #10b981;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #10b981;
      margin-bottom: 10px;
    }
    .icon {
      font-size: 64px;
      margin: 20px 0;
    }
    h1 {
      color: #10b981;
      font-size: 24px;
      margin: 0 0 20px 0;
    }
    .content {
      margin: 30px 0;
    }
    .highlight-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-label {
      font-weight: 600;
      color: #6b7280;
    }
    .info-value {
      color: #111827;
    }
    .cta-button {
      display: inline-block;
      background-color: #10b981;
      color: white;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .cta-button:hover {
      background-color: #059669;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
    }
    .next-steps {
      background-color: #eff6ff;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .next-steps h3 {
      color: #1e40af;
      margin-top: 0;
    }
    .next-steps ol {
      margin: 10px 0;
      padding-left: 20px;
    }
    .next-steps li {
      margin: 10px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .support-info {
      background-color: #f9fafb;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo">BELLA ERP</div>
      <div>Partner Portal</div>
    </div>

    <div class="icon" style="text-align: center;">🎉</div>

    <h1 style="text-align: center;">Chúc Mừng! Đơn Đăng Ký Đã Được Phê Duyệt</h1>

    <div class="content">
      <p>Xin chào <strong>${applicantName}</strong>,</p>

      <p>Chúng tôi rất vui mừng thông báo rằng đơn đăng ký đối tác của <strong>${businessName}</strong> đã được <strong>phê duyệt</strong>! 🎊</p>

      <div class="highlight-box">
        <p style="margin: 0; font-size: 16px; color: #047857;">
          <strong>✅ Trạng thái:</strong> Đã phê duyệt<br>
          <strong>🏢 Doanh nghiệp:</strong> ${businessName}${tenantSubdomain ? `<br><strong>🔗 Tenant:</strong> ${tenantSubdomain}.bella-erp.com` : ''}
        </p>
      </div>

      <div class="next-steps">
        <h3>📋 Các Bước Tiếp Theo</h3>
        <ol>
          <li><strong>Kích hoạt tài khoản</strong> - Click nút bên dưới để đặt mật khẩu</li>
          <li><strong>Đăng nhập hệ thống</strong> - Truy cập ERP với thông tin đã đăng ký</li>
          <li><strong>Khám phá tính năng</strong> - Làm quen với các module quản lý</li>
          <li><strong>Nhập dữ liệu</strong> - Bắt đầu nhập dữ liệu khách hàng, dịch vụ</li>
          <li><strong>Liên hệ support</strong> - Nếu cần hỗ trợ hoặc đào tạo</li>
        </ol>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${activationUrl}" class="cta-button">
          🚀 Kích Hoạt Tài Khoản Ngay
        </a>
      </div>

      <div class="warning">
        <strong>⏰ Lưu ý quan trọng:</strong><br>
        Link kích hoạt này có hiệu lực trong <strong>${expiresInHours} giờ</strong>. Sau thời gian này, bạn sẽ cần liên hệ admin để được cấp link mới.
      </div>

      <p>Hoặc copy link sau vào trình duyệt:</p>
      <div style="background-color: #f3f4f6; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 12px; font-family: monospace;">
        ${activationUrl}
      </div>

      <div class="support-info">
        <strong>🆘 Cần Hỗ Trợ?</strong><br>
        Email: support@bella-erp.com<br>
        Hotline: 1900-xxxx-xxx<br>
        Giờ làm việc: 8:00 - 18:00 (Thứ 2 - Thứ 6)
      </div>

      <p>Chúc bạn sử dụng hệ thống hiệu quả và thành công!</p>

      <p style="margin-top: 30px;">
        Trân trọng,<br>
        <strong>Bella ERP Team</strong>
      </p>
    </div>

    <div class="footer">
      <p>Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
      <p>© ${new Date().getFullYear()} Bella ERP. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
BELLA ERP - PARTNER PORTAL

🎉 CHÚC MỪNG! ĐƠN ĐĂNG KÝ ĐÃ ĐƯỢC PHÊ DUYỆT

Xin chào ${applicantName},

Chúng tôi rất vui mừng thông báo rằng đơn đăng ký đối tác của ${businessName} đã được PHÊ DUYỆT!

✅ Trạng thái: Đã phê duyệt
🏢 Doanh nghiệp: ${businessName}${tenantSubdomain ? `\n🔗 Tenant: ${tenantSubdomain}.bella-erp.com` : ''}

📋 CÁC BƯỚC TIẾP THEO:
1. Kích hoạt tài khoản - Click link bên dưới để đặt mật khẩu
2. Đăng nhập hệ thống - Truy cập ERP với thông tin đã đăng ký
3. Khám phá tính năng - Làm quen với các module quản lý
4. Nhập dữ liệu - Bắt đầu nhập dữ liệu khách hàng, dịch vụ
5. Liên hệ support - Nếu cần hỗ trợ hoặc đào tạo

🚀 KÍCH HOẠT TÀI KHOẢN:
${activationUrl}

⏰ LƯU Ý QUAN TRỌNG:
Link kích hoạt này có hiệu lực trong ${expiresInHours} giờ. Sau thời gian này, bạn sẽ cần liên hệ admin để được cấp link mới.

🆘 CẦN HỖ TRỢ?
Email: support@bella-erp.com
Hotline: 1900-xxxx-xxx
Giờ làm việc: 8:00 - 18:00 (Thứ 2 - Thứ 6)

Chúc bạn sử dụng hệ thống hiệu quả và thành công!

Trân trọng,
Bella ERP Team

---
Email này được gửi tự động, vui lòng không trả lời trực tiếp.
© ${new Date().getFullYear()} Bella ERP. All rights reserved.
  `.trim();

  return { subject, html, text };
}
