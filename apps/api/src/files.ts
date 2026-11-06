import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from './env';

const UPLOAD_TTL_SECONDS = 15 * 60;
const DOWNLOAD_TTL_SECONDS = 15 * 60;

/** Contracts, receipts and photos only. */
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export interface FileSigner {
  /** Returns a one-time key and a short-lived URL the device uploads to directly. */
  signUpload(fileName: string, contentType: string): Promise<{ key: string; url: string; expiresIn: number }>;
  signDownload(key: string): Promise<{ url: string; expiresIn: number }>;
}

/** Keys are generated here, never taken from a device, so nobody can write outside uploads/. */
export function makeKey(fileName: string): string {
  const safe = fileName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(-80);
  return `uploads/${randomUUID()}/${safe || 'file'}`;
}

export function isValidKey(key: string): boolean {
  return /^uploads\/[0-9a-f-]{36}\/[a-zA-Z0-9._-]{1,80}$/.test(key) && !key.includes('..');
}

export function createFileSigner(r2: NonNullable<Env['r2']>): FileSigner {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });

  return {
    async signUpload(fileName, contentType) {
      const key = makeKey(fileName);
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: r2.bucket, Key: key, ContentType: contentType }),
        { expiresIn: UPLOAD_TTL_SECONDS },
      );
      return { key, url, expiresIn: UPLOAD_TTL_SECONDS };
    },
    async signDownload(key) {
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: r2.bucket, Key: key }), {
        expiresIn: DOWNLOAD_TTL_SECONDS,
      });
      return { url, expiresIn: DOWNLOAD_TTL_SECONDS };
    },
  };
}
