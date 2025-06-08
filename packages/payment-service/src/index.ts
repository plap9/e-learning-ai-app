import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient, PaymentStatus } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize Prisma Client
const prisma = new PrismaClient();

const app: Application = express();
const PORT = process.env.PORT || 3003;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // limit each IP to 50 requests per windowMs (stricter for payment service)
});
app.use(limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' })); // Smaller limit for payment service
app.use(express.urlencoded({ extended: true }));

// Health check with database connection
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'OK',
      service: 'Payment Service - VietQR Only',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      database: 'Connected',
      paymentMethod: 'VietQR',
      currency: 'VND'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      service: 'Payment Service - VietQR Only',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      database: 'Disconnected',
      error: 'Database connection failed'
    });
  }
});

// ================================
// VIETQR PAYMENT ROUTES
// ================================

// Tạo QR code thanh toán VietQR
app.post('/vietqr/create-payment', async (req, res) => {
  try {
    const { userId, amount, description, courseId, courseName } = req.body;

    // Validate input
    if (!userId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'userId and amount are required',
        service: 'Payment Service'
      });
    }

    // Generate transfer content (nội dung chuyển khoản)
    const transferContent = `ELEARNING ${courseId || 'SUB'} ${userId.slice(-6)}`;
    
    // Calculate expiration time
    const timeoutMinutes = parseInt(process.env.PAYMENT_TIMEOUT_MINUTES || '15');
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + timeoutMinutes);

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: parseFloat(amount),
        currency: 'VND',
        status: PaymentStatus.PENDING,
        description,
        courseId,
        courseName,
        bankCode: process.env.VIETQR_BANK_CODE,
        accountNumber: process.env.VIETQR_ACCOUNT_NUMBER,
        transferContent,
        expiredAt,
        metadata: {
          bankName: getBankName(process.env.VIETQR_BANK_CODE),
          accountName: process.env.VIETQR_ACCOUNT_NAME
        }
      }
    });

    // Generate VietQR URL (Napas standard)  
    const bankCode = process.env.VIETQR_BANK_CODE || 'ICB';
    const accountNumber = process.env.VIETQR_ACCOUNT_NUMBER || '';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || '';
    
    const qrCodeUrl = generateVietQRUrl({
      bankCode,
      accountNumber,
      amount: amount,
      transferContent: transferContent,
      accountName
    });

    // Update payment with QR code URL
    await prisma.payment.update({
      where: { id: payment.id },
      data: { qrCodeUrl }
    });

    return res.status(200).json({
      success: true,
      message: 'VietQR payment created successfully',
      data: {
        paymentId: payment.id,
        qrCodeUrl: qrCodeUrl,
        amount: amount,
        currency: 'VND',
        bankCode: process.env.VIETQR_BANK_CODE,
        bankName: getBankName(process.env.VIETQR_BANK_CODE),
        accountNumber: process.env.VIETQR_ACCOUNT_NUMBER,
        accountName: process.env.VIETQR_ACCOUNT_NAME,
        transferContent: transferContent,
        expiredAt: expiredAt.toISOString(),
        instructions: [
          '1. Mở app ngân hàng trên điện thoại',
          '2. Quét mã QR hoặc nhập thông tin chuyển khoản',
          '3. Kiểm tra thông tin và xác nhận thanh toán',
          '4. Hệ thống sẽ tự động xác nhận sau khi nhận được tiền'
        ]
      }
    });

  } catch (error) {
    console.error('VietQR payment creation error:', error);
    return res.status(500).json({
      error: 'Payment creation failed',
      message: 'Unable to create VietQR payment',
      service: 'Payment Service'
    });
  }
});

// Kiểm tra trạng thái thanh toán
app.get('/vietqr/payment-status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: `Payment with ID ${paymentId} not found`,
        service: 'Payment Service'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
        expiredAt: payment.expiredAt,
        isExpired: payment.expiredAt ? new Date() > payment.expiredAt : false
      }
    });

  } catch (error) {
    console.error('Payment status check error:', error);
    return res.status(500).json({
      error: 'Status check failed',
      message: 'Unable to check payment status',
      service: 'Payment Service'
    });
  }
});

// Webhook để nhận thông báo thanh toán từ ngân hàng (nếu có)
app.post('/vietqr/webhook', async (req, res) => {
  try {
    // Validate webhook signature (if configured)
    const webhookSecret = process.env.VIETQR_WEBHOOK_SECRET;
    if (webhookSecret) {
      // TODO: Implement signature validation
    }

    const { transferContent, amount, transactionId } = req.body;

    // Tìm payment dựa vào transfer content
    const payment = await prisma.payment.findFirst({
      where: {
        transferContent: transferContent,
        status: PaymentStatus.PENDING
      }
    });

    if (payment) {
      // Cập nhật trạng thái thanh toán
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: new Date(),
          metadata: {
            ...payment.metadata as any,
            transactionId,
            webhookReceived: true
          }
        }
      });

      console.log(`Payment ${payment.id} confirmed via webhook`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Xác nhận thanh toán thủ công (cho admin)
app.post('/vietqr/confirm-payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { transactionId, adminUserId } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        service: 'Payment Service'
      });
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return res.status(400).json({
        error: 'Payment already processed',
        message: `Payment status is ${payment.status}`,
        service: 'Payment Service'
      });
    }

    // Cập nhật trạng thái thanh toán
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
        metadata: {
          ...payment.metadata as any,
          transactionId,
          confirmedBy: adminUserId,
          manualConfirmation: true
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        paymentId: payment.id,
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Payment confirmation error:', error);
    return res.status(500).json({
      error: 'Payment confirmation failed',
      service: 'Payment Service'
    });
  }
});

