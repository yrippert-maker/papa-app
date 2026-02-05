import crypto from "node:crypto";
import type { HealthCheck, SystemHealth } from "./types";

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
  return (r.Contents || []).map((o) => ({
    key: o.Key || "",
    size: o.Size || 0,
    lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
  })).filter((x) => x.key);
}

/** S3-only health: ledger writable, rollup freshness, pending queue. No GCS/googleapis. */
export async function computeS3Health(): Promise<SystemHealth> {
  const checks: HealthCheck[] = [];
  const ledgerBucket = env("LEDGER_BUCKET");
  const ledgerPrefix = env("LEDGER_PREFIX", "ledger");
  const rollupPrefix = env("LEDGER_ROLLUP_PREFIX", "ledger-rollups");
  const docLedgerPendingPrefix = env("DOC_LEDGER_PENDING_PREFIX", env("DOC_LEDGER_PREFIX") ? `${env("DOC_LEDGER_PREFIX")}/_pending` : "doc-ledger/_pending");

  if (!ledgerBucket) {
    checks.push({ name: "ledger_writable", ok: false, severity: "fail", message: "LEDGER_BUCKET not set" });
  } else {
    try {
      const key = `${normPrefix(ledgerPrefix)}healthcheck/${Date.now()}-${sha256Hex(String(Date.now())).slice(0, 12)}.json`;
      const payload = Buffer.from(JSON.stringify({ ok: true, ts: Date.now(), at: nowIso() }));
      const got = await s3PutGetDelete(ledgerBucket, key, payload);
      checks.push({ name: "ledger_writable", ok: true, severity: "info", message: "ok", meta: { key, bytes: got.length } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({ name: "ledger_writable", ok: false, severity: "fail", message: `write/read/delete failed: ${msg}` });
    }
  }

  if (!ledgerBucket) {
    checks.push({ name: "rollup_freshness", ok: false, severity: "warn", message: "skipped (no LEDGER_BUCKET)" });
  } else {
    try {
      const p = normPrefix(rollupPrefix);
      const items = await s3List(ledgerBucket, p, 2000);
      const sorted = items.filter((x) => x.key.endsWith(".json")).sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
      const r = { prefix: p, latest_key: sorted[0]?.key ?? null, latest_last_modified: sorted[0]?.lastModified ?? null, count: items.length };
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

  if (!ledgerBucket) {
    checks.push({ name: "pending_queue", ok: false, severity: "warn", message: "skipped (no LEDGER_BUCKET)" });
  } else {
    try {
      const p = normPrefix(docLedgerPendingPrefix);
      const items = await s3List(ledgerBucket, p, 2000);
      const r = { prefix: p, count: items.length, sample: items.slice(0, 5) };
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

  const anyFail = checks.some((c) => !c.ok && c.severity === "fail");
  const anyWarn = checks.some((c) => !c.ok && c.severity === "warn");
  const status: SystemHealth["status"] = anyFail ? "fail" : anyWarn ? "degraded" : "ok";
  return { version: 1, generated_at: nowIso(), status, checks };
}
