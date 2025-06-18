import { PrismaClient } from '@prisma/client';

/**
 * Base Repository Interface
 * Defines common repository operations following Repository Pattern
 */
export interface IBaseRepository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findMany(filters?: any): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

/**
 * Pagination Interface
 */
export interface IPaginationOptions {
  page?: number;
  limit?: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Base Repository Abstract Class
 * Provides common functionality for all repositories
 */
export abstract class BaseRepository {
  protected prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Calculate pagination metadata
   */
  protected calculatePagination(
    page: number,
    limit: number,
    total: number
  ) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  /**
   * Generate pagination options for Prisma
   */
  protected getPaginationOptions(page: number = 1, limit: number = 10) {
    return {
      skip: (page - 1) * limit,
      take: limit
    };
  }

  /**
   * Execute database operation with transaction
   */
  protected async executeInTransaction<T>(
    operation: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(operation);
  }
} 