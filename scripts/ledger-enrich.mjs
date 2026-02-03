import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/ledger-enrich.mjs --backend s3|gcs --ledger-bucket <bucket> --packs-bucket <bucket> --date YYYY-MM-DD",
      "  node scripts/ledger-enrich.mjs --backend s3|gcs --ledger-bucket <bucket> --packs-bucket <bucket> --from YYYY-MM-DD --to YYYY-MM-DD",
      "  node scripts/ledger-enrich.mjs --backend s3|gcs --ledger-bucket <bucket> --packs-bucket <bucket> --days-back N",
      "",
      "Options:",
      "  --ledger-prefix <p> (default: ledger)",
      "  --enriched-prefix <p> (default: ledger-enriched)",
      "  --packs-prefix <p> (default: packs)",
      "  --pack-ext <ext> (default: tar.gz)",
      "  --force (re-enrich even if already enriched)",
      "",
      "Env equivalents:",
      "  LEDGER_BACKEND, LEDGER_BUCKET, LEDGER_PREFIX",
      "  LEDGER_ENRICHED_PREFIX",
      "  PACKS_BUCKET, PACKS_PREFIX, PACK_ARCHIVE_EXT",
      "  LEDGER_ENRICH_MAX_ENTRIES_PER_DAY (default 5000)",
    ].join("\n")
  );
  process.exit(1);
}

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const out = (r.stdout || Buffer.from("")).toString("utf8");
    const err = (r.stderr || Buffer.from("")).toString("utf8");
    throw new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${r.status})\n${out}\n${err}`);
  }
  return {
    stdout: (r.stdout || Buffer.from("")).toString("utf8"),
    stderr: (r.stderr || Buffer.from("")).toString("utf8"),
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function parseDate(s) {
  if (!isDate(s)) throw new Error(`Bad date: ${s}`);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function fmtDate(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDays(d, n) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function splitDateParts(s) {
  const [y, m, d] = s.split("-");
  return { y, m, d };
}

function stableStringify(obj) {
  const seen = new WeakSet();
  const rec = (v) => {
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (Array.isArray(v)) return v.map(rec);
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = rec(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(rec(obj));
}

function issueFingerprint(issue) {
  const base = {
    type: issue?.type ?? null,
    severity: issue?.severity ?? null,
    period: issue?.period ?? issue?.window ?? null,
    subject_id: issue?.subject_id ?? issue?.receipt_id ?? issue?.event_id ?? null,
    details: issue?.details ?? issue?.message ?? null,
  };
  return crypto.createHash("sha256").update(stableStringify(base)).digest("hex").slice(0, 16);
}

function dedupeIssues(issues) {
  const out = [];
  const seen = new Set();
  for (const it of issues || []) {
    const fp = issueFingerprint(it);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push({ ...it, _fingerprint: fp });
  }
  return { issues: out, deduped: (issues?.length || 0) - out.length };
}

function groupIssues(issues) {
  const g = {};
  for (const it of issues || []) {
    const sev = String(it?.severity || "unknown").toLowerCase();
    const typ = String(it?.type || "UNKNOWN");
    if (!g[sev]) g[sev] = {};
    if (!g[sev][typ]) g[sev][typ] = [];
    g[sev][typ].push(it);
  }
  return g;
}

function buildGroupedStats(grouped) {
  const stats = {};
  for (const sev of Object.keys(grouped)) {
    stats[sev] = {};
    for (const typ of Object.keys(grouped[sev])) {
      const arr = grouped[sev][typ];
      stats[sev][typ] = {
        count: arr.length,
        examples: arr.slice(0, 3).map((x) => ({
          fingerprint: x._fingerprint || null,
          period: x.period || x.window || null,
          message: x.message || x.details || null,
        })),
      };
    }
  }
  return stats;
}

function topFromGroupedStats(stats) {
  const flat = [];
  for (const sev of Object.keys(stats)) {
    for (const typ of Object.keys(stats[sev])) {
      const g = stats[sev][typ];
      flat.push({ severity: sev, type: typ, count: g.count, examples: g.examples || [] });
    }
  }
  flat.sort((a, b) => (b.count || 0) - (a.count || 0));
  return flat.slice(0, 5);
}

function hasFingerprintsInEntry(entry) {
  const top = entry?.anchoring?.top || [];
  for (const g of top) {
    for (const ex of g.examples || []) {
      if (ex?.fingerprint) return true;
    }
  }
  return false;
}

function listKeysS3(bucket, prefix) {
  const out = run(
    "aws",
    ["s3api", "list-objects-v2", "--bucket", bucket, "--prefix", prefix, "--query", "Contents[].Key", "--output", "json"],
    { capture: true }
  ).stdout;
  const arr = JSON.parse(out || "[]");
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}

function listKeysGcs(bucket, prefix) {
  const out = run("gsutil", ["ls", `gs://${bucket}/${prefix}*`], { capture: true }).stdout;
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => u.replace(`gs://${bucket}/`, ""));
}

