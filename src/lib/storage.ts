// Cloudflare R2 Storage Service for PDF Files - Task 2.3
// Secure file storage with signed URL generation

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageInfo } from '../types/pdf';

export interface StorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
}

export interface UploadMetadata {
  sessionId: string;
  userId?: string;
  jobId: string;
  contentType?: string;
  tags?: Record<string, string>;
}

export class CloudflareR2Storage {
  private client: S3Client;
  private bucket: string;
  private isInitialized = false;

  constructor(config?: StorageConfig) {
    if (config) {
      this.initialize(config);
    }
  }

  // Initialize storage client
  initialize(config?: StorageConfig): void {
    const storageConfig = config || this.getConfigFromEnv();
    
    this.client = new S3Client({
      endpoint: storageConfig.endpoint,
      region: storageConfig.region || 'auto',
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
    });

    this.bucket = storageConfig.bucket;
    this.isInitialized = true;
    console.log('Cloudflare R2 Storage initialized');
  }

  // Upload file to R2 storage
  async uploadFile(
    buffer: Buffer,
    filename: string,
    metadata: UploadMetadata
  ): Promise<StorageInfo> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    try {
      const key = this.generateStorageKey(filename, metadata);
      const contentType = metadata.contentType || this.getContentType(filename);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          sessionId: metadata.sessionId,
          userId: metadata.userId || 'guest',
          jobId: metadata.jobId,
          uploadedAt: new Date().toISOString(),
        },
        // Add tags for organization and lifecycle management
        Tagging: this.buildTagString({
          sessionId: metadata.sessionId,
          userId: metadata.userId || 'guest',
          jobId: metadata.jobId,
          type: 'pdf-report',
          ...metadata.tags,
        }),
      });

      const result = await this.client.send(command);

      // Construct public URL (without signing)
      const url = `${this.getBaseUrl()}/${key}`;

      const storageInfo: StorageInfo = {
        provider: 'cloudflare-r2',
        bucket: this.bucket,
        key,
        url,
        size: buffer.length,
        contentType,
        etag: result.ETag?.replace(/"/g, ''),
        lastModified: new Date(),
      };

      console.log(`File uploaded successfully: ${key}`);
      return storageInfo;

    } catch (error) {
      console.error('Error uploading file to R2:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  // Generate signed URL for secure access
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.client, command, {
        expiresIn,
      });

      console.log(`Generated signed URL for ${key}, expires in ${expiresIn}s`);
      return signedUrl;

    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  // Get file metadata
  async getFileInfo(key: string): Promise<StorageInfo | null> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const result = await this.client.send(command);

      if (!result) return null;

      return {
        provider: 'cloudflare-r2',
        bucket: this.bucket,
        key,
        url: `${this.getBaseUrl()}/${key}`,
        size: result.ContentLength || 0,
        contentType: result.ContentType || 'application/octet-stream',
        etag: result.ETag?.replace(/"/g, ''),
        lastModified: result.LastModified || new Date(),
      };

    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      console.error('Error getting file info:', error);
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  // Delete file from storage
  async deleteFile(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      console.log(`File deleted successfully: ${key}`);
      return true;

    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  // Download file as buffer
  async downloadFile(key: string): Promise<Buffer | null> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const result = await this.client.send(command);
      
      if (!result.Body) return null;

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = result.Body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return Buffer.concat(chunks);

    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      console.error('Error downloading file:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  // List files with pagination
  async listFiles(
    prefix?: string,
    maxKeys: number = 100,
    continuationToken?: string
  ): Promise<{
    files: StorageInfo[];
    hasMore: boolean;
    nextToken?: string;
  }> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      });

      const result = await this.client.send(command);

      const files: StorageInfo[] = (result.Contents || []).map(obj => ({
        provider: 'cloudflare-r2',
        bucket: this.bucket,
        key: obj.Key!,
        url: `${this.getBaseUrl()}/${obj.Key}`,
        size: obj.Size || 0,
        contentType: this.getContentType(obj.Key!),
        etag: obj.ETag?.replace(/"/g, ''),
        lastModified: obj.LastModified || new Date(),
      }));

      return {
        files,
        hasMore: result.IsTruncated || false,
        nextToken: result.NextContinuationToken,
      };

    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  // Cleanup old files based on tags
  async cleanupOldFiles(olderThanDays: number = 30): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      let deleted = 0;
      let continuationToken: string | undefined;

      do {
        const { files, hasMore, nextToken } = await this.listFiles(
          'reports/', // Assuming all PDF reports are stored under this prefix
          1000,
          continuationToken
        );

        const filesToDelete = files.filter(file => file.lastModified < cutoffDate);

        for (const file of filesToDelete) {
          const success = await this.deleteFile(file.key);
          if (success) deleted++;
        }

        continuationToken = nextToken;
      } while (continuationToken);

      console.log(`Cleaned up ${deleted} files older than ${olderThanDays} days`);
      return deleted;

    } catch (error) {
      console.error('Error during cleanup:', error);
      throw new Error(`Failed to cleanup old files: ${error.message}`);
    }
  }

  // Utility methods
  private getConfigFromEnv(): StorageConfig {
    return {
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || '',
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.CLOUDFLARE_R2_BUCKET || '',
      region: process.env.CLOUDFLARE_R2_REGION || 'auto',
    };
  }

  private generateStorageKey(filename: string, metadata: UploadMetadata): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    return `reports/${timestamp}/${metadata.sessionId}/${sanitizedFilename}`;
  }

  private getContentType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf': return 'application/pdf';
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'json': return 'application/json';
      case 'txt': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }

  private buildTagString(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private getBaseUrl(): string {
    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || '';
    const bucket = this.bucket;
    
    // Remove protocol and get domain
    const domain = endpoint.replace(/^https?:\/\//, '');
    
    return `https://${bucket}.${domain}`;
  }
}

// Export default instance
export const storage = new CloudflareR2Storage();