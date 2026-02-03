import crypto from "node:crypto";

type Backend = "s3" | "gcs";

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function env(name: string, def = "") {
  return (process.env[name] ?? def).toString().trim();
}

function normPrefix(p: string) {
  const s = (p || "").replace(/^\/+|\/+$/g, "");
  return s ? (s.endsWith("/") ? s : `${s}/`) : "";
}

export type HealthCheck = {
  name: string;
  ok: boolean;
  severity: "info" | "warn" | "fail";
  message: string;
  meta?: Record<string, unknown>;
};

export type SystemHealth = {
  version: 1;
  generated_at: string;
  status: "ok" | "degraded" | "fail";
  checks: HealthCheck[];
};

// -------------------- S3 --------------------
async function s3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({ region: env("AWS_REGION", "us-east-1") });
}

async function s3PutGetDelete(bucket: string, key: string, body: Buffer) {
  const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await s3Client();

  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/json" }));
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  const bodyStream = r.Body as AsyncIterable<Uint8Array> | undefined;
  if (bodyStream) {
    for await (const c of bodyStream) chunks.push(Buffer.from(c));
  }
  const got = Buffer.concat(chunks);
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return got;
}

async function s3List(bucket: string, prefix: string, maxKeys = 1000) {
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const s3 = await s3Client();
  const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: maxKeys }));
  const out = (r.Contents || []).map((o) => ({
    key: o.Key || "",
    size: o.Size || 0,
    lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
  })).filter((x) => x.key);
  return out;
}

// -------------------- GCS --------------------
async function gcsClient() {
  const { Storage } = await import("@google-cloud/storage");
  return new Storage();
}

async function gcsPutGetDelete(bucket: string, key: string, body: Buffer) {
  const storage = await gcsClient();
  const b = storage.bucket(bucket);
  const f = b.file(key);
  await f.save(body, { contentType: "application/json" });
  const [buf] = await f.download();
  await f.delete({ ignoreNotFound: true });
  return buf;
}

async function gcsList(bucket: string, prefix: string, maxKeys = 1000) {
  const storage = await gcsClient();
  const b = storage.bucket(bucket);
  const [files] = await b.getFiles({ prefix, maxResults: maxKeys });
  return files.map((f) => ({
    key: f.name,
    size: (f.metadata?.size as number) ? Number(f.metadata.size) : 0,
    lastModified: (f.metadata?.updated || f.metadata?.timeCreated || null) as string | null,
  }));
}

// -------------------- Health building blocks --------------------
async function storageWriteReadDelete(backend: Backend, bucket: string, prefix: string) {
  const ts = Date.now();
  const key = `${normPrefix(prefix)}healthcheck/${ts}-${sha256Hex(String(ts)).slice(0, 12)}.json`;
  const payload = Buffer.from(JSON.stringify({ ok: true, ts, at: nowIso() }));
  const got =
    backend === "s3"
      ? await s3PutGetDelete(bucket, key, payload)
      : await gcsPutGetDelete(bucket, key, payload);
  return { key, bytes: got.length };
}

async function storageCount(backend: Backend, bucket: string, prefix: string, maxKeys = 1000) {
  const p = normPrefix(prefix);
  const items = backend === "s3" ? await s3List(bucket, p, maxKeys) : await gcsList(bucket, p, maxKeys);
  return { prefix: p, count: items.length, sample: items.slice(0, 5) };
}

async function storageLatestKey(backend: Backend, bucket: string, prefix: string, maxKeys = 2000) {
  const p = normPrefix(prefix);
  const items = backend === "s3" ? await s3List(bucket, p, maxKeys) : await gcsList(bucket, p, maxKeys);
  const sorted = items
    .filter((x) => x.key.endsWith(".json"))
    .sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
  return { prefix: p, latest_key: sorted[0]?.key ?? null, latest_last_modified: sorted[0]?.lastModified ?? null, count: items.length };
}

export async function computeSystemHealth(): Promise<SystemHealth> {
  const checks: HealthCheck[] = [];
  const backend = env("LEDGER_BACKEND", "s3") as Backend;

  const ledgerBucket = env("LEDGER_BUCKET");
  const ledgerPrefix = env("LEDGER_PREFIX", "ledger");
  const rollupPrefix = env("LEDGER_ROLLUP_PREFIX", "ledger-rollups");
  const docLedgerPendingPrefix = env("DOC_LEDGER_PENDING_PREFIX", env("DOC_LEDGER_PREFIX") ? `${env("DOC_LEDGER_PREFIX")}/_pending` : "doc-ledger/_pending");

  // 1) ledger writable
  if (!ledgerBucket) {
    checks.push({ name: "ledger_writable", ok: false, severity: "fail", message: "LEDGER_BUCKET not set" });
  } else {
    try {
      const r = await storageWriteReadDelete(backend, ledgerBucket, ledgerPrefix);
      checks.push({ name: "ledger_writable", ok: true, severity: "info", message: "ok", meta: r });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({ name: "ledger_writable", ok: false, severity: "fail", message: `write/read/delete failed: ${msg}` });
    }
  }

  // 2) rollup freshness (best-effort: find latest rollup.json)
  if (!ledgerBucket) {
    checks.push({ name: "rollup_freshness", ok: false, severity: "warn", message: "skipped (no LEDGER_BUCKET)" });
  } else {
    try {
      const r = await storageLatestKey(backend, ledgerBucket, rollupPrefix);
      if (!r.latest_key) {
        checks.push({ name: "rollup_freshness", ok: false, severity: "warn", message: "no rollup objects found", meta: r });
      } else {
        checks.push({ name: "rollup_freshness", ok: true, severity: "info", message: "latest rollup exists", meta: r });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({ name: "rollup_freshness", ok: false, severity: "warn", message: `list failed: ${msg}` });
    }
  }

  // 3) pending count (should be near zero; warn if >0)
  if (!ledgerBucket) {
    checks.push({ name: "pending_queue", ok: false, severity: "warn", message: "skipped (no LEDGER_BUCKET)" });
  } else {
    try {
      const r = await storageCount(backend, ledgerBucket, docLedgerPendingPrefix, 2000);
      const ok = r.count === 0;
      checks.push({
        name: "pending_queue",
        ok,
        severity: ok ? "info" : "warn",
        message: ok ? "no pending ledger entries" : `pending entries present: ${r.count}`,
        meta: r,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({ name: "pending_queue", ok: false, severity: "warn", message: `list failed: ${msg}` });
    }
  }

  // status computation
  const anyFail = checks.some((c) => !c.ok && c.severity === "fail");
  const anyWarn = checks.some((c) => !c.ok && c.severity === "warn");
  const status: SystemHealth["status"] = anyFail ? "fail" : anyWarn ? "degraded" : "ok";

  return { version: 1, generated_at: nowIso(), status, checks };
}
