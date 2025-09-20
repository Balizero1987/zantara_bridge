/**
 * Redis Client Configuration for Zantara Bridge
 * Supports both Upstash Redis and local Redis instances
 */

import Redis from 'ioredis';

// Redis configuration from environment
const REDIS_CONFIG = {
  url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
  password: process.env.REDIS_PASSWORD || process.env.UPSTASH_REDIS_REST_TOKEN,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxConnections: parseInt(process.env.REDIS_MAX_CONNECTIONS || '10'),
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

class RedisManager {
  private client: Redis | null = null;
  private connected = false;
  private connecting = false;

  async getClient(): Promise<Redis> {
    if (this.client && this.connected) {
      return this.client;
    }

    if (this.connecting) {
      // Wait for existing connection attempt
      while (this.connecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.client && this.connected) {
        return this.client;
      }
    }

    this.connecting = true;

    try {
      // Create Redis client based on available configuration
      if (REDIS_CONFIG.url) {
        // Use connection URL (Upstash or full Redis URL)
        this.client = new Redis(REDIS_CONFIG.url, {
          password: REDIS_CONFIG.password,
          maxRetriesPerRequest: REDIS_CONFIG.maxRetriesPerRequest,
          enableReadyCheck: REDIS_CONFIG.enableReadyCheck,
          lazyConnect: REDIS_CONFIG.lazyConnect
        });
      } else {
        // Use host/port configuration
        this.client = new Redis({
          host: REDIS_CONFIG.host,
          port: REDIS_CONFIG.port,
          password: REDIS_CONFIG.password,
          maxRetriesPerRequest: REDIS_CONFIG.maxRetriesPerRequest,
          enableReadyCheck: REDIS_CONFIG.enableReadyCheck,
          lazyConnect: REDIS_CONFIG.lazyConnect
        });
      }

      // Event handlers
      this.client.on('connect', () => {
        console.log('🔴 Redis: Connected');
        this.connected = true;
        this.connecting = false;
      });

      this.client.on('ready', () => {
        console.log('🟢 Redis: Ready for operations');
        this.connected = true;
        this.connecting = false;
      });

      this.client.on('error', (error) => {
        console.error('❌ Redis Error:', error.message);
        this.connected = false;
        this.connecting = false;
      });

      this.client.on('close', () => {
        console.log('🔴 Redis: Connection closed');
        this.connected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis: Reconnecting...');
        this.connected = false;
      });

      // Attempt connection
      await this.client.connect();
      
      // Test connection with ping
      await this.client.ping();
      console.log('✅ Redis: Connection established and tested');

      this.connected = true;
      this.connecting = false;

      return this.client;

    } catch (error) {
      this.connecting = false;
      this.connected = false;
      
      console.error('💥 Redis connection failed:', error);
      
      // For development, create a mock client that logs operations
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Redis: Using mock client for development');
        return this.createMockClient();
      }
      
      throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createMockClient(): Redis {
    const mockClient = {
      get: async (key: string) => {
        console.log(`📋 Redis MOCK: GET ${key} -> null`);
        return null;
      },
      set: async (key: string, value: string) => {
        console.log(`📋 Redis MOCK: SET ${key} -> ${value.substring(0, 50)}...`);
        return 'OK';
      },
      setex: async (key: string, ttl: number, value: string) => {
        console.log(`📋 Redis MOCK: SETEX ${key} TTL:${ttl} -> ${value.substring(0, 50)}...`);
        return 'OK';
      },
      del: async (...keys: string[]) => {
        console.log(`📋 Redis MOCK: DEL ${keys.join(', ')}`);
        return keys.length;
      },
      incr: async (key: string) => {
        console.log(`📋 Redis MOCK: INCR ${key} -> 1`);
        return 1;
      },
      expire: async (key: string, ttl: number) => {
        console.log(`📋 Redis MOCK: EXPIRE ${key} -> ${ttl}s`);
        return 1;
      },
      ttl: async (key: string) => {
        console.log(`📋 Redis MOCK: TTL ${key} -> 300`);
        return 300;
      },
      keys: async (pattern: string) => {
        console.log(`📋 Redis MOCK: KEYS ${pattern} -> []`);
        return [];
      },
      ping: async () => {
        console.log(`📋 Redis MOCK: PING -> PONG`);
        return 'PONG';
      }
    } as any;

    return mockClient;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
      console.log('🔴 Redis: Disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async healthCheck(): Promise<{ connected: boolean; latency?: number; error?: string }> {
    try {
      if (!this.client || !this.connected) {
        return { connected: false, error: 'Not connected' };
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return { connected: true, latency };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}

// Singleton instance
const redisManager = new RedisManager();

// Export the client getter
export const getRedisClient = () => redisManager.getClient();

// Export for backward compatibility and direct access
export let redisClient: Redis;

// Initialize client on module load
(async () => {
  try {
    redisClient = await redisManager.getClient();
    console.log('🚀 Redis client initialized successfully');
  } catch (error) {
    console.error('💥 Failed to initialize Redis client:', error);
    
    // In production, this should probably exit the process
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Redis required for production. Exiting...');
      process.exit(1);
    }
  }
})();

// Export utilities
export const redis = {
  get client() {
    return redisClient;
  },
  
  async isConnected(): Promise<boolean> {
    return redisManager.isConnected();
  },
  
  async healthCheck() {
    return redisManager.healthCheck();
  },
  
  async disconnect() {
    return redisManager.disconnect();
  }
};

// Export manager for advanced usage
export { redisManager };

// Health check endpoint helper
export async function redisHealthEndpoint() {
  const health = await redisManager.healthCheck();
  return {
    redis: {
      status: health.connected ? 'connected' : 'disconnected',
      latency: health.latency,
      error: health.error,
      config: {
        url: REDIS_CONFIG.url ? '***configured***' : 'not set',
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
        maxConnections: REDIS_CONFIG.maxConnections
      }
    }
  };
}