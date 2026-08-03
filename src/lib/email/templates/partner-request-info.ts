/**
 * Partner Request Additional Info Email Template
 * 
 * Sent when admin requests more information from partner
 * Includes specific items requested and submission instructions
 */

export interface PartnerRequestInfoEmailParams {
  applicantName: string;
  businessName: string;
  requestedInfo: string;
  submissionUrl?: string;
  adminName?: string;
  adminEmail?: string;
}

export function generatePartnerRequestInfoEmail(params: PartnerRequestInfoEmailParams) {
  const { applicantName, businessName, requestedInfo, submissionUrl, adminName, adminEmail } = params;

  const subject = `Yêu cầu bổ sung thông tin - Đơn đăng ký đối tác ${businessName}`;

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
      border-bottom: 3px solid #f59e0b;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #f59e0b;
      margin-bottom: 10px;
    }
    .icon {
      font-size: 64px;
      margin: 20px 0;
    }
    h1 {
      color: #d97706;
      font-size: 24px;
      margin: 0 0 20px 0;
    }
    .content {
      margin: 30px 0;
    }
    .status-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .request-box {
      background-color: #fff;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 20px;
      margin: 15px 0;
      font-size: 15px;
    }
    .request-box h3 {
      color: #92400e;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .cta-button {
      display: inline-block;
      background-color: #f59e0b;
      color: white;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .cta-button:hover {
      background-color: #d97706;
    }
    .info-box {
      background-color: #eff6ff;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-box h3 {
      color: #1e40af;
      margin-top: 0;
    }
    .info-box ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .info-box li {
      margin: 8px 0;
    }
    .admin-contact {
      background-color: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
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

    <div class="icon" style="text-align: center;">📝</div>

    <h1 style="text-align: center;">Yêu Cầu Bổ Sung Thông Tin</h1>

    <div class="content">
      <p>Xin chào <strong>${applicantName}</strong>,</p>

      <p>Cảm ơn bạn đã gửi đơn đăng ký đối tác cho <strong>${businessName}</strong>. Chúng tôi đang xem xét đơn của bạn và cần thêm một số thông tin để hoàn tất quá trình đánh giá.</p>

      <div class="status-box">
        <p style="margin: 0 0 10px 0; font-size: 16px; color: #92400e;">
          <strong>⏳ Trạng thái:</strong> Đang chờ bổ sung thông tin<br>
          <strong>🏢 Doanh nghiệp:</strong> ${businessName}
        </p>
      </div>

      <div class="request-box">
        <h3>📋 Thông Tin Cần Bổ Sung:</h3>
        <div style="white-space: pre-wrap; color: #1f2937;">${requestedInfo}</div>
      </div>

      <div class="info-box">
        <h3>📤 Cách Thức Gửi Thông Tin</h3>
        <ul>
          <li><strong>Email trực tiếp:</strong> Trả lời email này hoặc gửi tới ${adminEmail || 'support@bella-erp.com'}</li>
          ${submissionUrl ? `<li><strong>Qua portal:</strong> Cập nhật thông tin trực tuyến (nút bên dưới)</li>` : ''}
          <li><strong>Điện thoại:</strong> Liên hệ hotline nếu cần hướng dẫn chi tiết</li>
        </ul>
      </div>

      ${submissionUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${submissionUrl}" class="cta-button">
          📤 Cập Nhật Thông Tin
        </a>
      </div>
      ` : ''}

      ${adminName || adminEmail ? `
      <div class="admin-contact">
        <strong>👤 Người Phụ Trách:</strong><br>
        ${adminName ? `Tên: ${adminName}<br>` : ''}
        ${adminEmail ? `Email: ${adminEmail}<br>` : ''}
        Vui lòng liên hệ trực tiếp nếu có bất kỳ câu hỏi nào.
      </div>
      ` : ''}

      <p>Chúng tôi sẽ tiếp tục xử lý đơn đăng ký của bạn ngay sau khi nhận được đầy đủ thông tin. Thời gian xử lý thông thường là 2-3 ngày làm việc.</p>

      <div class="support-info">
        <strong>🆘 Cần Hỗ Trợ?</strong><br>
        Email: support@bella-erp.com<br>
        Hotline: 1900-xxxx-xxx<br>
        Giờ làm việc: 8:00 - 18:00 (Thứ 2 - Thứ 6)
      </div>

      <p>Cảm ơn bạn đã hợp tác!</p>

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

YÊU CẦU BỔ SUNG THÔNG TIN

Xin chào ${applicantName},

Cảm ơn bạn đã gửi đơn đăng ký đối tác cho ${businessName}. Chúng tôi đang xem xét đơn của bạn và cần thêm một số thông tin để hoàn tất quá trình đánh giá.

⏳ TRẠNG THÁI: Đang chờ bổ sung thông tin
🏢 DOANH NGHIỆP: ${businessName}

📋 THÔNG TIN CẦN BỔ SUNG:
${requestedInfo}

📤 CÁCH THỨC GỬI THÔNG TIN:
- Email trực tiếp: Trả lời email này hoặc gửi tới ${adminEmail || 'support@bella-erp.com'}
${submissionUrl ? `- Qua portal: ${submissionUrl}` : ''}
- Điện thoại: Liên hệ hotline nếu cần hướng dẫn chi tiết

${adminName || adminEmail ? `
👤 NGƯỜI PHỤ TRÁCH:
${adminName ? `Tên: ${adminName}` : ''}
${adminEmail ? `Email: ${adminEmail}` : ''}
Vui lòng liên hệ trực tiếp nếu có bất kỳ câu hỏi nào.
` : ''}

Chúng tôi sẽ tiếp tục xử lý đơn đăng ký của bạn ngay sau khi nhận được đầy đủ thông tin. Thời gian xử lý thông thường là 2-3 ngày làm việc.

🆘 CẦN HỖ TRỢ?
Email: support@bella-erp.com
Hotline: 1900-xxxx-xxx
Giờ làm việc: 8:00 - 18:00 (Thứ 2 - Thứ 6)

Cảm ơn bạn đã hợp tác!

Trân trọng,
Bella ERP Team

---
Email này được gửi tự động, vui lòng không trả lời trực tiếp.
© ${new Date().getFullYear()} Bella ERP. All rights reserved.
  `.trim();

  return { subject, html, text };
}
