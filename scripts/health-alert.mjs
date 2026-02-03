#!/usr/bin/env node
/**
 * Health alert: check rollup freshness and pending count; optionally notify Slack.
 * Usage: node scripts/health-alert.mjs [--slack] [--dry-run]
 * Env: LEDGER_BACKEND, LEDGER_BUCKET, LEDGER_ROLLUP_PREFIX, DOC_LEDGER_PENDING_PREFIX,
 *      ALERT_ROLLUP_MAX_AGE_HOURS (default 24), ALERT_PENDING_THRESHOLD (default 10),
 *      SLACK_WEBHOOK_URL (required if --slack).
 */
import https from "node:https";

function env(name, def = "") {
  return (process.env[name] ?? def).toString().trim();
}

function normPrefix(p) {
  const s = (p || "").replace(/^\/+|\/+$/g, "");
  return s ? (s.endsWith("/") ? s : `${s}/`) : "";
}

const backend = env("LEDGER_BACKEND", "s3");
const bucket = env("LEDGER_BUCKET");
const rollupPrefix = normPrefix(env("LEDGER_ROLLUP_PREFIX", "ledger-rollups"));
const pendingPrefix = normPrefix(env("DOC_LEDGER_PENDING_PREFIX", env("DOC_LEDGER_PREFIX") ? `${env("DOC_LEDGER_PREFIX")}/_pending` : "doc-ledger/_pending"));
const maxAgeHours = Number(env("ALERT_ROLLUP_MAX_AGE_HOURS", "24")) || 24;
const pendingThreshold = Number(env("ALERT_PENDING_THRESHOLD", "10")) || 10;

// --------------- S3 ---------------
async function s3List(bucketName, prefix, maxKeys = 2000) {
  const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const region = env("AWS_REGION", "us-east-1");
  const s3 = new S3Client({ region });
  const r = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix, MaxKeys: maxKeys }));
  return (r.Contents || []).map((o) => ({
    key: o.Key || "",
    lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
  })).filter((x) => x.key);
}

// --------------- GCS ---------------
async function gcsList(bucketName, prefix, maxKeys = 2000) {
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  const b = storage.bucket(bucketName);
  const [files] = await b.getFiles({ prefix, maxResults: maxKeys });
  return files.map((f) => ({
    key: f.name,
    lastModified: (f.metadata?.updated || f.metadata?.timeCreated || null) || null,
  }));
}

async function list(prefix, maxKeys = 2000) {
  if (backend === "s3") return s3List(bucket, prefix, maxKeys);
  return gcsList(bucket, prefix, maxKeys);
}

function postSlack(webhookUrl, text) {
  return new Promise((resolve, reject) => {
    const u = new URL(webhookUrl);
    const body = JSON.stringify({ text });
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        port: u.port || 443,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body, "utf8") },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const doSlack = process.argv.includes("--slack");
  const dryRun = process.argv.includes("--dry-run");
  const webhook = env("SLACK_WEBHOOK_URL");

  const result = {
    status: "ok",
    generated_at: new Date().toISOString(),
    rollup_ok: true,
    rollup_latest: null,
    rollup_age_hours: null,
    pending_ok: true,
    pending_count: 0,
    alerts: [],
  };

  if (!bucket) {
    console.log(JSON.stringify({ ...result, status: "skip", reason: "LEDGER_BUCKET not set" }, null, 2));
    return;
  }

  try {
    const rollupItems = await list(rollupPrefix);
    const rollupJson = rollupItems.filter((x) => x.key.endsWith(".json"));
    const sorted = rollupJson.sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
    const latest = sorted[0];
    if (latest?.lastModified) {
      const ageMs = Date.now() - new Date(latest.lastModified).getTime();
      result.rollup_latest = latest.key;
      result.rollup_age_hours = Math.round(ageMs / (1000 * 60 * 60) * 10) / 10;
      if (result.rollup_age_hours >= maxAgeHours) {
        result.rollup_ok = false;
        result.alerts.push(`no rollup > ${maxAgeHours}h (latest: ${result.rollup_age_hours}h ago)`);
      }
    } else {
      result.rollup_ok = false;
      result.alerts.push("no rollup objects found");
    }
  } catch (e) {
    result.rollup_ok = false;
    result.alerts.push(`rollup list failed: ${e?.message || e}`);
  }

  try {
    const pendingItems = await list(pendingPrefix);
    result.pending_count = pendingItems.length;
    if (result.pending_count > pendingThreshold) {
      result.pending_ok = false;
      result.alerts.push(`pending > ${pendingThreshold} (count: ${result.pending_count})`);
    }
  } catch (e) {
    result.pending_ok = false;
    result.alerts.push(`pending list failed: ${e?.message || e}`);
  }

  if (result.alerts.length) result.status = "degraded";

  console.log(JSON.stringify(result, null, 2));

  if (doSlack && result.alerts.length > 0) {
    if (!webhook) {
      console.error("SLACK_WEBHOOK_URL not set");
      process.exitCode = 2;
      return;
    }
    const text = `*Health Alert*\n${result.alerts.map((a) => `• ${a}`).join("\n")}\nrollup: ${result.rollup_latest || "—"} | pending: ${result.pending_count}`;
    if (dryRun) {
      console.log("Slack (dry-run):", text);
      return;
    }
    const res = await postSlack(webhook, text);
    if (res.status < 200 || res.status >= 300) {
      console.error("Slack POST failed:", res.status, res.body);
      process.exitCode = 2;
    }
  }

  if (result.status === "degraded") process.exitCode = 1;
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(2);
});
