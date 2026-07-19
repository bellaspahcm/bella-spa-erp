import nodemailer from 'nodemailer';

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Sends a temporary password email to a newly created staff member
 */
export async function sendTemporaryPasswordEmail(
  email: string,
  fullName: string,
  temporaryPassword: string
): Promise<SendEmailResult> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM || 'noreply@bellaspa.vn';
  const emailFromName = process.env.EMAIL_FROM_NAME || 'Bella Spa ERP';

  // Check if SMTP is configured
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    const errorMsg = 'SMTP credentials are not configured in environment variables.';
    console.warn(`[MailService] ${errorMsg} Email was not sent to ${email}.`);
    return {
      success: false,
      error: 'SMTP_CONFIG_MISSING',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: process.env.SMTP_SECURE === 'true' || parseInt(smtpPort, 10) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #f472b6; padding-bottom: 20px; margin-bottom: 20px;">
          <h2 style="color: #db2777; margin: 0;">Bella Spa ERP</h2>
          <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Thông tin tài khoản nhân sự mới</p>
        </div>
        
        <p>Xin chào <strong>${fullName}</strong>,</p>
        
        <p>Chào mừng bạn gia nhập đội ngũ nhân sự của Bella Spa. Tài khoản truy cập hệ thống quản lý nội bộ <strong>Bella Spa ERP</strong> của bạn đã được khởi tạo thành công.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151; font-size: 16px;">Thông tin đăng nhập của bạn:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #4b5563; font-weight: bold; width: 140px;">Địa chỉ Email:</td>
              <td style="padding: 6px 0; color: #1f2937; font-family: monospace; font-size: 15px;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #4b5563; font-weight: bold;">Mật khẩu tạm thời:</td>
              <td style="padding: 6px 0; color: #1f2937; font-family: monospace; font-size: 15px; letter-spacing: 0.5px;"><strong>${temporaryPassword}</strong></td>
            </tr>
          </table>
        </div>
        
        <p style="color: #ef4444; font-weight: bold;">Lưu ý quan trọng:</p>
        <ul style="color: #4b5563; padding-left: 20px; line-height: 1.6;">
          <li>Mật khẩu trên là mật khẩu tạm thời được tạo tự động bởi hệ thống.</li>
          <li>Vì lý do an toàn bảo mật, vui lòng tiến hành <strong>đổi mật khẩu mới</strong> ngay sau lần đầu tiên đăng nhập thành công.</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0 10px 0;">
          <a href="${appUrl}/login" style="background-color: #db2777; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 9999px; font-weight: bold; display: inline-block;">Đăng nhập hệ thống</a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0 20px 0;" />
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          Đây là email tự động từ hệ thống Bella Spa ERP. Vui lòng không phản hồi lại email này.
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"${emailFromName}" <${emailFrom}>`,
      to: email,
      subject: `[Bella Spa ERP] Thông tin tài khoản nhân sự mới của ${fullName}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MailService] Email sent successfully to ${email}. MessageId: ${info.messageId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[MailService] Failed to send email to ${email}:`, error);
    return {
      success: false,
      error: error?.message || 'SMTP_SEND_FAILED',
    };
  }
}