function downloadS3(bucket, key, dst) {
  run("aws", ["s3", "cp", `s3://${bucket}/${key}`, dst, "--quiet"]);
}

function downloadGcs(bucket, key, dst) {
  run("gsutil", ["cp", `gs://${bucket}/${key}`, dst]);
}

function uploadS3(bucket, key, src, contentType) {
  const args = ["s3", "cp", src, `s3://${bucket}/${key}`];
  if (contentType) args.push("--content-type", contentType);
  run("aws", args);
}

function uploadGcs(bucket, key, src, contentType) {
  const args = [];
  if (contentType) args.push("-h", `Content-Type:${contentType}`);
  args.push("cp", src, `gs://${bucket}/${key}`);
  run("gsutil", args);
}

function extractTarGz(archivePath, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  run("tar", ["-xzf", archivePath, "-C", dstDir]);
}

function findFileRecursive(root, filename) {
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    const items = fs.readdirSync(d, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(d, it.name);
      if (it.isDirectory()) stack.push(p);
      else if (it.isFile() && it.name === filename) return p;
    }
  }
  return null;
}

async function main() {
  const backend = (argVal("--backend") || process.env.LEDGER_BACKEND || "").trim();
  const ledgerBucket = (argVal("--ledger-bucket") || process.env.LEDGER_BUCKET || "").trim();
  const ledgerPrefix = (argVal("--ledger-prefix") || process.env.LEDGER_PREFIX || "ledger").replace(/^\/+|\/+$/g, "");
  const enrichedPrefix = (argVal("--enriched-prefix") || process.env.LEDGER_ENRICHED_PREFIX || "ledger-enriched").replace(/^\/+|\/+$/g, "");

  const packsBucket = (argVal("--packs-bucket") || process.env.PACKS_BUCKET || "").trim();
  const packsPrefix = (argVal("--packs-prefix") || process.env.PACKS_PREFIX || "packs").replace(/^\/+|\/+$/g, "");
  const packExt = (argVal("--pack-ext") || process.env.PACK_ARCHIVE_EXT || "tar.gz").trim();

  const force = hasFlag("--force");
  const maxPerDay = Number(process.env.LEDGER_ENRICH_MAX_ENTRIES_PER_DAY || "5000");

  const date = argVal("--date");
  const from = argVal("--from");
  const to = argVal("--to");
  const daysBack = argVal("--days-back");

  if (!backend || !ledgerBucket || !packsBucket) usage();
  if (backend !== "s3" && backend !== "gcs") throw new Error(`Unknown backend ${backend}`);

  let start = null;
  let end = null;
  if (date) {
    if (!isDate(date)) throw new Error(`Bad --date ${date}`);
    start = parseDate(date);
    end = parseDate(date);
  } else if (from && to) {
    if (!isDate(from) || !isDate(to)) throw new Error("Bad --from/--to");
    start = parseDate(from);
    end = parseDate(to);
  } else if (daysBack) {
    const n = Number(daysBack);
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
    end = addDays(todayUtc, -1);
    start = addDays(end, -(n - 1));
  } else {
    usage();
  }

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-enrich-"));
  console.log(`TMP: ${tmpBase}`);

  for (let d = new Date(start.getTime()); d <= end; d = addDays(d, 1)) {
    const ds = fmtDate(d);
    const { y, m, d: dd } = splitDateParts(ds);
    const dayPrefix = `${ledgerPrefix}/${y}/${m}/${dd}/`;
    const keys =
      backend === "s3" ? listKeysS3(ledgerBucket, dayPrefix) : listKeysGcs(ledgerBucket, dayPrefix);
    const entryKeys = keys.filter((k) => k.endsWith(".json") && !k.endsWith("index.jsonl"));
    if (entryKeys.length > maxPerDay) throw new Error(`Too many entries on ${ds}: ${entryKeys.length} > ${maxPerDay}`);

    console.log(`DAY ${ds}: entries=${entryKeys.length}`);
    for (const key of entryKeys.sort()) {
      const localEntry = path.join(tmpBase, path.basename(key));
      if (backend === "s3") downloadS3(ledgerBucket, key, localEntry);
      else downloadGcs(ledgerBucket, key, localEntry);

      const entry = JSON.parse(fs.readFileSync(localEntry, "utf8"));
      const sha = entry?.pack?.sha256 || null;
      const already = hasFingerprintsInEntry(entry);
      if (already && !force) {
        continue;
      }
      if (!sha) {
        console.log(`SKIP (no pack.sha256): ${key}`);
        continue;
      }

      const packKey = `${packsPrefix}/${sha}.${packExt}`;
      const localPack = path.join(tmpBase, `${sha}.${packExt}`);
      try {
        if (backend === "s3") downloadS3(packsBucket, packKey, localPack);
        else downloadGcs(packsBucket, packKey, localPack);
      } catch {
        console.log(`SKIP (pack not found): ${packKey}`);
        continue;
      }

      const unpackDir = path.join(tmpBase, `pack-${sha}`);
      fs.rmSync(unpackDir, { recursive: true, force: true });
      extractTarGz(localPack, unpackDir);

      const issuesPath = findFileRecursive(unpackDir, "ANCHORING_ISSUES.json");
      if (!issuesPath) {
        console.log(`SKIP (ANCHORING_ISSUES.json not in pack): ${sha}`);
        continue;
      }
      const issuesJson = JSON.parse(fs.readFileSync(issuesPath, "utf8"));
      const rawIssues = Array.isArray(issuesJson?.issues) ? issuesJson.issues : [];
      const { issues: dedupedIssues } = dedupeIssues(rawIssues);
      const grouped = groupIssues(dedupedIssues);
      const groupedStats = buildGroupedStats(grouped);
      const top = topFromGroupedStats(groupedStats);

      entry._enriched_at = new Date().toISOString();
      entry._enriched_from_key = key;
      entry._enriched_pack_object = { bucket: packsBucket, key: packKey };
      entry.anchoring = entry.anchoring || {};
      entry.anchoring.issues_grouped = entry.anchoring.issues_grouped ?? groupedStats;
      entry.anchoring.top = top.map((g) => ({
        severity: g.severity,
        type: g.type,
        count: g.count,
        runbook: g.runbook || null,
        examples: (g.examples || []).slice(0, 3),
      }));

      const enrichedKey = `${enrichedPrefix}/${y}/${m}/${dd}/${sha}.json`;
      const localOut = path.join(tmpBase, `${sha}.enriched.json`);
      fs.writeFileSync(localOut, JSON.stringify(entry, null, 2), "utf8");

      if (backend === "s3") uploadS3(ledgerBucket, enrichedKey, localOut, "application/json");
      else uploadGcs(ledgerBucket, enrichedKey, localOut, "application/json");

      console.log(`ENRICH OK: ${enrichedKey}`);
    }
  }

  console.log("DONE");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(e?.stack || String(e));
    process.exit(2);
  });
}
