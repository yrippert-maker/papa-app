import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function must(v, name) {
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export function makeS3() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  return new S3Client({ region });
}

export async function listPrefixes(s3, { bucket, prefix, delimiter = '/' }) {
  const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: delimiter });
  const out = await s3.send(cmd);
  const cps = out.CommonPrefixes || [];
  return cps.map((x) => x.Prefix).filter(Boolean);
}

export async function listKeys(s3, { bucket, prefix, maxKeys = 1000 }) {
  const keys = [];
  let token = undefined;
  for (;;) {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: Math.min(maxKeys, 1000),
    });
    const out = await s3.send(cmd);
    for (const o of out.Contents || []) {
      if (o.Key) keys.push({ key: o.Key, size: o.Size ?? null, last_modified: o.LastModified ?? null });
    }
    if (!out.IsTruncated) break;
    token = out.NextContinuationToken;
    if (keys.length >= maxKeys) break;
  }
  return keys;
}

export async function getJsonObject(s3, { bucket, key, maxBytes = 2_000_000 }) {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = out.Body;
  if (!body) throw new Error('Empty body');
  const chunks = [];
  let total = 0;
  for await (const c of body) {
    total += c.length;
    if (total > maxBytes) throw new Error(`Object too large (> ${maxBytes} bytes)`);
    chunks.push(c);
  }
  const txt = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(txt);
}

export async function headObject(s3, { bucket, key }) {
  const out = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { size: out.ContentLength ?? null, last_modified: out.LastModified ?? null, etag: out.ETag ?? null };
}

export async function presignGet(s3, { bucket, key, expiresSec = 900 }) {
  const b = must(bucket, 'bucket');
  const k = must(key, 'key');
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: b, Key: k }), { expiresIn: expiresSec });
  return url;
}

export async function getObjectBody(s3, { bucket, key, maxBytes = 5_000_000 }) {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = out.Body;
  if (!body) throw new Error('Empty body');
  const chunks = [];
  let total = 0;
  for await (const c of body) {
    total += c.length;
    if (total > maxBytes) throw new Error(`Object too large (> ${maxBytes} bytes)`);
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export async function putObject(s3, { bucket, key, body, contentType = 'application/octet-stream' }) {
  const b = must(bucket, 'bucket');
  const k = must(key, 'key');
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  await s3.send(
    new PutObjectCommand({
      Bucket: b,
      Key: k,
      Body: buf,
      ContentType: contentType,
    })
  );
  return { bucket: b, key: k };
}

export async function putObjectJson(s3, { bucket, key, json }) {
  const body = JSON.stringify(json, null, 2);
  return putObject(s3, { bucket, key, body, contentType: 'application/json' });
}

export async function deleteObject(s3, { bucket, key }) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return { bucket, key };
}
