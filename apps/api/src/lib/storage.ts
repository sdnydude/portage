import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { pino } from 'pino';
import { env } from './env.js';
import crypto from 'node:crypto';

const logger = pino({ name: 'storage' });

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    const config = env();
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID!,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

function generateKey(userId: string, ext: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const id = crypto.randomUUID();
  return `items/${userId}/${date}/${id}${ext}`;
}

export async function uploadImage(
  userId: string,
  buffer: Buffer,
  contentType: string,
  ext: string,
): Promise<{ key: string; url: string }> {
  const config = env();
  const key = generateKey(userId, ext);

  await getClient().send(new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  const url = `${config.R2_PUBLIC_URL}/${key}`;
  logger.info({ userId, key, size: buffer.length }, 'Image uploaded');
  return { key, url };
}

export async function deleteImage(key: string): Promise<void> {
  const config = env();

  await getClient().send(new DeleteObjectCommand({
    Bucket: config.R2_BUCKET_NAME!,
    Key: key,
  }));

  logger.info({ key }, 'Image deleted');
}
