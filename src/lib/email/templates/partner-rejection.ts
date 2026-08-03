/**
 * Partner Rejection Email Template
 * 
 * Sent when admin rejects partner application
 * Includes rejection reason and re-application guidance
 */

export interface PartnerRejectionEmailParams {
  applicantName: string;
  businessName: string;
  rejectionReason: string;
  canReapply?: boolean;
  reapplyUrl?: string;
}

export function generatePartnerRejectionEmail(params: PartnerRejectionEmailParams) {
  const { applicantName, businessName, rejectionReason, canReapply = true, reapplyUrl } = params;

  const subject = `Thông báo về đơn đăng ký đối tác - ${businessName}`;

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
      border-bottom: 3px solid #ef4444;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #ef4444;
      margin-bottom: 10px;
    }
    .icon {
      font-size: 64px;
      margin: 20px 0;
    }
    h1 {
      color: #dc2626;
      font-size: 24px;
      margin: 0 0 20px 0;
    }
    .content {
      margin: 30px 0;
    }
    .rejection-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .rejection-reason {
      background-color: #fff;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
      font-size: 15px;
      color: #991b1b;
    }
    .cta-button {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .cta-button:hover {
      background-color: #2563eb;
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

    <div class="icon" style="text-align: center;">📋</div>

    <h1 style="text-align: center;">Thông Báo Về Đơn Đăng Ký Đối Tác</h1>

    <div class="content">
      <p>Xin chào <strong>${applicantName}</strong>,</p>

      <p>Cảm ơn bạn đã quan tâm và gửi đơn đăng ký đối tác cho <strong>${businessName}</strong> tại hệ thống Bella ERP.</p>

      <div class="rejection-box">
        <p style="margin: 0 0 10px 0; font-size: 16px; color: #991b1b;">
          <strong>❌ Trạng thái:</strong> Đơn đăng ký chưa được phê duyệt
        </p>
        <div class="rejection-reason">
          <strong>Lý do:</strong><br>
          ${rejectionReason}
        </div>
      </div>

      <p>Chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn chưa đáp ứng được các tiêu chí hiện tại. Tuy nhiên, điều này không có nghĩa là cánh cửa hợp tác đã đóng lại.</p>

      ${canReapply ? `
      <div class="info-box">
        <h3>🔄 Cơ Hội Đăng Ký Lại</h3>
        <p>Bạn hoàn toàn có thể đăng ký lại sau khi:</p>
        <ul>
          <li>Xem xét và khắc phục các vấn đề được nêu trong lý do từ chối</li>
          <li>Chuẩn bị đầy đủ hơn các thông tin và tài liệu yêu cầu</li>
          <li>Đảm bảo thông tin đăng ký chính xác và đầy đủ</li>
          <li>Liên hệ với bộ phận hỗ trợ nếu cần làm rõ bất kỳ điểm nào</li>
        </ul>
      </div>

      ${reapplyUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${reapplyUrl}" class="cta-button">
          🔄 Đăng Ký Lại
        </a>
      </div>
      ` : ''}
      ` : `
      <div class="info-box">
        <h3>📞 Liên Hệ Với Chúng Tôi</h3>
        <p>Nếu bạn có bất kỳ thắc mắc nào về quyết định này hoặc muốn tìm hiểu thêm về các tiêu chí đối tác, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
      </div>
      `}

      <div class="support-info">
        <strong>🆘 Cần Hỗ Trợ?</strong><br>
        Email: support@bella-erp.com<br>
        Hotline: 1900-xxxx-xxx<br>
        Giờ làm việc: 8:00 - 18:00 (Thứ 2 - Thứ 6)
      </div>

      <p>Cảm ơn bạn đã dành thời gian và chúng tôi mong có cơ hội hợp tác trong tương lai.</p>

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

THÔNG BÁO VỀ ĐƠN ĐĂNG KÝ ĐỐI TÁC

Xin chào ${applicantName},

Cảm ơn bạn đã quan tâm và gửi đơn đăng ký đối tác cho ${businessName} tại hệ thống Bella ERP.

❌ TRẠNG THÁI: Đơn đăng ký chưa được phê duyệt

LÝ DO:
${rejectionReason}

Chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn chưa đáp ứng được các tiêu chí hiện tại. Tuy nhiên, điều này không có nghĩa là cánh cửa hợp tác đã đóng lại.

${canReapply ? `
🔄 CƠ HỘI ĐĂNG KÝ LẠI

Bạn hoàn toàn có thể đăng ký lại sau khi:
- Xem xét và khắc phục các vấn đề được nêu trong lý do từ chối
- Chuẩn bị đầy đủ hơn các thông tin và tài liệu yêu cầu
- Đảm bảo thông tin đăng ký chính xác và đầy đủ
- Liên hệ với bộ phận hỗ trợ nếu cần làm rõ bất kỳ điểm nào

${reapplyUrl ? `ĐĂNG KÝ LẠI TẠI: ${reapplyUrl}` : ''}
` : `
📞 LIÊN HỆ VỚI CHÚNG TÔI

Nếu bạn có bất kỳ thắc mắc nào về quyết định này hoặc muốn tìm hiểu thêm về các tiêu chí đối tác, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.
`}

🆘 CẦN HỖ TRỢ?
Email: support@bella-erp.com
Hotline: 1900-xxxx-xxx
Giờ làm việc: 8:00 - 18:00 (Thứ 2 - Thứ 6)

Cảm ơn bạn đã dành thời gian và chúng tôi mong có cơ hội hợp tác trong tương lai.

Trân trọng,
Bella ERP Team

---
Email này được gửi tự động, vui lòng không trả lời trực tiếp.
© ${new Date().getFullYear()} Bella ERP. All rights reserved.
  `.trim();

  return { subject, html, text };
}
