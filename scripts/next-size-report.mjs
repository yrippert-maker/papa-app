import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, "electron", "bundle", "standalone");
const NEXT_DIR = path.join(STANDALONE, ".next");

// сколько показать
const TOP_DIRS = 40;
const TOP_FILES = 80;

// ---- utils ----
function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function walkFiles(dir, out) {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile()) out.push(p);
    }
  }
}

function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

function fmt(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function rel(p) {
  return path.relative(STANDALONE, p).replace(/\\/g, "/");
}

function sumDir(d) {
  const files = [];
  walkFiles(d, files);
  let total = 0;
  for (const f of files) total += fileSize(f);
  return total;
}

function listTopDirs(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => path.join(baseDir, e.name));

  const sized = entries.map(d => ({ dir: d, bytes: sumDir(d) }));
  sized.sort((a, b) => b.bytes - a.bytes);
  return sized.slice(0, TOP_DIRS);
}

function listTopFiles(baseDir) {
  const files = [];
  walkFiles(baseDir, files);
  const sized = files.map(f => ({ file: f, bytes: fileSize(f) }));
  sized.sort((a, b) => b.bytes - a.bytes);
  return sized.slice(0, TOP_FILES);
}

function findNftTraceFiles(baseDir) {
  const files = [];
  walkFiles(baseDir, files);
  return files.filter(f => f.endsWith(".nft.json"));
}

function grepInJsonFile(jsonPath, needle) {
  // очень простой поиск по тексту, чтобы не парсить гигантские json
  try {
    const txt = fs.readFileSync(jsonPath, "utf8");
    return txt.includes(needle);
  } catch {
    return false;
  }
}

// ---- main ----
if (!exists(NEXT_DIR)) {
  console.error(`[report] NOT FOUND: ${NEXT_DIR}`);
  console.error(`[report] Run: npm run build && npm run electron:prep`);
  process.exit(1);
}

console.log(`[report] standalone: ${STANDALONE}`);
console.log(`[report] .next:      ${NEXT_DIR}`);
console.log("");

const nextTotal = sumDir(NEXT_DIR);
console.log(`[report] .next total: ${fmt(nextTotal)}`);
console.log("");

console.log("== Top dirs under standalone/.next ==");
const topDirs = listTopDirs(NEXT_DIR);
for (const { dir, bytes } of topDirs) {
  console.log(`${fmt(bytes).padStart(10)}  ${rel(dir)}`);
}
console.log("");

console.log("== Top files under standalone/.next ==");
const topFiles = listTopFiles(NEXT_DIR);
for (const { file, bytes } of topFiles) {
  console.log(`${fmt(bytes).padStart(10)}  ${rel(file)}`);
}
console.log("");

// ---- "who pulled it" via nft traces ----
const nftFiles = findNftTraceFiles(STANDALONE);
console.log(`== NFT traces found: ${nftFiles.length} ==`);
if (nftFiles.length === 0) {
  console.log("[report] No .nft.json traces found under standalone (ok, but attribution will be limited).");
  process.exit(0);
}

// пробуем атрибутировать Топ-10 файлов по nft.json
console.log("");
console.log("== Attribution (Top 10 big files): which *.nft.json references them ==");
const top10 = topFiles.slice(0, 10);

for (const { file, bytes } of top10) {
  const needle = rel(file);
  const hits = [];
  for (const nft of nftFiles) {
    if (grepInJsonFile(nft, needle)) hits.push(rel(nft));
    if (hits.length >= 6) break;
  }

  console.log(`\n${fmt(bytes)}  ${needle}`);
  if (hits.length === 0) {
    console.log("  - no nft reference found (may be implicit or different path)");
  } else {
    for (const h of hits) console.log(`  - ${h}`);
  }
}
