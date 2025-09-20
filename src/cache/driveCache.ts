// File: src/cache/driveCache.ts
import { Redis } from 'ioredis';

const CACHE_TTL = {
  FOLDER_LIST: 300,     // 5 minutes
  FILE_METADATA: 600,   // 10 minutes  
  SEARCH_RESULTS: 180,  // 3 minutes
  USER_CONTEXT: 1800    // 30 minutes
};

export class DriveCache {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  // Cache folder listings
  async getCachedFolderList(folderId: string): Promise<any | null> {
    const key = `drive:folder:${folderId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedFolderList(folderId: string, data: any): Promise<void> {
    const key = `drive:folder:${folderId}`;
    await this.redis.setex(key, CACHE_TTL.FOLDER_LIST, JSON.stringify(data));
  }

  // Cache file metadata  
  async getCachedFileInfo(fileId: string): Promise<any | null> {
    const key = `drive:file:${fileId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedFileInfo(fileId: string, metadata: any): Promise<void> {
    const key = `drive:file:${fileId}`;
    await this.redis.setex(key, CACHE_TTL.FILE_METADATA, JSON.stringify(metadata));
  }

  // Cache search results
  async getCachedSearch(query: string): Promise<any | null> {
    const key = `drive:search:${Buffer.from(query).toString('base64')}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setCachedSearch(query: string, results: any): Promise<void> {
    const key = `drive:search:${Buffer.from(query).toString('base64')}`;
    await this.redis.setex(key, CACHE_TTL.SEARCH_RESULTS, JSON.stringify(results));
  }

  // Invalidate cache when files change
  async invalidateFolder(folderId: string): Promise<void> {
    const pattern = `drive:folder:${folderId}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateFile(fileId: string): Promise<void> {
    await this.redis.del(`drive:file:${fileId}`);
  }
}