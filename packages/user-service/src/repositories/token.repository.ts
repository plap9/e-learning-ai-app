import { Token, Prisma, PrismaClient, TokenType } from '@prisma/client';
import { BaseRepository, IBaseRepository } from './base.repository';

/**
 * Token Repository Interface
 * Extends base repository with token-specific operations
 */
export interface ITokenRepository extends IBaseRepository<Token> {
  findByToken(token: string): Promise<Token | null>;
  findByUserAndType(userId: string, type: TokenType): Promise<Token | null>;
  createVerificationToken(userId: string, token: string, expiresAt: Date): Promise<Token>;
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<Token>;
  markTokenAsUsed(id: string): Promise<Token>;
  deleteExpiredTokens(): Promise<number>;
  findValidToken(token: string, type: TokenType): Promise<Token | null>;
  revokeUserTokens(userId: string, type?: TokenType): Promise<number>;
}

/**
 * Token Repository Implementation
 * Handles all database operations for Token entity
 */
export class TokenRepository extends BaseRepository implements ITokenRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Find token by ID
   */
  async findById(id: string): Promise<Token | null> {
    return await this.prisma.token.findUnique({
      where: { id }
    });
  }

  /**
   * Find token by token string
   */
  async findByToken(token: string): Promise<Token | null> {
    return await this.prisma.token.findUnique({
      where: { token }
    });
  }

  /**
   * Find token by user ID and type
   */
  async findByUserAndType(userId: string, type: TokenType): Promise<Token | null> {
    return await this.prisma.token.findFirst({
      where: {
        userId,
        type,
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Find multiple tokens with optional filters
   */
  async findMany(filters?: Prisma.TokenWhereInput): Promise<Token[]> {
    return await this.prisma.token.findMany({
      where: filters,
      orderBy: { 
        createdAt: 'desc' 
      }
    });
  }

  /**
   * Create new token
   */
  async create(data: Omit<Token, 'id' | 'createdAt'>): Promise<Token> {
    return await this.prisma.token.create({
      data
    });
  }

  /**
   * Create email verification token
   */
  async createVerificationToken(userId: string, token: string, expiresAt: Date): Promise<Token> {
    return await this.prisma.token.create({
      data: {
        userId,
        token,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt,
        isUsed: false
      }
    });
  }

  /**
   * Create password reset token
   */
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<Token> {
    return await this.prisma.token.create({
      data: {
        userId,
        token,
        type: TokenType.PASSWORD_RESET,
        expiresAt,
        isUsed: false
      }
    });
  }

  /**
   * Update token
   */
  async update(id: string, data: Partial<Token>): Promise<Token> {
    return await this.prisma.token.update({
      where: { id },
      data
    });
  }

  /**
   * Mark token as used
   */
  async markTokenAsUsed(id: string): Promise<Token> {
    return await this.prisma.token.update({
      where: { id },
      data: {
        isUsed: true
      }
    });
  }

  /**
   * Delete token
   */
  async delete(id: string): Promise<void> {
    await this.prisma.token.delete({
      where: { id }
    });
  }

  /**
   * Check if token exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.token.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * Find valid (not used and not expired) token
   */
  async findValidToken(token: string, type: TokenType): Promise<Token | null> {
    return await this.prisma.token.findFirst({
      where: {
        token,
        type,
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });
  }

  /**
   * Delete expired tokens (cleanup job)
   */
  async deleteExpiredTokens(): Promise<number> {
    const result = await this.prisma.token.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: new Date()
            }
          },
          {
            isUsed: true,
            createdAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
            }
          }
        ]
      }
    });
    return result.count;
  }

  /**
   * Revoke all tokens for a user (useful for logout all devices)
   */
  async revokeUserTokens(userId: string, type?: TokenType): Promise<number> {
    const whereClause: Prisma.TokenWhereInput = {
      userId,
      isUsed: false
    };

    if (type) {
      whereClause.type = type;
    }

    const result = await this.prisma.token.updateMany({
      where: whereClause,
      data: {
        isUsed: true
      }
    });

    return result.count;
  }
} 