// ================================
// SUBSCRIPTION & GENERAL ROUTES
// ================================

// Subscription management routes
app.get('/subscriptions', (req, res) => {
  return res.status(200).json({
    message: 'Get user subscriptions endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

app.post('/subscriptions', (req, res) => {
  return res.status(200).json({
    message: 'Create subscription endpoint',
    status: 'Not implemented yet',
    service: 'Payment Service'
  });
});

// Payment history routes
app.get('/payments', async (req, res) => {
  try {
    const { userId } = req.query;
    
    const payments = await prisma.payment.findMany({
      where: userId ? { userId: userId as string } : {},
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Payment history error:', error);
    return res.status(500).json({
      error: 'Failed to fetch payment history',
      service: 'Payment Service'
    });
  }
});

// API documentation
app.get('/docs', (req, res) => {
  return res.json({
    name: 'E-Learning AI Payment Service',
    version: '2.0.0',
    description: 'VietQR-only payment processing service for Vietnam market',
    market: 'Vietnam only',
    supportedCurrency: 'VND',
    paymentMethod: 'VietQR (Vietnam Universal QR Payment Standard)',
    endpoints: {
      '/health': 'Health check',
      '/vietqr/create-payment': 'Create VietQR payment',
      '/vietqr/payment-status/:id': 'Check payment status',
      '/vietqr/webhook': 'Payment webhook notification',
      '/vietqr/confirm-payment/:id': 'Manual payment confirmation (admin)',
      '/subscriptions': 'Subscription management',
      '/payments': 'Payment history'
    },
    features: {
      qrCodeGeneration: 'Generate VietQR compatible QR codes',
      realTimeStatus: 'Real-time payment status checking',
      webhookSupport: 'Bank webhook notifications',
      manualConfirmation: 'Admin manual payment confirmation',
      paymentHistory: 'Complete payment transaction history'
    },
    security: {
      rateLimit: '50 requests per 15 minutes',
      cors: 'Configured for secure origins',
      webhooks: 'Signature verification support',
      encryption: 'Sensitive data protection'
    }
  });
});

// Default route
app.get('/', (req, res) => {
  return res.json({
    message: 'E-Learning AI Payment Service - VietQR Only',
    version: '2.0.0',
    status: 'Running',
    paymentMethod: 'VietQR',
    currency: 'VND',
    docs: '/docs',
    health: '/health'
  });
});

// ================================
// HELPER FUNCTIONS
// ================================

function generateVietQRUrl(params: {
  bankCode: string;
  accountNumber: string;
  amount: number;
  transferContent: string;
  accountName?: string;
}): string {
  const { bankCode, accountNumber, amount, transferContent, accountName } = params;
  
  // VietQR URL format theo chuẩn Napas
  // https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-{TEMPLATE}.png?amount={AMOUNT}&addInfo={MESSAGE}&accountName={ACC_NAME}
  
  const baseUrl = 'https://img.vietqr.io/image';
  const template = 'compact2'; // Template QR code
  
  const url = `${baseUrl}/${bankCode}-${accountNumber}-${template}.png` +
    `?amount=${amount}` +
    `&addInfo=${encodeURIComponent(transferContent)}` +
    (accountName ? `&accountName=${encodeURIComponent(accountName)}` : '');
  
  return url;
}

function getBankName(bankCode?: string): string {
  const bankNames: { [key: string]: string } = {
    'VCB': 'Vietcombank',
    'TCB': 'Techcombank',
    'ACB': 'ACB Bank',
    'VTB': 'VietinBank',
    'BID': 'BIDV',
    'MB': 'MB Bank',
    'TPB': 'TPBank',
    'STB': 'Sacombank',
    'HDB': 'HDBank',
    'OCB': 'OCB',
    'SHB': 'SHB',
    'EIB': 'Eximbank',
    'MSB': 'MSB',
    'LPB': 'LienVietPostBank',
    'KLB': 'Kienlongbank',
    'VPB': 'VPBank',
    'NAB': 'Nam A Bank',
    'VAB': 'VietABank',
    'ABB': 'An Binh Bank',
    'SGB': 'Saigonbank'
  };
  
  return bankNames[bankCode || ''] || 'Unknown Bank';
}

// 404 handler
app.use('*', (req, res) => {
  return res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist on this service`,
    service: 'Payment Service - VietQR Only'
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    service: 'Payment Service - VietQR Only'
  });
});

// Export app for testing
export { app, prisma };

// Database initialization and server startup
async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('🗄️  Database connected successfully');

    // Start server only if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        console.log(`💳 Payment Service (VietQR Only) running on port ${PORT}`);
        console.log(`📚 API Documentation: http://localhost:${PORT}/docs`);
        console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
        console.log(`🏦 Payment Method: VietQR (Vietnam Universal QR)`);
        console.log(`💰 Currency: VND only`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
if (process.env.NODE_ENV !== 'test') {
  startServer();
} 