import { Cluster as RedisCluster } from 'ioredis';

// Simple logger implementation
class SimpleLogger {
  constructor(private name: string) {}
  
  info(message: string, ...args: any[]) {
    console.log(`[${this.name}] INFO:`, message, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    console.warn(`[${this.name}] WARN:`, message, ...args);
  }
  
  error(message: string, ...args: any[]) {
    console.error(`[${this.name}] ERROR:`, message, ...args);
  }
}

interface RedisClusterConfig {
  nodes: Array<{
    host: string;
    port: number;
  }>;
  options: {
    enableReadyCheck: boolean;
    redisOptions: {
      password?: string;
      maxRetriesPerRequest: number;
      retryDelayOnFailover: number;
    };
    natMap?: Record<string, { host: string; port: number }>;
  };
  poolSize: number;
  maxConnectionAge: number;
}

interface RedisPool {
  cluster: RedisCluster;
  connections: RedisCluster[];
  currentIndex: number;
}

export class RedisClusterManager {
  private static instance: RedisClusterManager;
  private pools: Map<string, RedisPool> = new Map();
  private config: RedisClusterConfig;
  private logger = new SimpleLogger('RedisCluster');

  private constructor() {
    this.config = {
      nodes: [
        { host: process.env.REDIS_NODE_1_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_NODE_1_PORT || '7000') },
        { host: process.env.REDIS_NODE_2_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_NODE_2_PORT || '7001') },
        { host: process.env.REDIS_NODE_3_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_NODE_3_PORT || '7002') }
      ],
      options: {
        enableReadyCheck: false,
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 2000,
        },
        natMap: process.env.NODE_ENV === 'production' ? undefined : {
          '127.0.0.1:7000': { host: '127.0.0.1', port: 7000 },
          '127.0.0.1:7001': { host: '127.0.0.1', port: 7001 },
          '127.0.0.1:7002': { host: '127.0.0.1', port: 7002 }
        }
      },
      poolSize: parseInt(process.env.REDIS_POOL_SIZE || '10'),
      maxConnectionAge: parseInt(process.env.REDIS_MAX_CONNECTION_AGE || '3600000') // 1 hour
    };
  }

  static getInstance(): RedisClusterManager {
    if (!RedisClusterManager.instance) {
      RedisClusterManager.instance = new RedisClusterManager();
    }
    return RedisClusterManager.instance;
  }

  async createPool(poolName: string = 'default'): Promise<RedisPool> {
    try {
      const cluster = new RedisCluster(this.config.nodes, this.config.options);
      const connections: RedisCluster[] = [];

      // Tạo connection pool
      for (let i = 0; i < this.config.poolSize; i++) {
        const connection = new RedisCluster(this.config.nodes, this.config.options);
        connections.push(connection);
      }

      const pool: RedisPool = {
        cluster,
        connections,
        currentIndex: 0
      };

      // Health check
      await this.healthCheck(pool);

      this.pools.set(poolName, pool);
      this.logger.info(`Redis cluster pool '${poolName}' tạo thành công với ${this.config.poolSize} connections`);

      // Setup connection rotation
      this.setupConnectionRotation(poolName);

      return pool;
    } catch (error) {
      this.logger.error(`Lỗi tạo Redis cluster pool '${poolName}':`, error);
      throw error;
    }
  }

  getConnection(poolName: string = 'default'): RedisCluster {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Redis pool '${poolName}' không tồn tại`);
    }

    // Round-robin connection selection
    const connection = pool.connections[pool.currentIndex];
    pool.currentIndex = (pool.currentIndex + 1) % pool.connections.length;

    return connection;
  }

  async executeWithFallback<T>(
    operation: (redis: RedisCluster) => Promise<T>,
    poolName: string = 'default',
    maxRetries: number = 3
  ): Promise<T> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Redis pool '${poolName}' không tồn tại`);
    }

    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const connection = this.getConnection(poolName);
        return await operation(connection);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Redis operation thất bại, thử lại ${attempt + 1}/${maxRetries}:`, error);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new Error(`Redis operation thất bại sau ${maxRetries} lần thử: ${lastError!.message}`);
  }

  private async healthCheck(pool: RedisPool): Promise<void> {
    try {
      await pool.cluster.ping();
      this.logger.info('Redis cluster health check thành công');
    } catch (error) {
      this.logger.error('Redis cluster health check thất bại:', error);
      throw error;
    }
  }

  private setupConnectionRotation(poolName: string): void {
    setInterval(async () => {
      const pool = this.pools.get(poolName);
      if (!pool) return;

      // Rotate oldest connection
      const oldConnection = pool.connections.shift();
      if (oldConnection) {
        try {
          await oldConnection.quit();
        } catch (error) {
          this.logger.warn('Lỗi đóng Redis connection cũ:', error);
        }

        // Tạo connection mới
        const newConnection = new RedisCluster(this.config.nodes, this.config.options);
        pool.connections.push(newConnection);
      }
    }, this.config.maxConnectionAge);
  }

  async getClusterInfo(poolName: string = 'default'): Promise<any> {
    return this.executeWithFallback(async (redis) => {
      const info = await redis.cluster('INFO') as string;
      const nodes = await redis.cluster('NODES') as string;
      
      return {
        info: this.parseClusterInfo(info),
        nodes: this.parseClusterNodes(nodes),
        poolSize: this.pools.get(poolName)?.connections.length || 0
      };
    }, poolName);
  }

  private parseClusterInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });
    return result;
  }

  private parseClusterNodes(nodes: string): Array<any> {
    return nodes.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(' ');
        return {
          id: parts[0],
          endpoint: parts[1],
          flags: parts[2],
          master: parts[3],
          pingSent: parts[4],
          pongRecv: parts[5],
          configEpoch: parts[6],
          linkState: parts[7],
          slots: parts.slice(8)
        };
      });
  }

  async closePool(poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    try {
      await pool.cluster.quit();
      await Promise.all(pool.connections.map(conn => conn.quit()));
      this.pools.delete(poolName);
      this.logger.info(`Redis cluster pool '${poolName}' đã đóng`);
    } catch (error) {
      this.logger.error(`Lỗi đóng Redis cluster pool '${poolName}':`, error);
    }
  }

  async closeAllPools(): Promise<void> {
    const closePromises = Array.from(this.pools.keys()).map(poolName => 
      this.closePool(poolName)
    );
    await Promise.all(closePromises);
  }
}

// Singleton instance
export const redisCluster = RedisClusterManager.getInstance(); 