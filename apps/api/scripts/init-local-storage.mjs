import assert from 'node:assert/strict';
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';

assert.notEqual(process.env.NODE_ENV, 'production', 'This bootstrap is development-only');
const endpoint = new URL(process.env.S3_ENDPOINT ?? 'http://127.0.0.1:59000');
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname),
  'Local storage bootstrap refuses remote endpoints',
);
const bucket = process.env.S3_BUCKET ?? 'lumi-media';
assert.match(bucket, /^lumi-[a-z0-9-]+$/, 'Only a named Lumi development bucket may be bootstrapped');
const client = new S3Client({
  endpoint: endpoint.origin,
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'lumi',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'lumi-local-secret',
  },
  requestHandler: { connectionTimeout: 5_000, requestTimeout: 10_000 },
  maxAttempts: 2,
});
try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      break;
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 404) {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        break;
      }
      if (attempt === 29 || !['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  assert.ok(origins.length > 0 && !origins.includes('*'), 'Explicit development origins are required');
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ['GET', 'HEAD', 'POST'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 300,
          },
        ],
      },
    }),
  );
  const anonymous = await fetch(`${endpoint.origin}/${bucket}?list-type=2`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(anonymous.status, 403, 'Anonymous bucket listing must be denied; inspect storage authentication');
  console.log(
    'Local private bucket ready; no anonymous policy was installed. Production provisioning is a separate operator action.',
  );
} finally {
  client.destroy();
}
