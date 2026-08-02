/**
 * Email template for partner registration verification
 */

export interface PartnerVerificationEmailData {
  applicantName: string;
  verificationUrl: string;
  expiresInHours: number;
}

export function generatePartnerVerificationEmail(data: PartnerVerificationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { applicantName, verificationUrl, expiresInHours } = data;

  const subject = '✅ Xác nhận email đăng ký đối tác Bella ERP';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận email đăng ký</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">
                Bella ERP
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Partner Registration Portal
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                Xin chào ${applicantName}! 👋
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Cảm ơn bạn đã đăng ký trở thành đối tác của Bella ERP. 
              </p>

              <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Để hoàn tất quá trình đăng ký, vui lòng xác nhận địa chỉ email của bạn bằng cách nhấn vào nút bên dưới:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); color: white; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(244, 63, 94, 0.3);">
                      ✅ Xác nhận Email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #f43f5e; padding: 16px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  <strong>⏰ Lưu ý quan trọng:</strong><br>
                  Link xác nhận này sẽ hết hạn sau <strong>${expiresInHours} giờ</strong>. 
                  Nếu link hết hạn, bạn có thể yêu cầu gửi lại email xác nhận.
                </p>
              </div>

              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Nếu nút không hoạt động, vui lòng copy và paste link sau vào trình duyệt:
              </p>
              <p style="margin: 10px 0 0 0; padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; word-break: break-all;">
                <a href="${verificationUrl}" style="color: #f43f5e; text-decoration: none; font-size: 13px;">
                  ${verificationUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">
                Email này được gửi tự động, vui lòng không trả lời.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Bella ERP. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Xin chào ${applicantName}!

Cảm ơn bạn đã đăng ký trở thành đối tác của Bella ERP.

Để hoàn tất quá trình đăng ký, vui lòng xác nhận địa chỉ email của bạn bằng cách truy cập link sau:

${verificationUrl}

⏰ Lưu ý: Link xác nhận này sẽ hết hạn sau ${expiresInHours} giờ.

Nếu link hết hạn, bạn có thể yêu cầu gửi lại email xác nhận.

---
Email này được gửi tự động, vui lòng không trả lời.
© ${new Date().getFullYear()} Bella ERP. All rights reserved.
  `.trim();

  return { subject, html, text };
}
