import nodemailer from 'nodemailer';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(email: string, firstName: string, token: string) {
    const verificationUrl = `${process.env.API_GATEWAY_URL || 'http://localhost:3000'}/api/users/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"E-Learning AI" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Xác thực tài khoản E-Learning AI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Xác thực tài khoản</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎓 E-Learning AI</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #495057; margin-top: 0;">Chào ${firstName}!</h2>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Cảm ơn bạn đã đăng ký tài khoản E-Learning AI. Để hoàn tất quá trình đăng ký, vui lòng xác thực địa chỉ email của bạn.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        text-decoration: none; 
                        padding: 15px 30px; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                ✅ Xác thực tài khoản
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6c757d; margin-top: 25px;">
              Nếu bạn không thể nhấp vào nút trên, hãy sao chép và dán liên kết sau vào trình duyệt:
            </p>
            <p style="font-size: 12px; background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all;">
              ${verificationUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 25px 0;">
            
            <p style="font-size: 12px; color: #6c757d; text-align: center; margin: 0;">
              Email này có hiệu lực trong 24 giờ. Nếu bạn không yêu cầu tạo tài khoản, vui lòng bỏ qua email này.
            </p>
          </div>
        </body>
        </html>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetEmail(email: string, firstName: string, token: string) {
    const resetUrl = `${process.env.API_GATEWAY_URL || 'http://localhost:3000'}/api/users/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"E-Learning AI" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Đặt lại mật khẩu E-Learning AI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Đặt lại mật khẩu</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 E-Learning AI</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #495057; margin-top: 0;">Chào ${firstName}!</h2>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản E-Learning AI của bạn.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); 
                        color: white; 
                        text-decoration: none; 
                        padding: 15px 30px; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);">
                🔑 Đặt lại mật khẩu
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6c757d; margin-top: 25px;">
              Nếu bạn không thể nhấp vào nút trên, hãy sao chép và dán liên kết sau vào trình duyệt:
            </p>
            <p style="font-size: 12px; background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all;">
              ${resetUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 25px 0;">
            
            <p style="font-size: 12px; color: #6c757d; text-align: center; margin: 0;">
              Email này có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
            </p>
          </div>
        </body>
        </html>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    const mailOptions = {
      from: `"E-Learning AI" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Chào mừng đến với E-Learning AI! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Chào mừng</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Chào mừng!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #495057; margin-top: 0;">Xin chào ${firstName}!</h2>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Chào mừng bạn đến với E-Learning AI - nền tảng học tiếng Anh thông minh với công nghệ AI tiên tiến!
            </p>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1976d2; margin-top: 0;">🚀 Bắt đầu hành trình học tập:</h3>
              <ul style="color: #424242; padding-left: 20px;">
                <li>📚 Khám phá các khóa học từ cơ bản đến nâng cao</li>
                <li>🎯 Luyện phát âm với AI thông minh</li>
                <li>💬 Trò chuyện với chatbot AI</li>
                <li>🏆 Theo dõi tiến trình và nhận achievement</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.API_GATEWAY_URL || 'http://localhost:3000'}" 
                 style="background: linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%); 
                        color: white; 
                        text-decoration: none; 
                        padding: 15px 30px; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 4px 15px rgba(45, 212, 191, 0.3);">
                🎓 Bắt đầu học ngay
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 25px 0;">
            
            <p style="font-size: 12px; color: #6c757d; text-align: center; margin: 0;">
              Cảm ơn bạn đã tin tương và chọn E-Learning AI. Chúc bạn học tập hiệu quả!
            </p>
          </div>
        </body>
        </html>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }
}

export const emailService = new EmailService(); 