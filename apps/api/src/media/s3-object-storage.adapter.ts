import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable, ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ObjectStorage } from './object-storage.port';

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStorage, OnModuleDestroy {
  private readonly client: S3Client | null;
  private readonly publicClient: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET') ?? '';
    if (config.getOrThrow<string>('MEDIA_STORAGE_DRIVER') !== 's3') {
      this.client = null;
      this.publicClient = null;
      return;
    }
    const options = {
      region: config.getOrThrow<string>('S3_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      forcePathStyle: true,
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5_000, requestTimeout: 15_000 },
    } as const;
    this.client = new S3Client({ ...options, endpoint: config.getOrThrow<string>('S3_ENDPOINT') });
    this.publicClient = new S3Client({
      ...options,
      endpoint: config.get<string>('S3_PUBLIC_ENDPOINT') ?? config.getOrThrow<string>('S3_ENDPOINT'),
    });
  }

  private getClient() {
    if (!this.client) throw new ServiceUnavailableException('私有对象存储未启用');
    return this.client;
  }

  onModuleDestroy() {
    this.client?.destroy();
    this.publicClient?.destroy();
  }

  createUpload(key: string, mimeType: string, byteSize: number, expiresIn: number) {
    if (!this.publicClient) throw new ServiceUnavailableException('私有对象存储未启用');
    return createPresignedPost(this.publicClient, {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
      Fields: { 'Content-Type': mimeType, success_action_status: '201' },
      Conditions: [
        ['content-length-range', byteSize, byteSize],
        ['eq', '$Content-Type', mimeType],
        ['eq', '$success_action_status', '201'],
      ],
    });
  }

  async read(key: string, maxBytes: number) {
    const client = this.getClient();
    const head = await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!head.ContentLength || head.ContentLength > maxBytes) throw new BadRequestException('上传对象大小无效');
    const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(15_000),
    });
    if (!response.Body) throw new BadRequestException('上传对象为空');
    const stream = response.Body as AsyncIterable<Uint8Array> & { destroy?: () => void };
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      for await (const chunk of stream) {
        length += chunk.byteLength;
        if (length > maxBytes) throw new BadRequestException('上传对象超过大小限制');
        chunks.push(Buffer.from(chunk));
      }
    } finally {
      stream.destroy?.();
    }
    return { bytes: Buffer.concat(chunks), mimeType: response.ContentType };
  }

  async put(key: string, bytes: Buffer, mimeType: string) {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
        CacheControl: 'private, no-store',
      }),
    );
  }

  async delete(key: string) {
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  signedRead(key: string, expiresIn: number) {
    if (!this.publicClient) throw new ServiceUnavailableException('私有对象存储未启用');
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseCacheControl: 'private, no-store' }),
      { expiresIn },
    );
  }
}
