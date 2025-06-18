import { User, Prisma, PrismaClient, SubscriptionStatus } from '@prisma/client';
import { BaseRepository, IBaseRepository, IPaginatedResult, IPaginationOptions } from './base.repository';

/**
 * User Repository Interface
 * Extends base repository with user-specific operations
 */
export interface IUserRepository extends IBaseRepository<User> {
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithSubscriptions(email: string): Promise<(User & { subscriptions: any[] }) | null>;
  createWithSubscription(userData: Prisma.UserCreateInput): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<User>;
  verifyEmail(id: string): Promise<User>;
  deactivateAccount(id: string): Promise<User>;
  findPaginated(options: IPaginationOptions, filters?: Prisma.UserWhereInput): Promise<IPaginatedResult<User>>;
  findActiveUsers(): Promise<User[]>;
  searchUsers(query: string, options?: IPaginationOptions): Promise<IPaginatedResult<User>>;
}

/**
 * User Repository Implementation
 * Handles all database operations for User entity
 */
export class UserRepository extends BaseRepository implements IUserRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  /**
   * Find user by email (case insensitive)
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { 
        email: email.toLowerCase() 
      }
    });
  }

  /**
   * Find user by email with active subscriptions
   */
  async findByEmailWithSubscriptions(email: string): Promise<(User & { subscriptions: any[] }) | null> {
    return await this.prisma.user.findUnique({
      where: { 
        email: email.toLowerCase() 
      },
      include: {
        subscriptions: {
          where: { 
            status: SubscriptionStatus.ACTIVE 
          },
          orderBy: { 
            createdAt: 'desc' 
          },
          take: 1
        }
      }
    });
  }

  /**
   * Find multiple users with optional filters
   */
  async findMany(filters?: Prisma.UserWhereInput): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: filters,
      orderBy: { 
        createdAt: 'desc' 
      }
    });
  }

  /**
   * Create new user
   */
  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return await this.prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Create user with default subscription
   */
  async createWithSubscription(userData: Prisma.UserCreateInput): Promise<User> {
    return await this.executeInTransaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          ...userData,
          email: userData.email.toLowerCase(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Create default FREE subscription
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: 'FREE',
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return user;
    });
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  async delete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Check if user exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * Find users with pagination
   */
  async findPaginated(
    options: IPaginationOptions = {}, 
    filters?: Prisma.UserWhereInput
  ): Promise<IPaginatedResult<User>> {
    const { page = 1, limit = 10 } = options;
    const paginationOptions = this.getPaginationOptions(page, limit);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: filters,
        ...paginationOptions,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where: filters })
    ]);

    return {
      data: users,
      pagination: this.calculatePagination(page, limit, total)
    };
  }

  /**
   * Find only active users
   */
  async findActiveUsers(): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: { 
        isActive: true 
      },
      orderBy: { 
        createdAt: 'desc' 
      }
    });
  }

  /**
   * Search users by name or email
   */
  async searchUsers(
    query: string, 
    options?: IPaginationOptions
  ): Promise<IPaginatedResult<User>> {
    const { page = 1, limit = 10 } = options || {};
    const paginationOptions = this.getPaginationOptions(page, limit);

    const searchFilter: Prisma.UserWhereInput = {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } }
      ],
      isActive: true
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: searchFilter,
        ...paginationOptions,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where: searchFilter })
    ]);

    return {
      data: users,
      pagination: this.calculatePagination(page, limit, total)
    };
  }
} 